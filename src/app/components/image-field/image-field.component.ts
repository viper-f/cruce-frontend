import { Component, inject, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImageService } from '../../services/image.service';

@Component({
  selector: 'app-image-field',
  imports: [FormsModule],
  templateUrl: './image-field.component.html',
  standalone: true,
})
export class ImageFieldComponent implements OnInit {
  @Input() fieldName: string | undefined;
  @Input() fieldValue: string = '';
  @Input() showFieldName: boolean = true;
  @Input() name: string | undefined;

  private imageService = inject(ImageService);

  mode: 'upload' | 'url' = 'upload';
  value: string = '';
  uploadState: 'idle' | 'uploading' | 'done' | 'error' = 'idle';
  selectedFile: File | null = null;
  errorMessage: string = '';

  ngOnInit() {
    this.value = this.fieldValue;
    if (this.fieldValue) {
      this.mode = 'url';
    }
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    this.uploadState = 'idle';
    this.errorMessage = '';
  }

  upload() {
    if (!this.selectedFile) return;
    this.uploadState = 'uploading';
    this.imageService.upload(this.selectedFile).subscribe({
      next: (res) => {
        this.value = res.url;
        this.uploadState = 'done';
      },
      error: () => {
        this.errorMessage = 'Upload failed. Please try again.';
        this.uploadState = 'error';
      }
    });
  }
}
