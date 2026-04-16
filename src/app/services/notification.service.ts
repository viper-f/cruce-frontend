import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { PostCreatedEvent, TopicCreatedEvent, NotificationEvent, WebSocketEvent, TopicViewersUpdateEvent, UnreadNotificationsResponse, NotificationData, PostUpdatedEvent, DirectMessageCreatedEvent, ActiveUsersUpdateEvent, PanelReloadEvent, ReactionCreatedEvent } from '../models/event';
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

  private activeUsersUpdateSubject = new Subject<ActiveUsersUpdateEvent>();
  public activeUsersUpdate$ = this.activeUsersUpdateSubject.asObservable();

  private panelReloadSubject = new Subject<PanelReloadEvent>();
  public panelReload$ = this.panelReloadSubject.asObservable();

  private reactionCreatedSubject = new Subject<ReactionCreatedEvent>();
  public reactionCreated$ = this.reactionCreatedSubject.asObservable();

private systemNotificationsSignal = signal<NotificationData[]>([]);
  public systemNotifications = this.systemNotificationsSignal.asReadonly();
  private gameNotificationsSignal = signal<NotificationData[]>([]);
  public gameNotifications = this.gameNotificationsSignal.asReadonly();
  private mentionNotificationsSignal = signal<NotificationData[]>([]);
  public mentionNotifications = this.mentionNotificationsSignal.asReadonly();
  private directMessageNotificationsSignal = signal<NotificationData[]>([]);
  public directMessageNotifications = this.directMessageNotificationsSignal.asReadonly();
  private reactionNotificationsSignal = signal<NotificationData[]>([]);
  public reactionNotifications = this.reactionNotificationsSignal.asReadonly();

  // Subject for real-time toast notifications
  private notificationSubject = new Subject<NotificationData>();
  public notification$ = this.notificationSubject.asObservable();

  private messageQueue: string[] = [];
  private explicitlyClosed = false;
  private lastMsgId: number | null = null;
  private seenPostMsgIds = new Set<number>();

  // Auto-dismissal trigger maps
  private mentionPostTriggers = new Map<number, NotificationData>();  // post_id → notification
  private gameTopicTriggers = new Map<number, NotificationData>();    // topic_id → notification
  private dmChatTriggers = new Map<number, NotificationData>();       // chat_id → notification

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
        this.reactionNotificationsSignal.set(response.reaction || []);
        this.rebuildTriggers(response);
      },
      error: (err) => console.error('Failed to load unread notifications', err)
    });
  }

  private rebuildTriggers(response: UnreadNotificationsResponse): void {
    this.mentionPostTriggers.clear();
    this.gameTopicTriggers.clear();
    this.dmChatTriggers.clear();
    for (const n of response.mention || []) {
      if (n.mention?.post_id) this.mentionPostTriggers.set(n.mention.post_id, n);
    }
    for (const n of response.game || []) {
      if (n.game?.topic_id) this.gameTopicTriggers.set(n.game.topic_id, n);
    }
    for (const n of response.direct_message || []) {
      if (n.direct_message?.chat_id) this.dmChatTriggers.set(n.direct_message.chat_id, n);
    }
  }

  private addTrigger(n: NotificationData): void {
    if (n.type === 'mention' && n.mention?.post_id) {
      this.mentionPostTriggers.set(n.mention.post_id, n);
    } else if (n.type === 'game' && n.game?.topic_id) {
      this.gameTopicTriggers.set(n.game.topic_id, n);
    } else if (n.type === 'direct_message' && n.direct_message?.chat_id) {
      this.dmChatTriggers.set(n.direct_message.chat_id, n);
    }
  }

  private removeTrigger(n: NotificationData): void {
    if (n.type === 'mention' && n.mention?.post_id) {
      this.mentionPostTriggers.delete(n.mention.post_id);
    } else if (n.type === 'game' && n.game?.topic_id) {
      this.gameTopicTriggers.delete(n.game.topic_id);
    } else if (n.type === 'direct_message' && n.direct_message?.chat_id) {
      this.dmChatTriggers.delete(n.direct_message.chat_id);
    }
  }

  public checkPostIds(postIds: number[]): void {
    if (this.mentionNotificationsSignal().length === 0) return;
    for (const postId of postIds) {
      const n = this.mentionPostTriggers.get(postId);
      if (n) this.dismissNotification(n);
    }
  }

  public checkTopicId(topicId: number): void {
    if (this.gameNotificationsSignal().length === 0) return;
    const n = this.gameTopicTriggers.get(topicId);
    if (n) this.dismissNotification(n);
  }

  public checkChatId(chatId: number): void {
    if (this.directMessageNotificationsSignal().length === 0) return;
    const n = this.dmChatTriggers.get(chatId);
    if (n) this.dismissNotification(n);
  }

  public dismissNotification(notification: NotificationData): void {
    this.removeTrigger(notification);
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
        } else if (notification.type === 'reaction') {
          this.reactionNotificationsSignal.update(current => current.filter(n => n.id !== notification.id));
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
    const lastId = this.lastMsgId !== null ? `&last_message_id=${this.lastMsgId}` : '';
    const urlWithAuth = `${this.url}?token=${this.token}${lastId}`;
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

    this.ws.onclose = () => {
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      this.ws = null;
      if (!this.explicitlyClosed) {
        this.handleConnectionFailure();
      }
    };
  }

  private handleConnectionFailure() {
    if (this.authService.isAccessTokenExpired()) {
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
    } else {
      this.scheduleReconnect();
    }
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
    if (notification.msg_id !== undefined) {
      this.lastMsgId = notification.msg_id;
    }
    switch (notification.type) {
      case 'post_created':
        const postEvent = notification as PostCreatedEvent;
        if (postEvent.msg_id !== undefined) {
          if (this.seenPostMsgIds.has(postEvent.msg_id)) break;
          this.seenPostMsgIds.add(postEvent.msg_id);
        }
        this.postCreatedSubject.next(postEvent);
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
        const notifSetting = this.authService.currentUser()?.notification_settings
          ?.find(s => s.notification_type === notificationData.type);

        if (notifSetting?.disable_all) break;

        this.addTrigger(notificationData);

        if (notificationData.type === 'system') {
          this.systemNotificationsSignal.update(current => [notificationData, ...current]);
        } else if (notificationData.type === 'game') {
          this.gameNotificationsSignal.update(current => [notificationData, ...current]);
        } else if (notificationData.type === 'mention') {
          this.mentionNotificationsSignal.update(current => [notificationData, ...current]);
        } else if (notificationData.type === 'direct_message') {
          this.directMessageNotificationsSignal.update(current => [notificationData, ...current]);
        } else if (notificationData.type === 'reaction') {
          this.reactionNotificationsSignal.update(current => [notificationData, ...current]);
        }

        if (!notifSetting?.disable_toast) {
          this.notificationSubject.next(notificationData);
        }
        break;
      case 'topic_viewers_update':
        this.topicViewersUpdateSubject.next(notification as TopicViewersUpdateEvent);
        break;
      case 'direct_message_created':
        this.directMessageCreatedSubject.next(notification as DirectMessageCreatedEvent);
        break;
      case 'active_users_update':
        this.activeUsersUpdateSubject.next(notification as ActiveUsersUpdateEvent);
        break;
      case 'panel_reload':
        this.panelReloadSubject.next(notification as PanelReloadEvent);
        break;
      case 'reaction_created':
        this.reactionCreatedSubject.next(notification as ReactionCreatedEvent);
        break;
      default:
        console.warn('Unknown notification type:', notification);
    }
  }
}
