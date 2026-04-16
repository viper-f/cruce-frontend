import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { User } from '../models/User';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { environment } from '../../environments/environment';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly apiUrl = environment.apiUrl;
  private authChannel = new BroadcastChannel('auth_channel');

  currentUser = signal<User | null>(null);
  isAuthenticated = computed(() => !!this.currentUser()?.id);
  authToken = signal<string | null>(null);
  isAdmin = computed(() => this.hasRole('admin'));

  isRefreshing = false;
  refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  constructor() {
    const token = localStorage.getItem('access_token');
    const userString = localStorage.getItem('user');
    if (token && userString) {
      const user: User = JSON.parse(userString);
      this.currentUser.set(user);
      this.authToken.set(token);
      localStorage.setItem('locale', user.interface_language);
    } else {
      this.setGuestUser();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isAuthenticated() && this.isAccessTokenExpired()) {
        this.refreshToken().subscribe({
          error: () => {}
        });
      }
    });
  }


  public hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });
  }

  isAccessTokenExpired(): boolean {
    const token = localStorage.getItem('access_token');
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem('refresh_token');
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, { refresh_token: refreshToken }).pipe(
      tap((response: AuthResponse) => {
        this.handleAuth(response, false);
      })
    );
  }

  recoverWithCode(hashedCode: string): Observable<{ private_key: { private_key: string; iv: string; salt: string }; security_code: string }> {
    return this.http.post<{ private_key: { private_key: string; iv: string; salt: string }; security_code: string }>(`${this.apiUrl}/recovery`, { code: hashedCode });
  }

  updatePasswordWithKey(hashedPassword: string, privateKey: string, iv: string, salt: string, securityCode: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/update-password`, {
      password: hashedPassword,
      private_key: privateKey,
      iv,
      salt,
      security_code: securityCode
    });
  }

  register(data: any): Observable<any> {
    return from(this.hashPassword(data.password)).pipe(
      switchMap(hashedPassword => {
        const registerData = { ...data, password: hashedPassword };
        return this.http.post(`${this.apiUrl}/register`, registerData);
      })
    );
  }

  login(credentials: { username: string; password: string }): Observable<AuthResponse> {
    return from(this.hashPassword(credentials.password)).pipe(
      switchMap(hashedPassword => {
        const loginData = { ...credentials, password: hashedPassword };
        return this.http.post<AuthResponse>(`${this.apiUrl}/login`, loginData).pipe(
          tap(res => this.handleAuth(res))
        );
      })
    );
  }

  loginSilently(credentials: { username: string; password: string }): Observable<AuthResponse> {
    return from(this.hashPassword(credentials.password)).pipe(
      switchMap(hashedPassword => {
        const loginData = { ...credentials, password: hashedPassword };
        return this.http.post<AuthResponse>(`${this.apiUrl}/login`, loginData).pipe(
          tap(res => {
            localStorage.setItem('access_token', res.access_token);
            localStorage.setItem('refresh_token', res.refresh_token);
            localStorage.setItem('locale', res.user.interface_language);
            localStorage.setItem('user', JSON.stringify(res.user));
            this.currentUser.set(res.user);
            this.authToken.set(res.access_token);
          })
        );
      })
    );
  }

  logout() {
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      next: () => this.clearLocalAuth(true),
      error: () => this.clearLocalAuth(true)
    });
  }

  public clearLocalAuth(notify: boolean = true) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('locale');
    this.setGuestUser();
    this.authToken.set(null);
    if (notify) {
      this.authChannel.postMessage('logout');
    }
    this.router.navigate(['/login']);
  }

  public updateUser(user: User) {
    localStorage.setItem('user', JSON.stringify(user));
    const wasGuest = this.currentUser()?.id === 0;
    const storedLocale = localStorage.getItem('locale');
    this.currentUser.set(user);
    // Update locale — only reload if switching between languages on an already-authenticated session
    if (storedLocale !== user.interface_language) {
      localStorage.setItem('locale', user.interface_language);
      if (!wasGuest) {
        window.location.reload();
      }
    }
  }

  private handleAuth(response: AuthResponse, navigate: boolean = true) {
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    this.updateUser(response.user);
    this.authToken.set(response.access_token);
    this.authChannel.postMessage('login');
    if (navigate) {
      this.router.navigate(['/']);
    }
  }

  private isRussianLocale(): boolean {
    const stored = localStorage.getItem('locale');
    if (stored) return stored === 'ru-RU';
    const languages: readonly string[] = navigator.languages?.length ? navigator.languages : [navigator.language];
    return languages.some(l => l.startsWith('ru'));
  }

  private setGuestUser() {
    this.currentUser.set({
      id: 0,
      username: this.isRussianLocale() ? 'Гость' : 'Guest',
      avatar: "",
      interface_timezone: "UTC",
      interface_language: "en-US",
      interface_font_size: 1,
      roles: [{
        id: 1,
        name: 'guest'
      }]
    });
  }

  public hasRole(name: string) {
    const user = this.currentUser();
    if (user == null || user.id === 0) {
      return false;
    }
    const role = user.roles?.find(role => role.name === name);
    return !!role;
  }
}
