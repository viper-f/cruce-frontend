import { Component, inject, Input, signal } from '@angular/core';

import { ImageUploadComponent } from '../image-upload/image-upload.component';
import { GridBuilderComponent } from '../grid-builder/grid-builder.component';
import { ApiService } from '../../services/api.service';
import { SmileCategoryWithSmiles } from '../../models/Smile';
import { WysiwygEditorComponent } from '../wysiwyg-editor/wysiwyg-editor.component';

@Component({
  selector: 'app-bb-toolbar',
  standalone: true,
  imports: [ ImageUploadComponent, GridBuilderComponent],
  templateUrl: './bb-toolbar.component.html',
})
export class BbToolbarComponent {
  private apiService = inject(ApiService);

  @Input() textarea: HTMLTextAreaElement | null = null;
  @Input() editor: WysiwygEditorComponent | null = null;
  @Input() showSpoiler = true;
  @Input() showImageUpload = true;

  activeArea: string | null = null;
  showSpoilerModal = false;
  hasUrlSelection = false;
  private spoilerSelStart = 0;
  private spoilerSelEnd = 0;
  private urlSelStart = 0;
  private urlSelEnd = 0;

  smileCategories = signal<SmileCategoryWithSmiles[]>([]);
  private smilesLoaded = false;

  fonts = ['Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Impact'];
  colors = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 'gray', 'silver'];

  toggleArea(area: string) {
    this.activeArea = this.activeArea === area ? null : area;
    if (this.activeArea === 'url') {
      if (this.editor) {
        this.editor.saveSelection();
        const sel = window.getSelection();
        this.hasUrlSelection = !!sel && !sel.isCollapsed;
      } else if (this.textarea) {
        this.urlSelStart = this.textarea.selectionStart;
        this.urlSelEnd = this.textarea.selectionEnd;
        this.hasUrlSelection = this.urlSelStart !== this.urlSelEnd;
      }
    }
    if (area === 'smile' && this.activeArea === 'smile' && !this.smilesLoaded) {
      this.smilesLoaded = true;
      this.apiService.get<SmileCategoryWithSmiles[]>('smiles').subscribe({
        next: (data) => this.smileCategories.set(data),
        error: (err) => console.error('Failed to load smiles', err)
      });
    }
  }

  insertUrl(url: string, linkText: string) {
    if (!url) { this.activeArea = null; return; }
    if (this.editor) {
      this.editor.restoreSelection();
      if (linkText) {
        this.editor.insertHtmlAtCursor(`<a href="${url}">${linkText}</a>`);
      } else {
        this.editor.exec('createLink', url);
      }
      this.activeArea = null;
      return;
    }
    if (!this.textarea) return;
    const text = this.textarea.value;
    const selected = text.substring(this.urlSelStart, this.urlSelEnd);
    const label = linkText || selected || url;
    const tag = `[url=${url}]${label}[/url]`;
    this.textarea.value = text.substring(0, this.urlSelStart) + tag + text.substring(this.urlSelEnd);
    this.activeArea = null;
    this.textarea.focus();
    this.textarea.setSelectionRange(this.urlSelStart + tag.length, this.urlSelStart + tag.length);
  }

  isFormatActive(tag: string): boolean {
    return this.editor?.activeFormats().has(tag) ?? false;
  }

  private normalizedColorCache = new Map<string, string>();
  private normalizeColor(color: string): string {
    if (!this.normalizedColorCache.has(color)) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      this.normalizedColorCache.set(color, `rgb(${r}, ${g}, ${b})`);
    }
    return this.normalizedColorCache.get(color)!;
  }

  isColorActive(color: string): boolean {
    const active = this.editor?.activeColor();
    return !!active && this.normalizeColor(color) === active;
  }

  isSizeActive(size: number): boolean {
    return this.editor?.activeFontSize() === size;
  }

  isFontActive(font: string): boolean {
    const active = this.editor?.activeFontFamily();
    return !!active && active === font.toLowerCase();
  }

  getActiveColor(): string | null {
    return this.editor?.activeColor() ?? null;
  }

  getActiveSize(): number | null {
    return this.editor?.activeFontSize() ?? null;
  }

  getActiveFont(): string | null {
    return this.editor?.activeFontFamily() ?? null;
  }

  private applyInlineSpan(ed: WysiwygEditorComponent, configure: (el: HTMLSpanElement) => void): void {
    const sel = window.getSelection();
    const span = document.createElement('span');
    configure(span);
    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      const range = sel.getRangeAt(0);
      try {
        range.surroundContents(span);
      } catch {
        span.appendChild(range.extractContents());
        range.insertNode(span);
      }
      // Collapse cursor to end of span content using sel.collapse (not removeAllRanges)
      // so the editor keeps focus and updateInlineStyles() detects the new format
      let target: Node = span;
      while (target.lastChild) target = target.lastChild;
      sel.collapse(target, target.nodeType === Node.TEXT_NODE ? (target as Text).length : 0);
    } else {
      span.innerHTML = '&#8203;';
      ed.insertHtmlAtCursor(span.outerHTML);
    }
  }

  private clearStyleInSelection(property: 'color' | 'fontSize' | 'fontFamily'): void {
    const ed = this.editor;
    if (!ed) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    const walker = document.createTreeWalker(ed.nativeElement, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (range.intersectsNode(node)) {
        const el = node as HTMLElement;
        el.style[property] = '';
        if (el.tagName === 'FONT') {
          if (property === 'color') el.removeAttribute('color');
          if (property === 'fontFamily') el.removeAttribute('face');
        }
      }
      node = walker.nextNode();
    }

    if (property === 'color') ed.setActiveColor(null);
    if (property === 'fontSize') ed.setActiveFontSize(null);
    if (property === 'fontFamily') ed.setActiveFontFamily(null);
  }

  insertTag(tag: string) {
    if (this.editor) {
      this.insertTagWysiwyg(tag);
      return;
    }
    if (!this.textarea) return;

    const textarea = this.textarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const tagBase = tag.split('=')[0];
    const openTag = tagBase === 'font' ? `[font="${tag.slice(5)}"]` : `[${tag}]`;
    const closeTag = `[/${tagBase}]`;

    const selectedText = text.substring(start, end);
    textarea.value = text.substring(0, start) + openTag + selectedText + closeTag + text.substring(end);

    textarea.focus();
    const newPos = start + openTag.length + selectedText.length;
    textarea.setSelectionRange(newPos, newPos);
  }

  private insertTagWysiwyg(tag: string) {
    const ed = this.editor!;
    switch (tag) {
      case 'b':      ed.exec('bold'); break;
      case 'i':      ed.exec('italic'); break;
      case 'u':      ed.exec('underline'); break;
      case 's':      ed.exec('strikeThrough'); break;
      case 'left':   ed.exec('justifyLeft'); break;
      case 'center': ed.exec('justifyCenter'); break;
      case 'right':  ed.exec('justifyRight'); break;
      case 'quote':
        if (this.isFormatActive('quote')) {
          ed.unwrapBlock('blockquote');
          ed.focus();
        } else {
          ed.insertBlockAtCursor('<blockquote><br></blockquote><div><br></div>', 'blockquote');
          ed.focus();
        }
        break;
      case 'code':
        if (this.isFormatActive('code')) {
          ed.unwrapBlock('.wysiwyg-code', 'pre');
          ed.focus();
        } else {
          ed.insertBlockAtCursor('<div class="wysiwyg-code"><pre><br></pre></div><div><br></div>', 'pre');
          ed.focus();
        }
        break;
      case 'spoiler':
        if (this.isFormatActive('spoiler')) {
          ed.unwrapBlock('.wysiwyg-spoiler', '.wysiwyg-spoiler-content');
          ed.focus();
        } else {
          ed.insertBlockAtCursor(
            '<div class="wysiwyg-spoiler" data-title="Spoiler"><div class="wysiwyg-spoiler-header">Spoiler</div><div class="wysiwyg-spoiler-content">&nbsp;</div></div><div><br></div>',
            '.wysiwyg-spoiler-content'
          );
          ed.focus();
        }
        break;
      case 'video':
      case 'audio':
        ed.insertTextAtCursor(`[${tag}][/${tag}]`);
        break;
      default: {
        if (tag.startsWith('font=')) {
          const font = tag.slice(5);
          if (this.isFontActive(font)) {
            this.clearStyleInSelection('fontFamily');
          } else {
            this.applyInlineSpan(ed, el => { el.style.fontFamily = font; });
            ed.setActiveFontFamily(font.toLowerCase());
          }
          break;
        }
        if (tag.startsWith('color=')) {
          const color = tag.slice(6);
          if (this.isColorActive(color)) {
            this.clearStyleInSelection('color');
          } else {
            this.applyInlineSpan(ed, el => { el.style.color = color; });
            ed.setActiveColor(this.normalizeColor(color));
          }
          break;
        }
        if (tag.startsWith('size=')) {
          const sizePx = tag.slice(5);
          if (this.isSizeActive(parseInt(sizePx))) {
            this.clearStyleInSelection('fontSize');
          } else {
            this.applyInlineSpan(ed, el => {
              el.style.fontSize = `${sizePx}px`;
              el.dataset['userFontSize'] = 'true';
            });
            ed.setActiveFontSize(parseInt(sizePx));
          }
          break;
        }
        ed.insertTextAtCursor(`[${tag}][/${tag.split('=')[0]}]`);
      }
    }
  }

  openSpoilerModal() {
    if (this.editor) {
      this.insertTag('spoiler');
      return;
    }
    if (!this.textarea) return;
    this.spoilerSelStart = this.textarea.selectionStart;
    this.spoilerSelEnd = this.textarea.selectionEnd;
    this.showSpoilerModal = true;
  }

  insertSpoiler(title: string) {
    if (!this.textarea) return;
    const textarea = this.textarea;
    const text = textarea.value;
    const selectedText = text.substring(this.spoilerSelStart, this.spoilerSelEnd);
    const tag = `[spoiler=${title}]${selectedText}[/spoiler]`;
    textarea.value = text.substring(0, this.spoilerSelStart) + tag + text.substring(this.spoilerSelEnd);
    this.showSpoilerModal = false;
    textarea.focus();
    textarea.setSelectionRange(this.spoilerSelStart + tag.length, this.spoilerSelStart + tag.length);
  }

  insertGrid(bbCode: string) {
    if (this.editor) {
      this.editor.insertTextAtCursor(bbCode);
      this.activeArea = null;
      this.editor.focus();
      return;
    }
    if (!this.textarea) return;
    const textarea = this.textarea;
    const start = textarea.selectionStart;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + bbCode + text.substring(start);
    this.activeArea = null;
    textarea.focus();
    textarea.setSelectionRange(start + bbCode.length, start + bbCode.length);
  }

  onInsertImage(url: string) {
    if (this.editor) {
      this.editor.insertHtmlAtCursor(`<img src="${url}" style="max-width:100%">`);
      this.activeArea = null;
      return;
    }
    if (!this.textarea) return;
    const textarea = this.textarea;
    const start = textarea.selectionStart;
    const text = textarea.value;
    const tag = `[img]${url}[/img]`;
    textarea.value = text.substring(0, start) + tag + text.substring(start);
    textarea.focus();
    textarea.setSelectionRange(start + tag.length, start + tag.length);
  }

  insertSmile(url: string) {
    if (this.editor) {
      this.editor.insertHtmlAtCursor(`<img src="${url}" class="smile">`);
      this.activeArea = null;
      return;
    }
    if (!this.textarea) return;
    const textarea = this.textarea;
    const start = textarea.selectionStart;
    const text = textarea.value;
    const tag = `[img]${url}[/img]`;
    textarea.value = text.substring(0, start) + tag + text.substring(start);
    textarea.focus();
    textarea.setSelectionRange(start + tag.length, start + tag.length);
  }
}
