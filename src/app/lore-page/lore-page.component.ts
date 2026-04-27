import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TopicService } from '../services/topic.service';
import { ApiService } from '../services/api.service';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';
import { RouterLinksDirective } from '../directives/router-links.directive';
import { LorePage } from '../models/LorePage';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lore-page',
  standalone: true,
  imports: [CommonModule, RouterLink, SafeHtmlPipe, RouterLinksDirective],
  templateUrl: './lore-page.component.html',
})
export class LorePageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private topicService = inject(TopicService);
  private apiService = inject(ApiService);

  post = this.topicService.singlePost;
  pages = signal<LorePage[]>([]);
  topicId = signal<number>(0);

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(paramMap => {
      const topicId = Number(paramMap.get('topicId'));
      const postId = Number(paramMap.get('postId'));

      if (topicId) {
        this.topicId.set(topicId);
        this.apiService.get<LorePage[]>(`lore-topic/${topicId}/pages`).subscribe({
          next: (data) => this.pages.set(data),
          error: (err) => console.error('Failed to load lore pages', err)
        });
      }

      if (postId) {
        this.topicService.loadPost(postId).subscribe({
          next: (data) => this.topicService.singlePostSignal.set(data),
          error: (err) => {
            if (err.status === 404) {
              setTimeout(() => this.router.navigate(['/404']));
            } else {
              console.error('Failed to load post', err);
            }
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
