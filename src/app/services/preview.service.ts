import { Injectable, signal } from '@angular/core';
import { Topic } from '../models/Topic';
import { Post } from '../models/Post';

export type PreviewFormType = 'character' | 'episode' | 'topic' | 'post';

export interface PreviewState {
  formType: PreviewFormType;
  topic: Topic;
  posts: Post[];
  previewPost?: Post;
  returnUrl: string;
  formPayload: any;
}

@Injectable({ providedIn: 'root' })
export class PreviewService {
  private stateSignal = signal<PreviewState | null>(null);
  readonly state = this.stateSignal.asReadonly();

  set(state: PreviewState): void {
    this.stateSignal.set(state);
  }

  clear(): void {
    this.stateSignal.set(null);
  }
}
