import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Smile, SmileCategory } from '../../models/Smile';

type UploadState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-admin-smiles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-smiles.component.html',
})
export class AdminSmilesComponent implements OnInit {
  private apiService = inject(ApiService);

  categories = signal<SmileCategory[]>([]);
  smiles = signal<Smile[]>([]);
  uploadState = signal<UploadState>('idle');

  newCategoryName = '';
  editingCategory: SmileCategory | null = null;

  newSmileTextForm = '';
  newSmileCategoryId: number | null = null;

  // track the selected category id per smile for the dropdown
  smileCategorySelection: Record<number, number | null> = {};

  ngOnInit() {
    this.loadCategories();
    this.loadSmiles();
  }

  private loadCategories() {
    this.apiService.get<SmileCategory[]>('admin/smile-category/list').subscribe({
      next: (list) => this.categories.set(list),
      error: (err) => console.error('Failed to load smile categories', err)
    });
  }

  private loadSmiles() {
    this.apiService.get<Smile[]>('admin/smile/list').subscribe({
      next: (list) => {
        this.smiles.set(list);
        const selection: Record<number, number | null> = {};
        for (const smile of list) {
          selection[smile.id] = smile.category?.id ?? null;
        }
        this.smileCategorySelection = selection;
      },
      error: (err) => console.error('Failed to load smiles', err)
    });
  }

  createCategory() {
    if (!this.newCategoryName.trim()) return;
    this.apiService.post<SmileCategory>('admin/smile-category/create', { name: this.newCategoryName.trim() }).subscribe({
      next: (created) => {
        this.categories.update(list => [...list, created]);
        this.newCategoryName = '';
      },
      error: (err) => console.error('Failed to create category', err)
    });
  }

  startEditCategory(category: SmileCategory) {
    this.editingCategory = { ...category };
  }

  saveCategory() {
    if (!this.editingCategory) return;
    this.apiService.post<SmileCategory>(`admin/smile-category/update/${this.editingCategory.id}`, { name: this.editingCategory.name }).subscribe({
      next: (updated) => {
        this.categories.update(list => list.map(c => c.id === updated.id ? updated : c));
        this.editingCategory = null;
      },
      error: (err) => console.error('Failed to update category', err)
    });
  }

  cancelEditCategory() {
    this.editingCategory = null;
  }

  deleteCategory(category: SmileCategory) {
    this.apiService.get<void>(`admin/smile-category/delete/${category.id}`).subscribe({
      next: () => this.categories.update(list => list.filter(c => c.id !== category.id)),
      error: (err) => console.error('Failed to delete category', err)
    });
  }

  onSmileCategoryChange(smile: Smile, categoryId: number | null) {
    this.apiService.post(`admin/smile/update-category/${smile.id}`, { category_id: categoryId }).subscribe({
      next: () => {
        const category = categoryId !== null ? this.categories().find(c => c.id === categoryId) ?? null : null;
        this.smiles.update(list => list.map(s => s.id === smile.id ? { ...s, category: category } : s));
      },
      error: (err) => {
        console.error('Failed to update smile category', err);
        // revert selection on error
        this.smileCategorySelection = { ...this.smileCategorySelection, [smile.id]: smile.category?.id ?? null };
      }
    });
  }

  deleteSmile(smile: Smile) {
    this.apiService.get<void>(`admin/smile/delete/${smile.id}`).subscribe({
      next: () => this.smiles.update(list => list.filter(s => s.id !== smile.id)),
      error: (err) => console.error('Failed to delete smile', err)
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (this.newSmileTextForm.trim()) {
      formData.append('text_form', this.newSmileTextForm.trim());
    }
    if (this.newSmileCategoryId !== null) {
      formData.append('category_id', String(this.newSmileCategoryId));
    }

    this.uploadState.set('loading');

    this.apiService.post<Smile>('admin/smile/upload', formData).subscribe({
      next: (smile) => {
        this.smiles.update(list => [...list, smile]);
        this.smileCategorySelection = { ...this.smileCategorySelection, [smile.id]: smile.category?.id ?? null };
        this.uploadState.set('success');
        setTimeout(() => this.uploadState.set('idle'), 3000);
        input.value = '';
        this.newSmileTextForm = '';
        this.newSmileCategoryId = null;
      },
      error: (err) => {
        console.error('Failed to upload smile', err);
        this.uploadState.set('error');
        setTimeout(() => this.uploadState.set('idle'), 3000);
      }
    });
  }
}
