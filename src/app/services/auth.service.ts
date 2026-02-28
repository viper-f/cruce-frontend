import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { User } from '../models/User';
import { BehaviorSubject, Observable, from } from 'rxjs';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly apiUrl = 'http://localhost/api';
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
  }

  public async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem('refresh_token');
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, { refresh_token: refreshToken }).pipe(
      tap((response: AuthResponse) => {
        this.handleAuth(response, false);
      })
    );
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
    this.currentUser.set(user);
    // Also update locale if it has changed
    if (localStorage.getItem('locale') !== user.interface_language) {
      localStorage.setItem('locale', user.interface_language);
      window.location.reload();
    }
  }

  private handleAuth(response: AuthResponse, navigate: boolean = true) {
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    this.updateUser(response.user);
    this.authToken.set(response.access_token);
    this.authChannel.postMessage('login');
    if (navigate) {
      this.router.navigate(['/dashboard']);
    }
  }

  private setGuestUser() {
    this.currentUser.set({
      id: 0,
      username: 'Гость',
      avatar: "",
      interface_timezone: "UTC",
      interface_language: "en-US",
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
