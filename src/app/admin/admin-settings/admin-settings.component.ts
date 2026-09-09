import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GlobalSettingsService } from '../../services/global-settings.service';

type SaveState = 'idle' | 'loading' | 'success' | 'error';

const SETTING_LABELS: Record<string, string> = {
  allow_add_faction: $localize`:@@adminSettings.allow_add_faction:Allow adding factions at character creation`,
  allow_guests_create_claims: $localize`:@@adminSettings.allow_guests_create_claims:Allow guests to create claims`,
  allow_guests_create_factions: $localize`:@@adminSettings.allow_guests_create_factions:Allow guests to create factions`,
  allow_users_create_claims: $localize`:@@adminSettings.allow_users_create_claims:Allow users to create claims`,
  allow_users_create_factions: $localize`:@@adminSettings.allow_users_create_factions:Allow users to create factions`,
  allow_wanted_for_claims: $localize`:@@adminSettings.allow_wanted_for_claims:Allow wanted characters for claims`,
  domain: $localize`:@@adminSettings.domain:Domain`,
  imgbb_api_key: $localize`:@@adminSettings.imgbb_api_key:ImgBB API key`,
  posts_per_page: $localize`:@@adminSettings.posts_per_page:Posts per page`,
  site_name: $localize`:@@adminSettings.site_name:Site name`,
  visual_navlinks_after_header_panel: $localize`:@@adminSettings.visual_navlinks_after_header_panel:Render navlinks after header panel`,
};

@Component({
  selector: 'app-admin-settings',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.css'
})
export class AdminSettingsComponent implements OnInit {
  private globalSettingsService = inject(GlobalSettingsService);

  settings = this.globalSettingsService.settings;
  settingLabels = SETTING_LABELS;
  saveState = signal<SaveState>('idle');

  ngOnInit() {
    this.globalSettingsService.loadSettings();
  }

  save() {
    this.saveState.set('loading');
    this.globalSettingsService.updateSettings(this.settings()).subscribe({
      next: () => this.flashState('success'),
      error: (err) => {
        console.error('Failed to save settings', err);
        this.flashState('error');
      }
    });
  }

  private flashState(state: 'success' | 'error') {
    this.saveState.set(state);
    setTimeout(() => this.saveState.set('idle'), 3000);
  }
}
