import { Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { ImageService } from '../../services/image.service';

interface ImageEntry {
  id: number;
  file: File | null;
  state: 'idle' | 'uploading' | 'done' | 'error';
  url: string;
  thumbnailUrl: string;
  error: string;
}

@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [],
  templateUrl: './image-upload.component.html',
})
export class ImageUploadComponent {
  @Output() close = new EventEmitter<void>();
  @Output() insert = new EventEmitter<string>();

  private imageService = inject(ImageService);

  private nextId = 0;
  entries = signal<ImageEntry[]>([this.newEntry()]);

  private newEntry(): ImageEntry {
    return { id: this.nextId++, file: null, state: 'idle', url: '', thumbnailUrl: '', error: '' };
  }

  private updateEntry(id: number, patch: Partial<ImageEntry>) {
    this.entries.update(list => list.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  addField() {
    this.entries.update(list => [...list, this.newEntry()]);
  }

  onFileChange(event: Event, entry: ImageEntry) {
    const input = event.target as HTMLInputElement;
    this.updateEntry(entry.id, { file: input.files?.[0] ?? null });
  }

  get hasFilesToUpload(): boolean {
    return this.entries().some(e => e.state === 'idle' && e.file !== null);
  }

  upload() {
    const toUpload = this.entries().filter(e => e.state === 'idle' && e.file !== null);
    for (const entry of toUpload) {
      this.updateEntry(entry.id, { state: 'uploading' });
      this.imageService.upload(entry.file!).subscribe({
        next: (res) => {
          this.updateEntry(entry.id, { url: res.url, thumbnailUrl: res.thumbnail_url, state: 'done' });
        },
        error: () => {
          this.updateEntry(entry.id, { error: 'Upload failed. Please try again.', state: 'error' });
        }
      });
    }
  }

  insertUrl(url: string) {
    this.insert.emit(url);
  }

  retry(entry: ImageEntry) {
    this.updateEntry(entry.id, { state: 'idle', file: null, error: '' });
  }

  remove(entry: ImageEntry) {
    this.entries.update(list => {
      const filtered = list.filter(e => e.id !== entry.id);
      return filtered.length > 0 ? filtered : [this.newEntry()];
    });
  }
}
