import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { ApiService } from '../services/api.service';
import { UpdateSettingsRequest } from '../models/User';
import { ImageFieldComponent } from '../components/image-field/image-field.component';

interface UserNotificationSetting {
  notification_type: string;
  disable_toast: boolean;
  disable_sound: boolean;
  disable_all: boolean;
}

interface DesignVariation {
  id: number;
  class_name: string | null;
  name: string | null;
}

const IANA_TIMEZONES = [
  { label: "(UTC-11:00) Midway", value: "Pacific/Midway" },
  { label: "(UTC-10:00) Honolulu", value: "Pacific/Honolulu" },
  { label: "(UTC-09:00) Anchorage", value: "America/Anchorage" },
  { label: "(UTC-08:00) Los Angeles", value: "America/Los_Angeles" },
  { label: "(UTC-07:00) Denver", value: "America/Denver" },
  { label: "(UTC-07:00) Phoenix", value: "America/Phoenix" },
  { label: "(UTC-06:00) Chicago", value: "America/Chicago" },
  { label: "(UTC-06:00) Mexico City", value: "America/Mexico_City" },
  { label: "(UTC-05:00) New York", value: "America/New_York" },
  { label: "(UTC-04:00) Santiago", value: "America/Santiago" },
  { label: "(UTC-03:30) St. John's", value: "America/St_Johns" },
  { label: "(UTC-03:00) Sao Paulo", value: "America/Sao_Paulo" },
  { label: "(UTC-03:00) Buenos Aires", value: "America/Argentina/Buenos_Aires" },
  { label: "(UTC-01:00) Azores", value: "Atlantic/Azores" },
  { label: "(UTC+00:00) London / Dublin", value: "Europe/London" },
  { label: "(UTC+00:00) Reykjavik", value: "Atlantic/Reykjavik" },
  { label: "(UTC+01:00) Berlin / Paris / Rome", value: "Europe/Berlin" },
  { label: "(UTC+01:00) Warsaw / Prague / Madrid", value: "Europe/Warsaw" },
  { label: "(UTC+01:00) Lagos", value: "Africa/Lagos" },
  { label: "(UTC+02:00) Kyiv / Riga / Tallinn", value: "Europe/Kyiv" },
  { label: "(UTC+02:00) Helsinki / Athens / Sofia", value: "Europe/Helsinki" },
  { label: "(UTC+02:00) Johannesburg", value: "Africa/Johannesburg" },
  { label: "(UTC+03:00) Moscow", value: "Europe/Moscow" },
  { label: "(UTC+03:00) Minsk", value: "Europe/Minsk" },
  { label: "(UTC+03:00) Istanbul", value: "Europe/Istanbul" },
  { label: "(UTC+03:00) Nairobi", value: "Africa/Nairobi" },
  { label: "(UTC+03:30) Tehran", value: "Asia/Tehran" },
  { label: "(UTC+04:00) Dubai", value: "Asia/Dubai" },
  { label: "(UTC+04:00) Samara", value: "Europe/Samara" },
  { label: "(UTC+04:30) Kabul", value: "Asia/Kabul" },
  { label: "(UTC+05:00) Karachi", value: "Asia/Karachi" },
  { label: "(UTC+05:00) Yekaterinburg", value: "Asia/Yekaterinburg" },
  { label: "(UTC+05:30) Kolkata", value: "Asia/Kolkata" },
  { label: "(UTC+06:00) Dhaka", value: "Asia/Dhaka" },
  { label: "(UTC+07:00) Bangkok", value: "Asia/Bangkok" },
  { label: "(UTC+07:00) Novosibirsk", value: "Asia/Novosibirsk" },
  { label: "(UTC+08:00) Shanghai", value: "Asia/Shanghai" },
  { label: "(UTC+08:00) Perth", value: "Australia/Perth" },
  { label: "(UTC+09:00) Tokyo", value: "Asia/Tokyo" },
  { label: "(UTC+09:00) Yakutsk / Chita", value: "Asia/Yakutsk" },
  { label: "(UTC+09:30) Adelaide", value: "Australia/Adelaide" },
  { label: "(UTC+10:00) Vladivostok / Khabarovsk", value: "Asia/Vladivostok" },
  { label: "(UTC+11:00) Magadan / Sakhalin", value: "Asia/Magadan" },
  { label: "(UTC+11:00) Srednekolymsk", value: "Asia/Srednekolymsk" },
  { label: "(UTC+10:00) Sydney", value: "Australia/Sydney" },
  { label: "(UTC+11:00) Solomon Is.", value: "Pacific/Guadalcanal" },
  { label: "(UTC+12:00) Auckland", value: "Pacific/Auckland" },
  { label: "(UTC+12:00) Kamchatka / Anadyr", value: "Asia/Kamchatka" }
];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageFieldComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  language: string = 'en-US';
  timezone: string = 'UTC+00:00';
  interfaceDesign: string | null = null;
  designVariations = signal<DesignVariation[]>([]);
  fontSize: number = 1.0;
  avatarUrl = '';
  saveState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');

  showArchiveModal = signal(false);

  notificationSettings = signal<UserNotificationSetting[]>([]);
  notifSaveState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');

  notificationTypeNames: Record<string, string> = {
    system: $localize`:@@settings.notif.typeName.system:System messages`,
    game: $localize`:@@settings.notif.typeName.game:Posts in my games`,
    mention: $localize`:@@settings.notif.typeName.mention:Mentions`,
    account_update: $localize`:@@settings.notif.typeName.account_update:Account updates`,
    direct_message: $localize`:@@settings.notif.typeName.direct_message:Direct messages`,
    reaction: $localize`:@@settings.notif.typeName.reaction:Reactions`,
  };
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';

  timezones = IANA_TIMEZONES;

  fontSizes = [
    { label: 'x0.5', value: 0.5 },
    { label: 'x0.8', value: 0.8 },
    { label: 'Standard', value: 1.0 },
    { label: 'x1.2', value: 1.2 },
    { label: 'x1.5', value: 1.5 },
    { label: 'x2.0', value: 2.0 }
  ];

  ngOnInit() {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.avatarUrl = currentUser.avatar || '';
      this.language = currentUser.interface_language || 'en-US';
      this.timezone = currentUser.interface_timezone || 'UTC';
      this.fontSize = currentUser.interface_font_size || 1.0;
      this.interfaceDesign = currentUser.interface_design ?? null;
    }
    this.apiService.get<DesignVariation[]>('design-variation/list').subscribe({
      next: (list) => this.designVariations.set(list),
      error: (err) => console.error('Failed to load design variations', err)
    });
    this.apiService.get<UserNotificationSetting[]>('notifications/settings').subscribe({
      next: (list) => this.notificationSettings.set(list),
      error: (err) => console.error('Failed to load notification settings', err)
    });
  }

  isColumnAll(col: keyof UserNotificationSetting): boolean {
    return this.notificationSettings().every(s => s[col] as boolean);
  }

  toggleColumn(col: keyof UserNotificationSetting, value: boolean) {
    this.notificationSettings.update(list =>
      list.map(s => ({ ...s, [col]: value }))
    );
  }

  toggleSetting(type: string, col: keyof UserNotificationSetting, value: boolean) {
    this.notificationSettings.update(list =>
      list.map(s => s.notification_type === type ? { ...s, [col]: value } : s)
    );
  }

  saveNotificationSettings() {
    this.notifSaveState.set('loading');
    this.apiService.post('notifications/settings/update', this.notificationSettings()).subscribe({
      next: () => {
        const currentUser = this.authService.currentUser();
        if (currentUser) {
          this.authService.updateUser({ ...currentUser, notification_settings: this.notificationSettings() });
        }
        this.notifSaveState.set('success');
        setTimeout(() => this.notifSaveState.set('idle'), 3000);
      },
      error: () => {
        this.notifSaveState.set('error');
        setTimeout(() => this.notifSaveState.set('idle'), 3000);
      }
    });
  }

  openArchiveModal() {
    this.showArchiveModal.set(true);
  }

  closeArchiveModal() {
    this.showArchiveModal.set(false);
  }

  confirmArchive() {
    this.userService.archiveAccount().subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => console.error('Failed to archive account', err)
    });
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const payload: UpdateSettingsRequest = {
      avatar: formData.get('avatar_url') as string,
      interface_timezone: this.timezone,
      interface_language: this.language,
      interface_font_size: this.fontSize,
      interface_design: this.interfaceDesign
    };

    if (this.newPassword && this.newPassword === this.confirmPassword) {
      payload.password = await this.authService.hashPassword(this.newPassword);
    }

    this.saveState.set('loading');
    this.userService.updateUserSettings(payload).subscribe({
      next: (updatedUser) => {
        this.authService.updateUser(updatedUser);
        this.saveState.set('success');
        setTimeout(() => this.saveState.set('idle'), 3000);
      },
      error: () => {
        this.saveState.set('error');
        setTimeout(() => this.saveState.set('idle'), 3000);
      }
    });
  }
}
