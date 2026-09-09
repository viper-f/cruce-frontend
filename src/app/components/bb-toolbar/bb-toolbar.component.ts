import { Component, inject, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageUploadComponent } from '../image-upload/image-upload.component';
import { ApiService } from '../../services/api.service';
import { SmileCategoryWithSmiles } from '../../models/Smile';

@Component({
  selector: 'app-bb-toolbar',
  standalone: true,
  imports: [CommonModule, ImageUploadComponent],
  templateUrl: './bb-toolbar.component.html',
})
export class BbToolbarComponent {
  private apiService = inject(ApiService);

  @Input() textarea!: HTMLTextAreaElement;
  @Input() showSpoiler = true;
  @Input() showImageUpload = true;

  activeArea: string | null = null;
  showSpoilerModal = false;
  private spoilerSelStart = 0;
  private spoilerSelEnd = 0;

  smileCategories = signal<SmileCategoryWithSmiles[]>([]);
  private smilesLoaded = false;

  fonts = ['Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Impact'];
  colors = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 'gray', 'silver'];

  toggleArea(area: string) {
    this.activeArea = this.activeArea === area ? null : area;
    if (area === 'smile' && this.activeArea === 'smile' && !this.smilesLoaded) {
      this.smilesLoaded = true;
      this.apiService.get<SmileCategoryWithSmiles[]>('smiles').subscribe({
        next: (data) => this.smileCategories.set(data),
        error: (err) => console.error('Failed to load smiles', err)
      });
    }
  }

  insertTag(tag: string) {
    const textarea = this.textarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const tagBase = tag.split('=')[0];
    const openTag = `[${tag}]`;
    const closeTag = `[/${tagBase}]`;

    const selectedText = text.substring(start, end);
    textarea.value = text.substring(0, start) + openTag + selectedText + closeTag + text.substring(end);

    textarea.focus();
    const newPos = start + openTag.length + selectedText.length;
    textarea.setSelectionRange(newPos, newPos);
  }

  openSpoilerModal() {
    this.spoilerSelStart = this.textarea.selectionStart;
    this.spoilerSelEnd = this.textarea.selectionEnd;
    this.showSpoilerModal = true;
  }

  insertSpoiler(title: string) {
    const textarea = this.textarea;
    const text = textarea.value;
    const selectedText = text.substring(this.spoilerSelStart, this.spoilerSelEnd);
    const tag = `[spoiler=${title}]${selectedText}[/spoiler]`;
    textarea.value = text.substring(0, this.spoilerSelStart) + tag + text.substring(this.spoilerSelEnd);
    this.showSpoilerModal = false;
    textarea.focus();
    textarea.setSelectionRange(this.spoilerSelStart + tag.length, this.spoilerSelStart + tag.length);
  }

  onInsertImage(url: string) {
    const textarea = this.textarea;
    const start = textarea.selectionStart;
    const text = textarea.value;
    const tag = `[img]${url}[/img]`;
    textarea.value = text.substring(0, start) + tag + text.substring(start);
    textarea.focus();
    textarea.setSelectionRange(start + tag.length, start + tag.length);
  }

  insertSmile(url: string) {
    const textarea = this.textarea;
    const start = textarea.selectionStart;
    const text = textarea.value;
    const tag = `[img]${url}[/img]`;
    textarea.value = text.substring(0, start) + tag + text.substring(start);
    textarea.focus();
    textarea.setSelectionRange(start + tag.length, start + tag.length);
  }
}
