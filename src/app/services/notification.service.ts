import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { PostCreatedEvent, TopicCreatedEvent, NotificationEvent, WebSocketEvent, TopicViewersUpdateEvent, UnreadNotificationsResponse, NotificationData, PostUpdatedEvent, DirectMessageCreatedEvent } from '../models/event';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class NotificationService {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private ws: WebSocket | null = null;
  private readonly url: string;
  private token: string | null = null;

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 1000;
  private maxReconnectInterval = 30000;
  private reconnectTimer: number | null = null;
  private connectionTimeout: number | null = null;

  private postCreatedSubject = new Subject<PostCreatedEvent>();
  public postCreated$ = this.postCreatedSubject.asObservable();

  private postUpdatedSubject = new Subject<PostUpdatedEvent>();
  public postUpdated$ = this.postUpdatedSubject.asObservable();

  private topicCreatedSubject = new Subject<TopicCreatedEvent>();
  public topicCreated$ = this.topicCreatedSubject.asObservable();

  private topicViewersUpdateSubject = new Subject<TopicViewersUpdateEvent>();
  public topicViewersUpdate$ = this.topicViewersUpdateSubject.asObservable();

  private directMessageCreatedSubject = new Subject<DirectMessageCreatedEvent>();
  public directMessageCreated$ = this.directMessageCreatedSubject.asObservable();

  private systemNotificationsSignal = signal<NotificationData[]>([]);
  public systemNotifications = this.systemNotificationsSignal.asReadonly();
  private gameNotificationsSignal = signal<NotificationData[]>([]);
  public gameNotifications = this.gameNotificationsSignal.asReadonly();
  private mentionNotificationsSignal = signal<NotificationData[]>([]);
  public mentionNotifications = this.mentionNotificationsSignal.asReadonly();
  private directMessageNotificationsSignal = signal<NotificationData[]>([]);
  public directMessageNotifications = this.directMessageNotificationsSignal.asReadonly();

  // Subject for real-time toast notifications
  private notificationSubject = new Subject<NotificationData>();
  public notification$ = this.notificationSubject.asObservable();

  private messageQueue: string[] = [];
  private explicitlyClosed = false;

  constructor() {
    const baseUrl = environment.wsUrl;
    this.url = baseUrl.replace(/^http/, 'ws') + '/ws';
  }

  public loadUnreadNotifications(): void {
    this.apiService.get<UnreadNotificationsResponse>('notifications/unread').subscribe({
      next: (response) => {
        this.systemNotificationsSignal.set(response.system || []);
        this.gameNotificationsSignal.set(response.game || []);
        this.mentionNotificationsSignal.set(response.mention || []);
        this.directMessageNotificationsSignal.set(response.direct_message || []);
      },
      error: (err) => console.error('Failed to load unread notifications', err)
    });
  }

  public dismissNotification(notification: NotificationData): void {
    this.apiService.post(`notifications/dismiss/${notification.id}`, {}).subscribe({
      next: () => {
        // On success, remove the notification from the corresponding list
        if (notification.type === 'system') {
          this.systemNotificationsSignal.update(current => current.filter(n => n.id !== notification.id));
        } else if (notification.type === 'game') {
          this.gameNotificationsSignal.update(current => current.filter(n => n.id !== notification.id));
        } else if (notification.type === 'mention') {
          this.mentionNotificationsSignal.update(current => current.filter(n => n.id !== notification.id));
        } else if (notification.type === 'direct_message') {
          this.directMessageNotificationsSignal.update(current => current.filter(n => n.id !== notification.id));
        }
      },
      error: (err) => console.error('Failed to dismiss notification', err)
    });
  }

  public connect(authToken: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.token === authToken) {
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close();
    }

    if (!authToken) {
      console.error('Auth token is required.');
      return;
    }
    this.token = authToken;
    this.explicitlyClosed = false;
    this._doConnect();
  }

  public disconnect(): void {
    if (this.ws) {
      this.explicitlyClosed = true;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.ws.close();
    }
  }

  public sendMessage(message: unknown): void {
    const msgString = JSON.stringify(message);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msgString);
    } else {
      this.messageQueue.push(msgString);
    }
  }

  public sendPageChange(pageType: string, pageId: number): void {
    this.sendMessage({
      type: 'page_change',
      page_type: pageType,
      page_id: pageId
    });
  }

  private _doConnect(): void {
    if (!this.token) return;
    const urlWithAuth = `${this.url}?token=${this.token}`;
    this.ws = new WebSocket(urlWithAuth);

    this.connectionTimeout = window.setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
    }, 10000);

    this.ws.onopen = () => {
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      this.reconnectAttempts = 0;
      this.processMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        this.handleNotification(JSON.parse(event.data));
      } catch (error) {
        console.error('Error parsing message.', error);
      }
    };

    this.ws.onerror = (event) => {
      console.error('WebSocket error:', event);
    };

    this.ws.onclose = (event) => {
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      this.ws = null;
      if (!this.explicitlyClosed) {
        this.handleConnectionFailure();
      }
    };
  }

  private handleConnectionFailure() {
    this.authService.refreshToken().subscribe({
      next: (response) => {
        this.token = response.access_token;
        this.scheduleReconnect();
      },
      error: (err) => {
        console.error('NotificationService: Token refresh failed.', err);
        this.scheduleReconnect();
      }
    });
  }

  private processMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg = this.messageQueue.shift();
      if (msg) this.ws.send(msg);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const backoff = Math.min(this.maxReconnectInterval, this.reconnectInterval * Math.pow(2, this.reconnectAttempts));
    const jitter = backoff * 0.5 * Math.random();
    const timeout = backoff - jitter;
    this.reconnectTimer = window.setTimeout(() => this._doConnect(), timeout);
  }

  private handleNotification(notification: WebSocketEvent): void {
    switch (notification.type) {
      case 'post_created':
        this.postCreatedSubject.next(notification as PostCreatedEvent);
        break;
      case 'post_updated':
        this.postUpdatedSubject.next(notification as PostUpdatedEvent);
        break;
      case 'topic_created':
        this.topicCreatedSubject.next(notification as TopicCreatedEvent);
        break;
      case 'notification':
        const event = notification as NotificationEvent;
        const notificationData = event.data;

        // Push to subject for real-time toast
        this.notificationSubject.next(notificationData);

        // Also update the corresponding signal for the notification list
        if (notificationData.type === 'system') {
          this.systemNotificationsSignal.update(current => [notificationData, ...current]);
        } else if (notificationData.type === 'game') {
          this.gameNotificationsSignal.update(current => [notificationData, ...current]);
        } else if (notificationData.type === 'mention') {
          this.mentionNotificationsSignal.update(current => [notificationData, ...current]);
        } else if (notificationData.type === 'direct_message') {
          this.directMessageNotificationsSignal.update(current => [notificationData, ...current]);
        }
        break;
      case 'topic_viewers_update':
        this.topicViewersUpdateSubject.next(notification as TopicViewersUpdateEvent);
        break;
      case 'direct_message_created':
        this.directMessageCreatedSubject.next(notification as DirectMessageCreatedEvent);
        break;
      default:
        console.warn('Unknown notification type:', notification);
    }
  }
}
