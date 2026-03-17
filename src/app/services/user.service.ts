import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { UserShort } from '../models/UserShort';
import { UserProfileResponse, UpdateSettingsRequest, User, UpdateSettingsResponse, UserListItem } from '../models/User';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  private privateKeySignal = signal<CryptoKey | null>(null);
  readonly privateKey = this.privateKeySignal.asReadonly();

  private usersOnPageSignal = signal<UserShort[]>([]);
  readonly usersOnPage = this.usersOnPageSignal.asReadonly();

  private userProfileSignal = signal<UserProfileResponse | null>(null);
  readonly userProfile = this.userProfileSignal.asReadonly();

  private userListSignal = signal<UserListItem[]>([]);
  readonly userList = this.userListSignal.asReadonly();

  loadUsersOnPage(pageType: string, pageId: number): void {
    this.apiService.get<UserShort[]>(`users/page/${pageType}/${pageId}`).subscribe({
      next: (data) => {
        this.usersOnPageSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load users on page', err);
        this.usersOnPageSignal.set([]);
      }
    });
  }

  loadUserProfile(userId: number): void {
    this.apiService.get<UserProfileResponse>(`user/profile/${userId}`).subscribe({
      next: (data) => {
        this.userProfileSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load user profile', err);
        this.userProfileSignal.set(null);
      }
    });
  }

  loadUserList(): void {
    this.apiService.get<UserListItem[]>('user/list').subscribe({
      next: (data) => {
        this.userListSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load user list', err);
        this.userListSignal.set([]);
      }
    });
  }

  searchUsers(term: string): Observable<UserShort[]> {
    return this.apiService.get<UserShort[]>(`user/autocomplete/${encodeURIComponent(term)}`);
  }

  updateUserSettings(settings: UpdateSettingsRequest): Observable<User> {
    return this.apiService.post<UpdateSettingsResponse>('user/settings/update', settings).pipe(
      map(response => response.user)
    );
  }

  loadAndDecryptPrivateKey(hashedPassword: string): Observable<void> {
    return this.apiService.get<{ private_key: string; salt: string }>('user/private-key').pipe(
      switchMap(data => from(this.decryptPrivateKey(data.private_key, data.salt, hashedPassword))),
      map(key => {
        this.privateKeySignal.set(key);
      })
    );
  }

  private async decryptPrivateKey(privateKeyJson: string, saltBase64: string, passphrase: string): Promise<CryptoKey> {
    const data: { encrypted_key: string; iv: string } = JSON.parse(privateKeyJson);
    const encryptedBytes = this.base64ToBuffer(data.encrypted_key);
    const salt = this.base64ToBuffer(saltBase64);
    const iv = this.base64ToBuffer(data.iv);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, encryptedBytes);

    return crypto.subtle.importKey('pkcs8', decryptedBuffer, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  }

  private base64ToBuffer(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  generateAndSaveKeys(hashedPassword: string, recoveryCodes: { id: number; code: string }[]): Observable<any> {
    return from(this.buildKeysPayload(hashedPassword, recoveryCodes)).pipe(
      switchMap(payload => this.apiService.post('user/save-keys', payload))
    );
  }

  private async buildKeysPayload(hashedPassword: string, recoveryCodes: { id: number; code: string }[]): Promise<any> {
    const userId = this.authService.currentUser()!.id;

    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt']
    );

    const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);

    const passwordKey = await this.encryptPrivateKey(keyPair.privateKey, hashedPassword);
    const recoveryKeys = await Promise.all(recoveryCodes.map(rc => this.encryptPrivateKey(keyPair.privateKey, rc.code)));

    const privateKeys = [
      { user_id: userId, private_key: passwordKey.private_key, salt: passwordKey.salt, recover_key_id: null },
      ...recoveryKeys.map((k, i) => ({ user_id: userId, private_key: k.private_key, salt: k.salt, recover_key_id: recoveryCodes[i].id }))
    ];

    return {
      private_keys: privateKeys,
      public_key: { user_id: userId, public_key: this.bufferToBase64(publicKeyBuffer) }
    };
  }

  private async encryptPrivateKey(privateKey: CryptoKey, passphrase: string): Promise<{ private_key: string; salt: string }> {
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', privateKey);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, privateKeyBuffer);

    return {
      private_key: JSON.stringify({
        encrypted_key: this.bufferToBase64(encryptedBuffer),
        iv: this.bufferToBase64(iv)
      }),
      salt: this.bufferToBase64(salt)
    };
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }
}
