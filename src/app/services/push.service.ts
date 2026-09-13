import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

function keyToBase64(key: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(key)));
}

@Injectable({ providedIn: 'root' })
export class PushService {
  private apiService = inject(ApiService);

  readonly supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  readonly pushEnabled = signal<boolean>(false);
  readonly permissionDenied = signal<boolean>(false);
  readonly busy = signal<boolean>(false);

  private lastPostedEndpoint: string | null = localStorage.getItem('push_endpoint');
  private vapidKey: string | null = null;

  async init(): Promise<void> {
    if (!this.supported) return;
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
      console.error('PushService: SW registration failed', err);
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    this.pushEnabled.set(!!sub);
    this.permissionDenied.set(Notification.permission === 'denied');
  }

  // Call this when the "Enable" button becomes visible so the VAPID key is ready
  // before the user clicks, keeping pushManager.subscribe() inside the gesture window.
  async prefetchVapidKey(): Promise<void> {
    if (!this.supported || this.vapidKey || this.pushEnabled() || this.permissionDenied()) return;
    this.busy.set(true);
    try {
      const pub = await firstValueFrom(
        this.apiService.get<{ public_key: string }>('push/vapid-public-key')
      );
      this.vapidKey = pub.public_key;
    } catch (err) {
      console.error('PushService: prefetchVapidKey failed', err);
    } finally {
      this.busy.set(false);
    }
  }

  async subscribeOnLogin(): Promise<void> {
    if (!this.supported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        if (existing.endpoint !== this.lastPostedEndpoint) {
          await this.postSubscription(existing);
          this.lastPostedEndpoint = existing.endpoint;
          localStorage.setItem('push_endpoint', existing.endpoint);
        }
        this.pushEnabled.set(true);
      } else if (localStorage.getItem('push_subscribed') === '1') {
        await this.subscribe();
      }
    } catch (err) {
      console.error('PushService: subscribeOnLogin failed', err);
    }
  }

  async subscribe(): Promise<void> {
    if (!this.supported || this.busy()) return;
    if (Notification.permission === 'denied') {
      this.permissionDenied.set(true);
      return;
    }
    this.busy.set(true);
    try {
      if (!this.vapidKey) {
        const pub = await firstValueFrom(
          this.apiService.get<{ public_key: string }>('push/vapid-public-key')
        );
        this.vapidKey = pub.public_key;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(this.vapidKey)
      });
      await this.postSubscription(sub);
      this.lastPostedEndpoint = sub.endpoint;
      localStorage.setItem('push_subscribed', '1');
      localStorage.setItem('push_endpoint', sub.endpoint);
      this.pushEnabled.set(true);
      this.permissionDenied.set(false);
    } catch (err) {
      console.error('PushService: subscribe failed', err);
      // Permission may have been denied during the browser prompt
      this.permissionDenied.set((Notification.permission as string) === 'denied');
    } finally {
      this.busy.set(false);
    }
  }

  // User-initiated disable — removes localStorage flag so it stays off after next login.
  async unsubscribe(): Promise<void> {
    await this.doUnsubscribe();
    localStorage.removeItem('push_subscribed');
  }

  // Called on logout — removes the backend subscription but preserves the localStorage flag
  // so it auto-resubscribes on next login.
  async unsubscribeOnLogout(): Promise<void> {
    await this.doUnsubscribe();
  }

  private async doUnsubscribe(): Promise<void> {
    if (!this.supported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await firstValueFrom(
          this.apiService.post<void>('push/unsubscribe', { endpoint: sub.endpoint })
        );
        await sub.unsubscribe();
      }
    } catch (err) {
      console.error('PushService: unsubscribe failed', err);
    } finally {
      this.lastPostedEndpoint = null;
      localStorage.removeItem('push_endpoint');
      this.pushEnabled.set(false);
    }
  }

  private async postSubscription(sub: PushSubscription): Promise<void> {
    const p256dh = sub.getKey('p256dh');
    const auth = sub.getKey('auth');
    if (!p256dh || !auth) return;
    await firstValueFrom(
      this.apiService.post<void>('push/subscribe', {
        endpoint: sub.endpoint,
        p256dh: keyToBase64(p256dh),
        auth: keyToBase64(auth)
      })
    );
  }
}
