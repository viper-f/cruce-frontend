import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { ApiService } from '../../services/api.service';

type FileKey = 'favicon' | 'custom_style' | 'main_style';
type UploadState = 'idle' | 'loading' | 'success' | 'error';

export interface DesignVariation {
  id: number;
  class_name: string | null;
  name: string | null;
}

interface StaticFile {
  file_name: string;
  file_created_date: string;
  file_type: string;
}

const FILE_TYPE: Record<FileKey, string> = {
  favicon: 'favicon.ico',
  custom_style: 'custom_style.css',
  main_style: 'main_style.css',
};

let tempId = -1;

@Component({
  selector: 'app-admin-design',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './admin-design.component.html',
  styleUrl: './admin-design.component.css'
})
export class AdminDesignComponent implements OnInit {
  private apiService = inject(ApiService);

  variations = signal<DesignVariation[]>([]);
  variationsSaveState = signal<UploadState>('idle');

  faviconVersions = signal<StaticFile[]>([]);
  customStyleVersions = signal<StaticFile[]>([]);
  mainStyleVersions = signal<StaticFile[]>([]);

  uploadStates = signal<Record<FileKey, UploadState>>({
    favicon: 'idle',
    custom_style: 'idle',
    main_style: 'idle',
  });

  ngOnInit() {
    this.loadVariations();
    this.loadFileVersions('favicon');
    this.loadFileVersions('custom_style');
    this.loadFileVersions('main_style');
  }

  private loadFileVersions(key: FileKey) {
    this.apiService.get<StaticFile[]>(`static-file/list/${FILE_TYPE[key]}`).subscribe({
      next: (files) => this.setVersions(key, files),
      error: (err) => console.error(`Failed to load ${FILE_TYPE[key]} versions`, err)
    });
  }

  private loadVariations() {
    this.apiService.get<DesignVariation[]>('design-variation/list').subscribe({
      next: (list) => this.variations.set(list),
      error: (err) => console.error('Failed to load design variations', err)
    });
  }

  addVariation() {
    this.variations.update(vs => [...vs, { id: tempId--, class_name: null, name: null }]);
  }

  removeVariation(id: number) {
    if (id > 0) {
      this.apiService.get(`design-variation/delete/${id}`).subscribe({
        error: (err) => console.error('Failed to delete variation', err)
      });
    }
    this.variations.update(vs => vs.filter(v => v.id !== id));
  }

  saveVariations() {
    this.variationsSaveState.set('loading');

    const calls = this.variations().map(v =>
      v.id > 0
        ? this.apiService.post(`design-variation/update/${v.id}`, { class_name: v.class_name, name: v.name })
        : this.apiService.post<DesignVariation>('design-variation/create', { class_name: v.class_name, name: v.name })
    );

    (calls.length ? forkJoin(calls) : of([])).subscribe({
      next: () => {
        this.loadVariations();
        this.flashVariationsState('success');
      },
      error: (err) => {
        console.error('Failed to save variations', err);
        this.flashVariationsState('error');
      }
    });
  }

  private flashVariationsState(state: 'success' | 'error') {
    this.variationsSaveState.set(state);
    setTimeout(() => this.variationsSaveState.set('idle'), 3000);
  }

  onFileSelected(key: FileKey, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file_type', FILE_TYPE[key]);
    formData.append('file', file);

    this.setUploadState(key, 'loading');

    this.apiService.post<StaticFile[]>('static-file/upload', formData).subscribe({
      next: (files) => {
        this.setVersions(key, files);
        this.setUploadState(key, 'success');
        setTimeout(() => this.setUploadState(key, 'idle'), 3000);
        input.value = '';
      },
      error: (err) => {
        console.error(`Failed to upload ${FILE_TYPE[key]}`, err);
        this.setUploadState(key, 'error');
        setTimeout(() => this.setUploadState(key, 'idle'), 3000);
      }
    });
  }

  stateFor(key: FileKey): UploadState {
    return this.uploadStates()[key];
  }

  private setUploadState(key: FileKey, state: UploadState) {
    this.uploadStates.update(s => ({ ...s, [key]: state }));
  }

  private setVersions(key: FileKey, versions: StaticFile[]) {
    if (key === 'favicon') this.faviconVersions.set(versions);
    else if (key === 'custom_style') this.customStyleVersions.set(versions);
    else this.mainStyleVersions.set(versions);
  }
}
