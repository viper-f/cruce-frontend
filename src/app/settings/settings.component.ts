import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { UpdateSettingsRequest } from '../models/User';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);

  language: string = 'en-US';
  timezone: string = 'UTC';
  avatarUrl = '';
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';

  timezones: string[] = [
    'UTC-12:00', 'UTC-11:00', 'UTC-10:00', 'UTC-09:00', 'UTC-08:00',
    'UTC-07:00', 'UTC-06:00', 'UTC-05:00', 'UTC-04:00', 'UTC-03:00',
    'UTC-02:00', 'UTC-01:00', 'UTC+00:00', 'UTC+01:00', 'UTC+02:00',
    'UTC+03:00', 'UTC+04:00', 'UTC+05:00', 'UTC+06:00', 'UTC+07:00',
    'UTC+08:00', 'UTC+09:00', 'UTC+10:00', 'UTC+11:00', 'UTC+12:00'
  ];

  ngOnInit() {
    this.avatarUrl = this.authService.currentUser()?.avatar || '';
  }

  async onSubmit(event: Event) {
    event.preventDefault();

    const payload: UpdateSettingsRequest = {
      avatar: this.avatarUrl,
      interface_timezone: this.timezone,
      interface_language: this.language
    };

    if (this.newPassword && this.newPassword === this.confirmPassword) {
      payload.password = await this.authService.hashPassword(this.newPassword);
    }

    this.userService.updateUserSettings(payload).subscribe({
      next: () => {
        console.log('Settings updated successfully');
        // Optionally, update local user data?
      },
      error: (err) => console.error('Failed to update settings', err)
    });
  }
}
