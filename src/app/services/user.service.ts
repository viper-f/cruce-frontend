import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';
import { UserShort } from '../models/UserShort';
import { UserProfileResponse, UpdateSettingsRequest } from '../models/User';

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiService = inject(ApiService);

  private usersOnPageSignal = signal<UserShort[]>([]);
  readonly usersOnPage = this.usersOnPageSignal.asReadonly();

  private userProfileSignal = signal<UserProfileResponse | null>(null);
  readonly userProfile = this.userProfileSignal.asReadonly();

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

  updateUserSettings(settings: UpdateSettingsRequest) {
    return this.apiService.post('user/settings/update', settings);
  }
}
