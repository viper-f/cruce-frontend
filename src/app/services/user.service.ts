import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';
import { UserShort } from '../models/UserShort';
import { UserProfileResponse, UpdateSettingsRequest, User, UpdateSettingsResponse, UserListItem } from '../models/User';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiService = inject(ApiService);

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

  updateUserSettings(settings: UpdateSettingsRequest): Observable<User> {
    return this.apiService.post<UpdateSettingsResponse>('user/settings/update', settings).pipe(
      map(response => response.user)
    );
  }
}
