import { Component, inject, Input, NgZone, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImageService } from '../../services/image.service';

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

@Component({
  selector: 'app-cropped-image-field',
  imports: [FormsModule],
  templateUrl: './cropped-image-field.component.html',
  standalone: true,
})
export class CroppedImageFieldComponent implements OnInit {
  @Input() fieldName: string | undefined;
  @Input() fieldValue: string = '';
  @Input() showFieldName: boolean = true;
  @Input() name: string | undefined;
  @Input() width: number | undefined;
  @Input() height: number | undefined;

  private imageService = inject(ImageService);
  private ngZone = inject(NgZone);

  readonly MAX_DISPLAY_W = 560;

  mode: 'upload' | 'url' = 'upload';
  value: string = '';
  uploadState = signal<UploadState>('idle');
  selectedFile: File | null = null;
  errorMessage: string = '';

  // Crop stage
  imageDataUrl: string = '';
  naturalW = 0;
  naturalH = 0;
  displayW = 0;
  displayH = 0;

  // Crop box in display coords
  cropX = 0;
  cropY = 0;
  cropBoxW = 0;
  cropBoxH = 0;

  // Drag
  private dragging = false;
  private dragStartClientX = 0;
  private dragStartClientY = 0;
  private dragStartCropX = 0;
  private dragStartCropY = 0;

  // Resize (bottom-right handle)
  private resizing = false;
  private resizeStartClientX = 0;
  private resizeStartCropW = 0;
  private resizeStartCropH = 0;

  ngOnInit() {
    this.value = this.fieldValue;
    if (this.fieldValue) this.mode = 'url';
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFile = file;
    this.uploadState.set('idle');
    this.errorMessage = '';

    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target!.result as string;
      const img = new Image();
      img.onload = () => {
        this.ngZone.run(() => {
          this.naturalW = img.naturalWidth;
          this.naturalH = img.naturalHeight;
          const scale = Math.min(1, this.MAX_DISPLAY_W / img.naturalWidth);
          this.displayW = Math.round(img.naturalWidth * scale);
          this.displayH = Math.round(img.naturalHeight * scale);
          this.initCropBox();
          this.imageDataUrl = dataUrl;
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  private initCropBox() {
    const aspect = (this.width && this.height) ? this.width / this.height : this.naturalW / this.naturalH;
    const imgAspect = this.displayW / this.displayH;
    if (aspect > imgAspect) {
      this.cropBoxW = this.displayW;
      this.cropBoxH = Math.round(this.cropBoxW / aspect);
    } else {
      this.cropBoxH = this.displayH;
      this.cropBoxW = Math.round(this.cropBoxH * aspect);
    }
    this.cropX = Math.round((this.displayW - this.cropBoxW) / 2);
    this.cropY = Math.round((this.displayH - this.cropBoxH) / 2);
  }

  // --- Drag crop box ---
  onCropMouseDown(event: MouseEvent) {
    this.dragging = true;
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.dragStartCropX = this.cropX;
    this.dragStartCropY = this.cropY;
    event.preventDefault();
    event.stopPropagation();
  }

  // --- Resize handle ---
  onResizeMouseDown(event: MouseEvent) {
    this.resizing = true;
    this.resizeStartClientX = event.clientX;
    this.resizeStartCropW = this.cropBoxW;
    this.resizeStartCropH = this.cropBoxH;
    event.preventDefault();
    event.stopPropagation();
  }

  onContainerMouseMove(event: MouseEvent) {
    if (this.dragging) {
      const dx = event.clientX - this.dragStartClientX;
      const dy = event.clientY - this.dragStartClientY;
      this.cropX = Math.max(0, Math.min(this.displayW - this.cropBoxW, this.dragStartCropX + dx));
      this.cropY = Math.max(0, Math.min(this.displayH - this.cropBoxH, this.dragStartCropY + dy));
    }
    if (this.resizing) {
      const aspect = (this.width && this.height) ? this.width / this.height : this.cropBoxW / this.cropBoxH;
      const dx = event.clientX - this.resizeStartClientX;
      const newW = Math.max(40, Math.min(this.displayW - this.cropX, this.resizeStartCropW + dx));
      const newH = Math.round(newW / aspect);
      if (this.cropY + newH <= this.displayH) {
        this.cropBoxW = newW;
        this.cropBoxH = newH;
      }
    }
  }

  onContainerMouseUp() {
    this.dragging = false;
    this.resizing = false;
  }

  cancelCrop() {
    this.imageDataUrl = '';
    this.selectedFile = null;
  }

  cropAndUpload() {
    if (!this.selectedFile || !this.imageDataUrl) return;
    this.uploadState.set('uploading');

    const scale = this.naturalW / this.displayW;
    const srcX = Math.round(this.cropX * scale);
    const srcY = Math.round(this.cropY * scale);
    const srcW = Math.round(this.cropBoxW * scale);
    const srcH = Math.round(this.cropBoxH * scale);
    const targetW = this.width ?? srcW;
    const targetH = this.height ?? srcH;

    const img = new Image();
    img.onload = () => {
      this.ngZone.run(() => {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.getContext('2d')!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);
        canvas.toBlob(blob => {
          if (!blob) { this.uploadState.set('error'); return; }
          const file = new File([blob], this.selectedFile!.name, { type: 'image/jpeg' });
          this.imageService.upload(file).subscribe({
            next: res => { this.value = res.url; this.uploadState.set('done'); this.imageDataUrl = ''; },
            error: () => { this.errorMessage = 'Upload failed. Please try again.'; this.uploadState.set('error'); }
          });
        }, 'image/jpeg', 0.92);
      });
    };
    img.src = this.imageDataUrl;
  }
}
