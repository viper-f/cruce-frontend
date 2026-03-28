import {inject, Injectable, signal} from '@angular/core';
import {EpisodeListItem, EpisodeFilterRequest} from '../models/Episode';
import {ApiService} from './api.service';
import {TopicType, TopicStatus} from '../models/Topic';
import {SubforumShort} from '../models/Subforum';
import {FieldTemplate} from '../models/FieldTemplate';

@Injectable({ providedIn: 'root' })
export class EpisodeService {
  private apiService = inject(ApiService);
  private topicSignal = signal<EpisodeListItem>({
    id: 0,
    name: '',
    topic_id: 0,
    subforum_id: 0,
    subforum_name: '',
    topic_status: TopicStatus.active,
    last_post_date: ''
  });
  readonly topic = this.topicSignal.asReadonly();
  private topicListSignal = signal<EpisodeListItem[]>([]);
  readonly topicList = this.topicListSignal.asReadonly();

  private subforumListSignal = signal<SubforumShort[]>([]);
  readonly subforumList = this.subforumListSignal.asReadonly();

  private episodeListPageSignal = signal<EpisodeListItem[]>([]);
  readonly episodeListPage = this.episodeListPageSignal.asReadonly();

  private episodeTemplateSignal = signal<FieldTemplate[]>([]);
  readonly episodeTemplate = this.episodeTemplateSignal.asReadonly();

  loadSubforumList() {
    this.apiService.get<SubforumShort[]>('subforum/list-short').subscribe({
      next: (data) => {
        this.subforumListSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load subforum list', err);
      }
    })
  }

  loadEpisodeListPage(page: number, request: EpisodeFilterRequest) {
    this.apiService.post<EpisodeListItem[]>(`episodes/get`, request).subscribe({
      next: (data) => {
        this.episodeListPageSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load episode list page', err);
      }
    })
  }

  loadEpisodeTemplate(): void {
    this.apiService.get<FieldTemplate[]>('template/episode/get').subscribe({
      next: (data) => {
        const sortedData = data.sort((a, b) => a.order - b.order);
        this.episodeTemplateSignal.set(sortedData);
      },
      error: (err) => {
        console.error('Failed to load episode template', err);
      }
    });
  }

  saveEpisodeTemplate(template: FieldTemplate[]): void {
    this.apiService.post('template/episode/update', template).subscribe({
      next: (data) => {
        console.log('Episode template saved successfully', data);
      },
      error: (err) => {
        console.error('Failed to save episode template', err);
      }
    })
  }

  createEpisode(data: any) {
    return this.apiService.post('episode/create', data);
  }

  previewEpisode(data: any) {
    return this.apiService.post<any>('episode/preview', data);
  }

  updateEpisode(id: number, data: any) {
    return this.apiService.post(`episode/update/${id}`, data);
  }

}
