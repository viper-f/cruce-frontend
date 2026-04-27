import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryService } from '../../services/category.service';
import { ApiService } from '../../services/api.service';
import { Category } from '../../models/Category';
import { Subforum } from '../../models/Subforum';
import { Topic, TopicStatus } from '../../models/Topic';

interface PanelState {
  view: 'subforums' | 'topics';
  openSubforum: Subforum | null;
  topics: Topic[];
  selectedTopicIds: Set<number>;
  loading: boolean;
}

@Component({
  selector: 'app-topic-commander',
  imports: [CommonModule],
  templateUrl: './topic-commander.component.html',
  standalone: true,
  styleUrl: './topic-commander.component.css'
})
export class TopicCommanderComponent implements OnInit {
  private categoryService = inject(CategoryService);
  private apiService = inject(ApiService);

  categories: Category[] = [];

  left: PanelState = this.createPanel();
  right: PanelState = this.createPanel();

  constructor() {
    effect(() => {
      this.categories = this.categoryService.homeCategories();
    });
  }

  ngOnInit() {
    this.categoryService.loadHomeCategories();
  }

  private createPanel(): PanelState {
    return {
      view: 'subforums',
      openSubforum: null,
      topics: [],
      selectedTopicIds: new Set<number>(),
      loading: false
    };
  }

  openSubforum(panel: PanelState, subforum: Subforum) {
    panel.openSubforum = subforum;
    panel.view = 'topics';
    panel.topics = [];
    panel.selectedTopicIds = new Set();
    panel.loading = true;

    this.apiService.get<Topic[]>(`viewforum/${subforum.id}/1`).subscribe({
      next: (data) => {
        panel.topics = data;
        panel.loading = false;
      },
      error: (err) => {
        console.error('Failed to load topics', err);
        panel.loading = false;
      }
    });
  }

  backToSubforums(panel: PanelState) {
    panel.view = 'subforums';
    panel.openSubforum = null;
    panel.topics = [];
    panel.selectedTopicIds = new Set();
    panel.loading = false;
  }

  toggleTopic(panel: PanelState, topicId: number) {
    if (panel.selectedTopicIds.has(topicId)) {
      panel.selectedTopicIds.delete(topicId);
    } else {
      panel.selectedTopicIds.add(topicId);
    }
    // Trigger change detection by replacing the set reference
    panel.selectedTopicIds = new Set(panel.selectedTopicIds);
  }

  canMoveLeftToRight(): boolean {
    return this.left.view === 'topics'
      && this.right.view === 'topics'
      && this.left.selectedTopicIds.size > 0;
  }

  canMoveRightToLeft(): boolean {
    return this.left.view === 'topics'
      && this.right.view === 'topics'
      && this.right.selectedTopicIds.size > 0;
  }

  hasSelection(panel: PanelState): boolean {
    return panel.view === 'topics' && panel.selectedTopicIds.size > 0;
  }

  moveTopics(from: PanelState, to: PanelState) {
    const topicIds = Array.from(from.selectedTopicIds);
    const body = { subforum_id: to.openSubforum!.id, topic_ids: topicIds };

    this.apiService.post('topics/move', body).subscribe({
      next: () => {
        this.openSubforum(from, from.openSubforum!);
        this.openSubforum(to, to.openSubforum!);
      },
      error: (err) => console.error('Failed to move topics', err)
    });
  }

  closeTopics(panel: PanelState) {
    const topicIds = Array.from(panel.selectedTopicIds);
    this.apiService.post('topics/bulk-update', { topic_ids: topicIds, status: TopicStatus.inactive }).subscribe({
      next: () => this.openSubforum(panel, panel.openSubforum!),
      error: (err) => console.error('Failed to close topics', err)
    });
  }

  openTopics(panel: PanelState) {
    const topicIds = Array.from(panel.selectedTopicIds);
    this.apiService.post('topics/bulk-update', { topic_ids: topicIds, status: TopicStatus.active }).subscribe({
      next: () => this.openSubforum(panel, panel.openSubforum!),
      error: (err) => console.error('Failed to open topics', err)
    });
  }

  makeStickyTopics(panel: PanelState) {
    const topicIds = Array.from(panel.selectedTopicIds);
    this.apiService.post('topics/bulk-update', { topic_ids: topicIds, is_sticky: true }).subscribe({
      next: () => this.openSubforum(panel, panel.openSubforum!),
      error: (err) => console.error('Failed to make topics sticky', err)
    });
  }

  removeStickyTopics(panel: PanelState) {
    const topicIds = Array.from(panel.selectedTopicIds);
    this.apiService.post('topics/bulk-update', { topic_ids: topicIds, is_sticky: false }).subscribe({
      next: () => this.openSubforum(panel, panel.openSubforum!),
      error: (err) => console.error('Failed to remove sticky from topics', err)
    });
  }

  deleteTopics(panel: PanelState) {
    const topicIds = Array.from(panel.selectedTopicIds);
    console.log(`[MOCK] Deleting topics ${topicIds.join(', ')}`);
    // TODO: this.apiService.post('topic/delete', { topic_ids: topicIds }).subscribe(...)
  }
}
