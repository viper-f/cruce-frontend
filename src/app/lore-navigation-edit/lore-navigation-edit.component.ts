import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { LorePage, LorePageInfo, LoreTopicPostRow } from '../models/LorePage';

interface EditState {
  name: string;
  order: number;
  is_hidden: boolean;
}

@Component({
  selector: 'app-lore-navigation-edit',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './lore-navigation-edit.component.html',
})
export class LoreNavigationEditComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);

  topicId = signal<number>(0);
  rows = signal<LoreTopicPostRow[]>([]);

  // postId -> EditState for currently editing or creating rows
  editingMap: Record<number, EditState> = {};

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(paramMap => {
      const id = Number(paramMap.get('id'));
      if (id) {
        this.topicId.set(id);
        this.loadRows(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadRows(topicId: number) {
    this.apiService.get<LoreTopicPostRow[]>(`lore-topic/${topicId}/posts`).subscribe({
      next: (data) => this.rows.set(data),
      error: (err) => console.error('Failed to load lore topic posts', err)
    });
  }

  startEdit(row: LoreTopicPostRow) {
    this.editingMap = {
      ...this.editingMap,
      [row.id]: {
        name: row.lore_page?.name ?? '',
        order: row.lore_page?.order ?? 0,
        is_hidden: row.lore_page?.is_hidden ?? false,
      }
    };
  }

  cancelEdit(row: LoreTopicPostRow) {
    const updated = { ...this.editingMap };
    delete updated[row.id];
    this.editingMap = updated;
  }

  isEditing(row: LoreTopicPostRow): boolean {
    return row.id in this.editingMap;
  }

  save(row: LoreTopicPostRow) {
    const state = this.editingMap[row.id];
    if (!state) return;

    const payload: LorePage = {
      post_id: row.id,
      name: state.name,
      order: state.order,
      is_hidden: state.is_hidden,
    };

    const isCreate = row.lore_page === null;
    const endpoint = isCreate ? 'lore-page/create' : `lore-page/update/${row.id}`;

    this.apiService.post<LorePageInfo>(endpoint, payload).subscribe({
      next: (updated) => {
        this.rows.update(list => list.map(r => r.id === row.id ? { ...r, lore_page: updated } : r));
        this.cancelEdit(row);
      },
      error: (err) => console.error('Failed to save lore page', err)
    });
  }

  delete(row: LoreTopicPostRow) {
    this.apiService.get<void>(`lore-page/delete/${row.id}`).subscribe({
      next: () => {
        this.rows.update(list => list.map(r => r.id === row.id ? { ...r, lore_page: null } : r));
        this.cancelEdit(row);
      },
      error: (err) => console.error('Failed to delete lore page', err)
    });
  }
}
