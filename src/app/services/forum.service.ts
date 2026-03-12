import {inject, Injectable, signal} from '@angular/core';
import {ApiService} from './api.service';
import {Topic} from '../models/Topic';
import {Subforum} from '../models/Subforum';

@Injectable({ providedIn: 'root' })
export class ForumService {
  private subforumTopicsSignal = signal<Topic[]>([]);
  readonly subforumTopics = this.subforumTopicsSignal.asReadonly();
  private subforumSignal = signal<Subforum>({
    id: 0,
    name: '',
    description: '',
    category_id: 0,
    position: 0,
    topic_number: 0,
    post_number: 0,
    last_post_topic_id: 0,
    last_post_topic_name: '',
    last_post_id: 0,
    date_last_post: '',
    last_post_author_name: '',
    permissions: {
      subforum_create_general_topic: false,
      subforum_create_episode_topic: false,
      subforum_create_character_topic: false,
      subforum_post: false,
      subforum_delete_topic: false,
      subforum_delete_others_topic: false,
      subforum_edit_others_post: false,
      subforum_edit_own_post: false
    }
  });
  readonly subforum = this.subforumSignal.asReadonly();

  private apiService = inject(ApiService);

  loadSubforumPage(subforum: number, page: number = 1) {
    this.apiService.get<Topic[]>('viewforum/' + subforum + '/' + page).subscribe({
      next: (data) => {
        this.subforumTopicsSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load categories', err);
      }
    });
  }

  loadSubforum(subforumId: number) {
    this.apiService.get<Subforum>('subforum/get/' + subforumId).subscribe({
      next: (data) => {
        this.subforumSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load categories', err);
      }
    })
  }
}
