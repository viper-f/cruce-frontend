import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Category } from '../../models/Category';
import { Subforum } from '../../models/Subforum';
import { BbToolbarComponent } from '../../components/bb-toolbar/bb-toolbar.component';

type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface NewSubforum {
  _tempId: number;
  name: string;
  description: string;
  position: number;
  category_id: number;
}

interface NewCategory {
  _tempId: number;
  name: string;
  position: number;
}

@Component({
  selector: 'app-admin-subforums',
  imports: [CommonModule, FormsModule, BbToolbarComponent],
  templateUrl: './admin-subforums.component.html',
  standalone: true,
  styleUrl: './admin-subforums.component.css'
})
export class AdminSubforumsComponent implements OnInit {
  private apiService = inject(ApiService);

  categories: Category[] = [];

  newSubforums: Record<number, NewSubforum[]> = {};
  newCategories: NewCategory[] = [];

  updateStates = signal<Record<string, ActionState>>({});
  deleteStates = signal<Record<string, ActionState>>({});
  createStates = signal<Record<number, ActionState>>({});

  private tempIdCounter = 0;

  ngOnInit() {
    this.loadAdminCategories();
  }

  private loadAdminCategories() {
    this.apiService.get<Category[]>('admin/home').subscribe({
      next: (data) => {
        const copy: Category[] = JSON.parse(JSON.stringify(data));
        for (const cat of copy) {
          for (const sub of cat.subforums) {
            sub.category_id = cat.id;
          }
        }
        this.categories = copy;
      },
      error: (err) => console.error('Failed to load admin categories', err)
    });
  }

  getUpdateState(key: string): ActionState {
    return this.updateStates()[key] ?? 'idle';
  }

  getDeleteState(key: string): ActionState {
    return this.deleteStates()[key] ?? 'idle';
  }

  getCreateState(tempId: number): ActionState {
    return this.createStates()[tempId] ?? 'idle';
  }

  updateCategory(category: Category) {
    const key = `cat-${category.id}`;
    this.setUpdateState(key, 'loading');
    this.apiService.post(`category/update/${category.id}`, category).subscribe({
      next: () => this.flashUpdateState(key, 'success'),
      error: () => this.flashUpdateState(key, 'error')
    });
  }

  deleteCategory(id: number) {
    const key = `cat-${id}`;
    this.setDeleteState(key, 'loading');
    this.apiService.get(`category/delete/${id}`).subscribe({
      next: () => {
        this.flashDeleteState(key, 'success');
        this.loadAdminCategories();
      },
      error: () => this.flashDeleteState(key, 'error')
    });
  }

  updateSubforum(subforum: Subforum, descEl: HTMLTextAreaElement) {
    const key = `sub-${subforum.id}`;
    this.setUpdateState(key, 'loading');
    const body = {
      name: subforum.name,
      position: subforum.position,
      category_id: subforum.category_id,
      description: descEl.value
    };
    this.apiService.post(`subforum/update/${subforum.id}`, body).subscribe({
      next: () => this.flashUpdateState(key, 'success'),
      error: () => this.flashUpdateState(key, 'error')
    });
  }

  deleteSubforum(id: number) {
    const key = `sub-${id}`;
    this.setDeleteState(key, 'loading');
    this.apiService.get(`subforum/delete/${id}`).subscribe({
      next: () => {
        this.flashDeleteState(key, 'success');
        this.loadAdminCategories();
      },
      error: () => this.flashDeleteState(key, 'error')
    });
  }

  addNewSubforum(categoryId: number) {
    if (!this.newSubforums[categoryId]) {
      this.newSubforums[categoryId] = [];
    }
    this.newSubforums[categoryId].push({
      _tempId: ++this.tempIdCounter,
      name: '',
      description: '',
      position: 0,
      category_id: categoryId
    });
  }

  removeNewSubforum(categoryId: number, tempId: number) {
    this.newSubforums[categoryId] = this.newSubforums[categoryId].filter(s => s._tempId !== tempId);
  }

  createSubforum(categoryId: number, draft: NewSubforum, descEl: HTMLTextAreaElement) {
    this.setCreateState(draft._tempId, 'loading');
    const { _tempId, ...rest } = draft;
    const body = { ...rest, description: descEl.value };
    this.apiService.post('subforum/create', body).subscribe({
      next: () => {
        this.setCreateState(_tempId, 'success');
        this.loadAdminCategories();
        setTimeout(() => this.removeNewSubforum(categoryId, _tempId), 1500);
      },
      error: () => this.flashCreateState(_tempId, 'error')
    });
  }

  addNewCategory() {
    this.newCategories.push({
      _tempId: ++this.tempIdCounter,
      name: '',
      position: 0
    });
  }

  removeNewCategory(tempId: number) {
    this.newCategories = this.newCategories.filter(c => c._tempId !== tempId);
  }

  createCategory(draft: NewCategory) {
    this.setCreateState(draft._tempId, 'loading');
    const { _tempId, ...body } = draft;
    this.apiService.post('category/create', body).subscribe({
      next: () => {
        this.setCreateState(_tempId, 'success');
        this.loadAdminCategories();
        setTimeout(() => this.removeNewCategory(_tempId), 1500);
      },
      error: () => this.flashCreateState(_tempId, 'error')
    });
  }

  private setUpdateState(key: string, state: ActionState) {
    this.updateStates.update(s => ({ ...s, [key]: state }));
  }

  private setDeleteState(key: string, state: ActionState) {
    this.deleteStates.update(s => ({ ...s, [key]: state }));
  }

  private setCreateState(tempId: number, state: ActionState) {
    this.createStates.update(s => ({ ...s, [tempId]: state }));
  }

  private flashUpdateState(key: string, state: 'success' | 'error') {
    this.setUpdateState(key, state);
    setTimeout(() => this.setUpdateState(key, 'idle'), 3000);
  }

  private flashDeleteState(key: string, state: 'success' | 'error') {
    this.setDeleteState(key, state);
    setTimeout(() => this.setDeleteState(key, 'idle'), 3000);
  }

  private flashCreateState(tempId: number, state: 'success' | 'error') {
    this.setCreateState(tempId, state);
    setTimeout(() => this.setCreateState(tempId, 'idle'), 3000);
  }
}
