import {Component, inject, Input, OnInit, numberAttribute, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink, ActivatedRoute} from '@angular/router';
import {ForumService} from '../services/forum.service';
import {BoardService} from '../services/board.service';
import {TopicType} from '../models/Topic';
import {BreadcrumbItem, BreadcrumbsComponent} from '../components/breadcrumbs/breadcrumbs.component';

function coerceToPage(value: unknown): number {
  const num = numberAttribute(value, 1);
  return num < 1 ? 1 : num;
}

@Component({
  selector: 'app-active-topics',
  imports: [CommonModule, RouterLink, BreadcrumbsComponent],
  templateUrl: './active-topics.component.html',
  standalone: true,
})
export class ActiveTopicsComponent implements OnInit {
  forumService = inject(ForumService);
  boardService = inject(BoardService);
  route = inject(ActivatedRoute);

  @Input({ transform: coerceToPage, alias: 'page' }) pageNumber: number = 1;

  topics = this.forumService.activeTopics;
  activeTopicsCount = this.forumService.activeTopicsCount;

  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/' },
    { label: 'Active Topics' }
  ];

  TopicType = TopicType;

  topicsPerPage = 20;
  totalPages = computed(() => {
    const totalTopics = this.activeTopicsCount();
    return Math.ceil(totalTopics / this.topicsPerPage);
  });

  ngOnInit() {
    this.forumService.loadActiveTopicsCount();
    this.route.queryParamMap.subscribe(params => {
      const page = coerceToPage(params.get('page'));
      this.forumService.loadActiveTopics(page);
    });
  }
}
