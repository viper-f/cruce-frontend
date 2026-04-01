import { Injectable, signal, inject, effect } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { UserShort } from '../models/UserShort';
import { UserProfileResponse, UpdateSettingsRequest, User, UpdateSettingsResponse, UserListItem } from '../models/User';
import { Observable, from } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  private privateKeySignal = signal<CryptoKey | null>(null);
  readonly privateKey = this.privateKeySignal.asReadonly();

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        if (!this.privateKeySignal()) {
          this.tryRestorePrivateKey();
        }
      } else {
        this.privateKeySignal.set(null);
        this.clearPrivateKeyFromDb().catch(() => {});
      }
    });
  }

  private usersOnPageSignal = signal<UserShort[]>([]);
  readonly usersOnPage = this.usersOnPageSignal.asReadonly();

  readonly userProfileSignal = signal<UserProfileResponse | null>(null);
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

  loadUserProfile(userId: number) {
    return this.apiService.get<UserProfileResponse>(`user/profile/${userId}`);
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
    return this.apiService.get<{ private_key: string; iv: string; salt: string }>('user/private-key').pipe(
      switchMap(data => from(this.decryptPrivateKey(data.private_key, data.iv, data.salt, hashedPassword))),
      switchMap(key => {
        this.privateKeySignal.set(key);
        return from(this.savePrivateKeyToDb(key));
      })
    );
  }

  private async decryptPrivateKey(privateKeyBase64: string, ivBase64: string, saltBase64: string, passphrase: string): Promise<CryptoKey> {
    const encryptedBytes = this.base64ToBuffer(privateKeyBase64);
    const salt = this.base64ToBuffer(saltBase64);
    const iv = this.base64ToBuffer(ivBase64);

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
      { user_id: userId, private_key: passwordKey.private_key, iv: passwordKey.iv, salt: passwordKey.salt, recover_key_id: null },
      ...recoveryKeys.map((k, i) => ({ user_id: userId, private_key: k.private_key, iv: k.iv, salt: k.salt, recover_key_id: recoveryCodes[i].id }))
    ];

    return {
      private_keys: privateKeys,
      public_key: { user_id: userId, public_key: this.bufferToBase64(publicKeyBuffer) }
    };
  }

  private async encryptPrivateKey(privateKey: CryptoKey, passphrase: string): Promise<{ private_key: string; iv: string; salt: string }> {
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
      private_key: this.bufferToBase64(encryptedBuffer),
      iv: this.bufferToBase64(iv),
      salt: this.bufferToBase64(salt)
    };
  }

  hasPrivateKeyInDb(): Promise<boolean> {
    return this.loadPrivateKeyFromDb().then(key => key !== null);
  }

  checkPrivateKeySet(): Observable<boolean> {
    return this.apiService.get<boolean>('user/private-key-set');
  }

  requestNewRecoveryCodes(): Observable<{ id: number; code: string }[]> {
    return this.apiService.post<{ recovery_codes: { id: number; code: string }[] }>('user/recovery-codes/regenerate', {}).pipe(
      map(r => r.recovery_codes)
    );
  }

  initialSetupAndSaveKeys(hashedPassword: string, recoveryCodes: { id: number; code: string }[]): Observable<void> {
    return from(this.buildInitialKeysPayload(hashedPassword, recoveryCodes)).pipe(
      switchMap(({ payload, storedKey }) =>
        this.apiService.post<void>('user/save-keys', payload).pipe(
          switchMap(() => from(this.savePrivateKeyToDb(storedKey))),
          tap(() => this.privateKeySignal.set(storedKey))
        )
      )
    );
  }

  saveRegeneratedRecoveryCodes(hashedPassword: string, recoveryCodes: { id: number; code: string }[]): Observable<void> {
    const userId = this.authService.currentUser()!.id;
    return this.apiService.get<{ private_key: string; iv: string; salt: string }>('user/private-key').pipe(
      switchMap(data => from(this.decryptPrivateKeyToBuffer(data.private_key, data.iv, data.salt, hashedPassword))),
      switchMap(pkcs8Buffer => from(this.encryptBufferWithCodes(pkcs8Buffer, userId, recoveryCodes))),
      switchMap(privateKeys => this.apiService.post<void>('user/save-recovery-keys', { private_keys: privateKeys }))
    );
  }

  private async buildInitialKeysPayload(
    hashedPassword: string,
    recoveryCodes: { id: number; code: string }[]
  ): Promise<{ payload: any; storedKey: CryptoKey }> {
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
      { user_id: userId, private_key: passwordKey.private_key, iv: passwordKey.iv, salt: passwordKey.salt, recover_key_id: null },
      ...recoveryKeys.map((k, i) => ({ user_id: userId, private_key: k.private_key, iv: k.iv, salt: k.salt, recover_key_id: recoveryCodes[i].id }))
    ];

    // Re-import as non-extractable for IndexedDB storage
    const pkcs8Buffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const storedKey = await crypto.subtle.importKey('pkcs8', pkcs8Buffer, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);

    return {
      payload: {
        private_keys: privateKeys,
        public_key: { user_id: userId, public_key: this.bufferToBase64(publicKeyBuffer) }
      },
      storedKey
    };
  }

  private async decryptPrivateKeyToBuffer(
    privateKeyBase64: string,
    ivBase64: string,
    saltBase64: string,
    passphrase: string
  ): Promise<ArrayBuffer> {
    const encryptedBytes = this.base64ToBuffer(privateKeyBase64);
    const salt = this.base64ToBuffer(saltBase64);
    const iv = this.base64ToBuffer(ivBase64);

    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, encryptedBytes);
  }

  private async encryptBufferWithCodes(
    pkcs8Buffer: ArrayBuffer,
    userId: number,
    recoveryCodes: { id: number; code: string }[]
  ): Promise<any[]> {
    const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8Buffer, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
    const recoveryKeys = await Promise.all(recoveryCodes.map(rc => this.encryptPrivateKey(privateKey, rc.code)));
    return recoveryKeys.map((k, i) => ({
      user_id: userId,
      private_key: k.private_key,
      iv: k.iv,
      salt: k.salt,
      recover_key_id: recoveryCodes[i].id
    }));
  }

  private tryRestorePrivateKey(): void {
    this.loadPrivateKeyFromDb()
      .then(key => {
        if (key) {
          this.privateKeySignal.set(key);
        }
      })
      .catch(err => console.error('[UserService] failed to restore private key from IndexedDB', err));
  }

  private openKeyStore(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('cuento_keystore', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('keys');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async savePrivateKeyToDb(key: CryptoKey): Promise<void> {
    const db = await this.openKeyStore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      tx.objectStore('keys').put(key, 'private_key');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async loadPrivateKeyFromDb(): Promise<CryptoKey | null> {
    const db = await this.openKeyStore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readonly');
      const req = tx.objectStore('keys').get('private_key');
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  private async clearPrivateKeyFromDb(): Promise<void> {
    const db = await this.openKeyStore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      tx.objectStore('keys').delete('private_key');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }
}
