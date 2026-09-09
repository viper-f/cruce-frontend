import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Setting } from '../models/Setting';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GlobalSettingsService {
  private apiService = inject(ApiService);

  private settingsSignal = signal<Setting[]>([]);
  readonly settings = this.settingsSignal.asReadonly();

  loadSettings(): void {
    this.apiService.get<Setting[]>('global-settings').subscribe({
      next: (data) => this.settingsSignal.set(data),
      error: (err) => console.error('Failed to load global settings', err)
    });
  }

  getSetting(name: string): string | null {
    return this.settingsSignal().find(s => s.setting_name === name)?.setting_value ?? null;
  }

  isEnabled(name: string): boolean {
    return this.getSetting(name) === 'y';
  }

  updateSettings(settings: Setting[]): Observable<void> {
    return this.apiService.post<void>('global-settings/update', settings);
  }
}
