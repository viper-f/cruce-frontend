import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TopicService } from '../services/topic.service';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';
import { RouterLinksDirective } from '../directives/router-links.directive';

@Component({
  selector: 'app-post-page',
  standalone: true,
  imports: [SafeHtmlPipe, RouterLinksDirective],
  templateUrl: './post-page.component.html',
})
export class PostPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private topicService = inject(TopicService);

  post = this.topicService.singlePost;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(paramMap => {
      const id = Number(paramMap.get('id'));
      if (id) {
        this.topicService.loadPost(id).subscribe({
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
