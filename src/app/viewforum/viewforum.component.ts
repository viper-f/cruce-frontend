import {Component, effect, inject, Input, OnInit, OnDestroy, computed, numberAttribute} from '@angular/core';
import {RouterLink, ActivatedRoute} from '@angular/router';
import {ForumService} from '../services/forum.service';
import {BreadcrumbItem, BreadcrumbsComponent} from '../components/breadcrumbs/breadcrumbs.component';
import { Subject, takeUntil, combineLatest } from 'rxjs';

function coerceToPage(value: unknown): number {
  const num = numberAttribute(value, 1);
  return num < 1 ? 1 : num;
}

@Component({
  selector: 'app-viewforum',
  imports: [
    RouterLink,
    BreadcrumbsComponent
  ],
  templateUrl: './viewforum.component.html',
  standalone: true,
})
export class ViewforumComponent implements OnInit, OnDestroy {
  forumService = inject(ForumService);
  route = inject(ActivatedRoute);

  @Input({ transform: numberAttribute }) id?: number;
  @Input({ transform: coerceToPage, alias: 'page' }) pageNumber: number = 1;

  topics = this.forumService.subforumTopics;
  subforum = this.forumService.subforum;

  breadcrumbs: BreadcrumbItem[] = [];

  topicsPerPage = 30;
  totalPages = computed(() => {
    const totalTopics = this.subforum()?.topic_number || 0;
    return Math.ceil(totalTopics / this.topicsPerPage);
  });

  private destroy$ = new Subject<void>();

  constructor() {
    effect(() => {
      const sub = this.subforum();
      if (sub) {
        this.breadcrumbs = [
          { label: 'Home', link: '/' },
          { label: sub.name }
        ];
      }
    });
  }

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([paramMap, queryParamMap]) => {
        const forumId = Number(paramMap.get('id'));
        const page = coerceToPage(queryParamMap.get('page'));

        if (forumId) {
          if (this.subforum().id !== forumId) {
            this.forumService.loadSubforum(forumId);
          }
          this.forumService.loadSubforumPage(forumId, page);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
