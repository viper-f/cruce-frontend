import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Board } from '../models/Board';

@Injectable({ providedIn: 'root' })
export class BoardService {
  private apiService = inject(ApiService);

  private boardSignal = signal<Board>({
    site_name: "",
    domain: "",
    total_user_number: 0,
    total_character_number: 0,
    total_topic_number: 0,
    total_post_number: 0,
    total_episode_number: 0,
    total_episode_post_number: 0,
    last_registered_user: null,
    posts_per_page: 15,
    visual_navlinks_after_header_panel: 'n'
  });
  readonly board = this.boardSignal.asReadonly();

  loadBoard(): void {
    this.apiService.get<Board>('board/info').subscribe({
      next: (data) => {
        this.boardSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load board info', err);
      }
    });
  }
}
