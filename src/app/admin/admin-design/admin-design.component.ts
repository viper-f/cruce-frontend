import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { SaveButtonComponent } from '../save-button/save-button.component';

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

interface AssetFile {
  name: string;
  mod_time: string;
}

const FILE_TYPE: Record<FileKey, string> = {
  favicon: 'favicon.ico',
  custom_style: 'custom_style.css',
  main_style: 'main_style.css',
};

let tempId = -1;

@Component({
  selector: 'app-admin-design',
  host: { class: 'pun-page' },
  imports: [ FormsModule, SaveButtonComponent, DatePipe],
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

  assetFiles = signal<AssetFile[]>([]);
  assetUploadState = signal<UploadState>('idle');
  deletingAsset = signal<string | null>(null);

  ngOnInit() {
    this.loadVariations();
    this.loadFileVersions('favicon');
    this.loadFileVersions('custom_style');
    this.loadFileVersions('main_style');
    this.loadAssets();
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

  private loadAssets() {
    this.apiService.get<AssetFile[]>('asset/list').subscribe({
      next: (files) => this.assetFiles.set(files),
      error: (err) => console.error('Failed to load assets', err)
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

  onAssetSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    this.assetUploadState.set('loading');

    this.apiService.post<{ files: AssetFile[] }>('asset/upload', formData).subscribe({
      next: (res) => {
        this.assetFiles.set(res.files);
        this.assetUploadState.set('success');
        setTimeout(() => this.assetUploadState.set('idle'), 3000);
        input.value = '';
      },
      error: (err) => {
        console.error('Failed to upload asset', err);
        this.assetUploadState.set('error');
        setTimeout(() => this.assetUploadState.set('idle'), 3000);
      }
    });
  }

  deleteAsset(name: string) {
    this.deletingAsset.set(name);
    this.apiService.post<{ files: AssetFile[] }>('asset/delete', { name }).subscribe({
      next: (res) => {
        this.assetFiles.set(res.files);
        this.deletingAsset.set(null);
      },
      error: (err) => {
        console.error('Failed to delete asset', err);
        this.deletingAsset.set(null);
      }
    });
  }

  revertingFile = signal<string | null>(null);

  revert(file: StaticFile, key: FileKey) {
    this.revertingFile.set(file.file_name);
    this.apiService.post('static-file/revert', { file_name: file.file_name }).subscribe({
      next: () => {
        this.revertingFile.set(null);
        this.loadFileVersions(key);
      },
      error: (err) => {
        console.error('Failed to revert file', err);
        this.revertingFile.set(null);
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
