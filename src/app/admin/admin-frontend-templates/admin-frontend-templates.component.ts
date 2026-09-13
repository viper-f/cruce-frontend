import { Component, inject, OnInit, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

export interface FrontendComponent {
  name: string;
  template_path: string;
  default_template_path: string;
  description: string;
  active: boolean;
}

const DESCRIPTIONS: Record<string, string> = {
  'src/app/components/category': $localize`:@@frontend_component.src_app_components_category.description:Category page listing topics with filtering and navigation`,
  'src/app/components/footer_statistics': $localize`:@@frontend_component.src_app_components_footer_statistics.description:Footer statistics bar showing site-wide post and user counts`,
  'src/app/components/episode_header': $localize`:@@frontend_component.src_app_components_episode_header.description:Episode header displaying title, participants and episode metadata`,
  'src/app/components/character_sheet_header': $localize`:@@frontend_component.src_app_components_character_sheet_header.description:Character sheet header with avatar, name and key character details`,
  'src/app/components/wanted_character_header': $localize`:@@frontend_component.src_app_components_wanted_character_header.description:Wanted character ad header with role description and requirements`,
  'src/app/components/wanted_character_card': $localize`:@@frontend_component.src_app_components_wanted_character_card.description:Wanted character card shown in the wanted characters list`,
};

@Component({
  selector: 'app-admin-frontend-templates',
  host: { class: 'pun-page' },
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-frontend-templates.component.html',
  styleUrl: './admin-frontend-templates.component.css',
})
export class AdminFrontendTemplatesComponent implements OnInit {
  private apiService = inject(ApiService);

  components = signal<FrontendComponent[]>([]);

  ngOnInit() {
    this.apiService.get<FrontendComponent[]>('admin/frontend-templates/components').subscribe({
      next: (data) => this.components.set(data),
      error: (err) => console.error('Failed to load frontend components', err),
    });
  }

  getDescription(name: string, fallback: string): string {
    return DESCRIPTIONS[name] ?? fallback;
  }
}
