import { Injectable, inject, signal, effect } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { NotificationService } from './notification.service';
import { DirectChatListItem, DirectChatResponse, DirectMessageRaw } from '../models/DirectChat';
import { Message } from '../models/Message';
import { Observable, from, of, ReplaySubject } from 'rxjs';
import { take, switchMap, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class DirectChatService {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);

  private privateKeySubject = new ReplaySubject<CryptoKey>(1);
  private cachedPrivateKey: CryptoKey | null = null;

  constructor() {
    effect(() => {
      const key = this.userService.privateKey();
      if (key) {
        this.privateKeySubject.next(key);
      }
    });
  }

  private chatListSignal = signal<DirectChatListItem[]>([]);
  readonly chatList = this.chatListSignal.asReadonly();

  private currentChatSignal = signal<DirectChatResponse | null>(null);
  readonly currentChat = this.currentChatSignal.asReadonly();

  private messagesSignal = signal<Message[]>([]);
  readonly messages = this.messagesSignal.asReadonly();

  private isLoadingOlderSignal = signal(false);
  readonly isLoadingOlder = this.isLoadingOlderSignal.asReadonly();

  private isLoadingNewerSignal = signal(false);
  readonly isLoadingNewer = this.isLoadingNewerSignal.asReadonly();

  private noMoreNewer = false;

  resolvePrivateKey(): Observable<CryptoKey> {
    if (this.cachedPrivateKey) {
      return of(this.cachedPrivateKey);
    }
    const key = this.userService.privateKey();
    if (key) {
      this.cachedPrivateKey = key;
      return of(key);
    }
    return this.privateKeySubject.pipe(
      take(1),
      tap(k => { this.cachedPrivateKey = k; })
    );
  }

  loadDirectChat(chatId: number): void {
    this.notificationService.sendPageChange('direct_chat', chatId);
    this.notificationService.checkChatId(chatId);
    this.apiService.get<DirectChatResponse>(`direct-chat/${chatId}`).subscribe({
      next: (data) => {
        this.currentChatSignal.set(data);
        this.loadMessages(chatId);
      },
      error: (err) => console.error('Failed to load direct chat', err)
    });
  }

  loadMessages(chatId: number): void {
    this.noMoreNewer = false;
    const currentUserId = this.authService.currentUser()!.id;
    const privateKey = this.cachedPrivateKey!;

    this.apiService.get<DirectMessageRaw[]>(`direct-chat/${chatId}/messages`).pipe(
      switchMap(data => from(Promise.all(data.map(msg => this.decryptMessage(msg, privateKey, currentUserId)))))
    ).subscribe({
      next: (decrypted) => {
        this.messagesSignal.set(decrypted);
        const chat = this.currentChatSignal();
        if (chat && decrypted.length > 0) {
          const lastId = decrypted[decrypted.length - 1].id;
          if (chat.last_read_message_id === null || lastId > chat.last_read_message_id) {
            this.notificationService.sendMessage({
              type: 'direct_message_viewed',
              chat_id: chat.chat_id,
              last_viewed_message_id: lastId
            });
            this.currentChatSignal.update(c => c ? { ...c, last_read_message_id: lastId } : c);
          }
        }
      },
      error: (err) => console.error('DirectChatService: failed to load messages', err)
    });
  }

  private async decryptMessage(msg: DirectMessageRaw, privateKey: CryptoKey, currentUserId: number): Promise<Message> {
    const wrappedKey = this.base64ToBuffer(msg.key);
    const rawAesKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, wrappedKey);

    const aesKey = await crypto.subtle.importKey('raw', rawAesKey, { name: 'AES-GCM' }, false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.base64ToBuffer(msg.iv) },
      aesKey,
      this.base64ToBuffer(msg.ciphertext)
    );

    return {
      id: msg.id,
      text: new TextDecoder().decode(plaintext),
      time: new Date(msg.date_send).toLocaleString(),
      isMe: msg.user_id === currentUserId,
      username: msg.username,
      avatar: msg.avatar
    };
  }

  loadOlderMessages(chatId: number, beforeMessageId: number): void {
    this.isLoadingOlderSignal.set(true);
    const currentUserId = this.authService.currentUser()!.id;
    const privateKey = this.cachedPrivateKey!;

    this.apiService.get<DirectMessageRaw[]>(`direct-chat/${chatId}/messages/${beforeMessageId}/before`).pipe(
      switchMap(data => from(Promise.all(data.map(msg => this.decryptMessage(msg, privateKey, currentUserId)))))
    ).subscribe({
      next: (decrypted) => {
        this.messagesSignal.update(msgs => {
          const existingIds = new Set(msgs.map(m => m.id));
          return [...decrypted.filter(m => !existingIds.has(m.id)), ...msgs];
        });
        this.isLoadingOlderSignal.set(false);
      },
      error: (err) => {
        console.error('Failed to load older messages', err);
        this.isLoadingOlderSignal.set(false);
      }
    });
  }

  loadNewerMessages(chatId: number, afterMessageId: number): void {
    if (this.noMoreNewer) return;
    this.isLoadingNewerSignal.set(true);
    const currentUserId = this.authService.currentUser()!.id;
    const privateKey = this.cachedPrivateKey!;

    this.apiService.get<DirectMessageRaw[]>(`direct-chat/${chatId}/messages/${afterMessageId}/after`).pipe(
      switchMap(data => from(Promise.all(data.map(msg => this.decryptMessage(msg, privateKey, currentUserId)))))
    ).subscribe({
      next: (decrypted) => {
        if (decrypted.length === 0) {
          this.noMoreNewer = true;
        } else {
          this.messagesSignal.update(msgs => {
            const existingIds = new Set(msgs.map(m => m.id));
            return [...msgs, ...decrypted.filter(m => !existingIds.has(m.id))];
          });
          const chat = this.currentChatSignal();
          if (chat) {
            const lastId = decrypted[decrypted.length - 1].id;
            if (chat.last_read_message_id === null || lastId > chat.last_read_message_id) {
              this.notificationService.sendMessage({
                type: 'direct_message_viewed',
                chat_id: chat.chat_id,
                last_viewed_message_id: lastId
              });
              this.currentChatSignal.update(c => c ? { ...c, last_read_message_id: lastId } : c);
            }
          }
        }
        this.isLoadingNewerSignal.set(false);
      },
      error: (err) => {
        console.error('Failed to load newer messages', err);
        this.isLoadingNewerSignal.set(false);
      }
    });
  }

  loadChatList(): void {
    this.apiService.get<DirectChatListItem[]>('direct-chats').subscribe({
      next: (data) => this.chatListSignal.set(data),
      error: (err) => console.error('Failed to load direct chats', err)
    });
  }

  createChat(recipientId: number): Observable<{ chat_id: number }> {
    return this.apiService.post<{ chat_id: number }>('direct-chat/create', { recipient_id: recipientId });
  }

  prependChat(item: DirectChatListItem): void {
    this.chatListSignal.update(list => [item, ...list]);
  }

  appendNewMessage(raw: DirectMessageRaw): void {
    const currentUserId = this.authService.currentUser()!.id;
    from(this.decryptMessage(raw, this.cachedPrivateKey!, currentUserId)).subscribe({
      next: (message) => {
        if (this.messagesSignal().some(m => m.id === message.id)) return;
        this.messagesSignal.update(msgs => [...msgs, message]);
        const chat = this.currentChatSignal();
        if (chat && (chat.last_read_message_id === null || message.id > chat.last_read_message_id)) {
          this.notificationService.sendMessage({
            type: 'direct_message_viewed',
            chat_id: chat.chat_id,
            last_viewed_message_id: message.id
          });
          this.currentChatSignal.update(c => c ? { ...c, last_read_message_id: message.id } : c);
        }
      },
      error: (err) => console.error('Failed to decrypt incoming message', err)
    });
  }

  incrementUnreadCount(chatId: number): void {
    this.chatListSignal.update(list =>
      list.map(chat => chat.chat_id === chatId ? { ...chat, unread_count: chat.unread_count + 1 } : chat)
    );
  }

  sendMessage(content: string): Observable<any> {
    const chat = this.currentChatSignal();
    if (!chat) throw new Error('No active chat');

    const currentUserId = this.authService.currentUser()!.id;
    const author = chat.participants.find(p => p.id === currentUserId)!;
    const receiver = chat.participants.find(p => p.id !== currentUserId)!;

    if (!author.public_key || !receiver.public_key) throw new Error('Missing public keys');

    return from(this.buildMessagePayload(chat.chat_id, content, author.public_key, receiver.public_key)).pipe(
      switchMap(payload => this.apiService.post('direct-chat/message/create', payload))
    );
  }

  private async buildMessagePayload(chatId: number, content: string, authorKeyBase64: string, receiverKeyBase64: string) {
    const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new TextEncoder().encode(content)
    );

    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

    const [keyAuthor, keyReceiver] = await Promise.all([
      this.wrapAesKey(rawAesKey, authorKeyBase64),
      this.wrapAesKey(rawAesKey, receiverKeyBase64)
    ]);

    return {
      chat_id: chatId,
      ciphertext: this.bufferToBase64(ciphertext),
      iv: this.bufferToBase64(iv),
      key_author: keyAuthor,
      key_receiver: keyReceiver
    };
  }

  private async wrapAesKey(rawAesKey: ArrayBuffer, publicKeyBase64: string): Promise<string> {
    const rsaPublicKey = await crypto.subtle.importKey(
      'spki',
      this.base64ToBuffer(publicKeyBase64),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaPublicKey, rawAesKey);
    return this.bufferToBase64(wrappedKey);
  }

  private base64ToBuffer(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  private bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }
}
