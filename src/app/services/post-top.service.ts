import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { PostTop, PostTopCreateRequest, PostTopUpdateRequest, PostTopResult } from '../models/PostTop';

@Injectable({ providedIn: 'root' })
export class PostTopService {
  private apiService = inject(ApiService);

  private topsSignal = signal<PostTop[]>([]);
  readonly tops = this.topsSignal.asReadonly();

  loadTops() {
    return this.apiService.get<PostTop[]>('post-top/tops');
  }

  getTop(id: number) {
    return this.apiService.get<PostTopResult>(`post-top/${id}`);
  }

  createTop(req: PostTopCreateRequest) {
    return this.apiService.post<PostTop>('post-top/tops/create', req);
  }

  updateTop(id: number, req: PostTopUpdateRequest) {
    return this.apiService.post<PostTop>(`post-top/tops/${id}/update`, req);
  }

  deleteTop(id: number) {
    return this.apiService.post<void>(`post-top/tops/${id}/delete`, {});
  }
}
