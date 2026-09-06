import {
  AfterViewInit, Component, computed, ElementRef, inject, Input, OnDestroy, signal, ViewChild,
} from '@angular/core';
import { BoardService } from '../../services/board.service';
import { ImageService } from '../../services/image.service';
import {
  DocModel, BlockNode, ParagraphNode, AlignBlock, DocPoint, DocRange, Mark,
} from './wysiwyg-doc-model';
import { parseBbCode, serializeDoc } from './wysiwyg-doc-bb';
import { renderDoc } from './wysiwyg-doc-renderer';
import { patchDoc } from './wysiwyg-doc-patcher';
import { readDocRange, applyDocRange, domPositionToDocPoint } from './wysiwyg-doc-cursor';
import {
  OpResult,
  insertText as modelInsertText,
  insertImg as modelInsertImg,
  deleteRange as modelDeleteRange,
  splitParagraph as modelSplitParagraph,
  mergeParagraphWithPrevious as modelMergePrevious,
  applyMark, removeMark, toggleMark,
  getMarksAtPoint,
  isCollapsed, pointEq,
  inlineLen,
} from './wysiwyg-doc-ops';

const ORIGIN: DocRange = { anchor: { path: [0], offset: 0 }, focus: { path: [0], offset: 0 } };

@Component({
  selector: 'app-wysiwyg-doc-editor',
  standalone: true,
  styles: [`
    :host .wysiwyg-editor { white-space: pre-wrap; word-wrap: break-word; }
    :host .wysiwyg-editor img { max-width: 100%; height: auto; }
  `],
  template: `
    <div
      #editorEl
      class="wysiwyg-editor"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      [attr.aria-label]="ariaLabel"
      (focus)="onFocus()"
      (blur)="onBlur()"
      (beforeinput)="onBeforeInput($event)"
      (compositionstart)="onCompositionStart()"
      (compositionend)="onCompositionEnd($event)"
      (cut)="onCut($event)"
      (paste)="onPaste($event)"
      (dragover)="onDragOver($event)"
      (drop)="onDrop($event)"
    ></div>
  `,
})
export class WysiwygDocEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorEl', { static: true }) private editorEl!: ElementRef<HTMLDivElement>;

  private imageService = inject(ImageService);
  private boardService = inject(BoardService);

  @Input() ariaLabel = 'Post editor';

  readonly canUpload = computed(() => this.boardService.board().use_image_uploading === 'y');
  readonly activeFormats = signal<Set<string>>(new Set());
  readonly activeColor = signal<string | null>(null);
  readonly activeFontSize = signal<number | null>(null);
  readonly activeFontFamily = signal<string | null>(null);

  setActiveColor(color: string | null) { this.activeColor.set(color); }
  setActiveFontSize(size: number | null) { this.activeFontSize.set(size); }
  setActiveFontFamily(family: string | null) { this.activeFontFamily.set(family); }

  private doc: DocModel = parseBbCode('');
  private cursor: DocRange = { ...ORIGIN };
  private pendingMarks: Mark[] | null = null;
  private focused = false;
  private selectionHandler = () => this.onSelectionChange();

  private undoStack: Array<{ doc: DocModel; cursor: DocRange }> = [];
  private redoStack: Array<{ doc: DocModel; cursor: DocRange }> = [];
  private lastOpGroup: 'insert' | 'delete' | 'other' = 'other';
  private lastOpTime = 0;
  private static readonly GROUP_MS = 500;

  private preCompositionCursor: DocRange | null = null;

  onInput: () => void = () => {};

  constructor() {
    document.addEventListener('selectionchange', this.selectionHandler);
  }

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnDestroy(): void {
    document.removeEventListener('selectionchange', this.selectionHandler);
  }

  get nativeElement(): HTMLDivElement { return this.editorEl.nativeElement; }

  onFocus(): void { this.focused = true; this.updateActiveState(); }
  onBlur():  void { this.focused = false; }

  // ─── IME composition ──────────────────────────────────────────────────────────

  onCompositionStart(): void {
    // Snapshot the cursor so compositionend knows the insertion point regardless
    // of how the browser moves the selection during candidate display.
    this.preCompositionCursor = { ...this.cursor };
  }

  onCompositionEnd(event: CompositionEvent): void {
    const savedCursor = this.preCompositionCursor;
    this.preCompositionCursor = null;
    if (!savedCursor) return;

    // The browser already committed composition text into the DOM. Apply the
    // same change to the model so they stay in sync, then re-render.
    const text = event.data ?? '';

    const base = isCollapsed(savedCursor)
      ? this.doc
      : modelDeleteRange(this.doc, savedCursor).doc;
    const pt = isCollapsed(savedCursor)
      ? savedCursor.anchor
      : modelDeleteRange(this.doc, savedCursor).cursor;

    if (text) {
      const marks = this.pendingMarks ?? getMarksAtPoint(base, pt);
      this.pendingMarks = null;
      this.commitOp(modelInsertText(base, pt, text, marks), 'insert');
      this.onInput();
    } else {
      // Composition cancelled (Escape) — model is already correct; re-render
      // to remove any candidate text the browser left in the DOM.
      this.doc = base;
      this.cursor = { anchor: pt, focus: pt };
      this.render();
      applyDocRange(this.cursor, this.editorEl.nativeElement);
    }
  }

  // ─── beforeinput ─────────────────────────────────────────────────────────────

  onBeforeInput(event: InputEvent): void {
    // During IME composition the browser manages candidate text in the DOM.
    // Preventing default here would break that; compositionend handles the commit.
    if (event.isComposing) return;
    event.preventDefault();

    const range = this.cursor;
    const cursor = range.anchor;

    switch (event.inputType) {
      case 'historyUndo': this.undo(); return;
      case 'historyRedo': this.redo(); return;

      case 'insertText': {
        const text = event.data ?? '';
        if (!text) return;
        const result = isCollapsed(range)
          ? modelInsertText(this.doc, cursor, text, this.pendingMarks ?? getMarksAtPoint(this.doc, cursor))
          : this.deleteAndInsert(range, text);
        this.pendingMarks = null;
        this.commitOp(result, 'insert');
        this.onInput();
        break;
      }

      case 'insertParagraph':
      case 'insertLineBreak': {
        if (isCollapsed(range)) {
          this.pendingMarks = null;
          this.commitOp(modelSplitParagraph(this.doc, cursor));
        } else {
          const del = modelDeleteRange(this.doc, range);
          this.pendingMarks = null;
          this.commitOp(modelSplitParagraph(del.doc, del.cursor));
        }
        this.onInput();
        break;
      }

      case 'deleteContentBackward': {
        if (!isCollapsed(range)) {
          this.commitOp(modelDeleteRange(this.doc, range));
        } else if (cursor.offset > 0) {
          const delRange: DocRange = {
            anchor: { path: cursor.path, offset: cursor.offset - 1 },
            focus: cursor,
          };
          this.commitOp(modelDeleteRange(this.doc, delRange), 'delete');
        } else {
          this.commitOp(modelMergePrevious(this.doc, cursor));
        }
        this.pendingMarks = null;
        this.onInput();
        break;
      }

      case 'deleteContentForward': {
        if (!isCollapsed(range)) {
          this.commitOp(modelDeleteRange(this.doc, range));
        } else {
          const delRange: DocRange = {
            anchor: cursor,
            focus: { path: cursor.path, offset: cursor.offset + 1 },
          };
          this.commitOp(modelDeleteRange(this.doc, delRange), 'delete');
        }
        this.pendingMarks = null;
        this.onInput();
        break;
      }

      case 'deleteWordBackward':
      case 'deleteWordForward':
      case 'deleteSoftLineBackward':
      case 'deleteSoftLineForward':
      case 'deleteHardLineBackward':
      case 'deleteHardLineForward': {
        const targetRanges = (event as InputEvent & { getTargetRanges?(): StaticRange[] }).getTargetRanges?.();
        if (targetRanges && targetRanges.length > 0) {
          const tr = targetRanges[0];
          const anchor = domPositionToDocPoint(tr.startContainer, tr.startOffset, this.editorEl.nativeElement);
          const focus  = domPositionToDocPoint(tr.endContainer,   tr.endOffset,   this.editorEl.nativeElement);
          if (anchor && focus) this.commitOp(modelDeleteRange(this.doc, { anchor, focus }));
        }
        this.pendingMarks = null;
        this.onInput();
        break;
      }
    }
  }

  // The cut event fires before any DOM changes, so window.getSelection() still
  // holds the full selected text. We write it to the clipboard ourselves and
  // delete the range from the model.
  onCut(event: ClipboardEvent): void {
    const range = this.cursor;
    if (isCollapsed(range)) return;

    event.preventDefault();
    event.clipboardData?.setData('text/plain', window.getSelection()?.toString() ?? '');

    this.commitOp(modelDeleteRange(this.doc, range));
    this.pendingMarks = null;
    this.onInput();
  }

  private deleteAndInsert(range: DocRange, text: string): OpResult {
    const del = modelDeleteRange(this.doc, range);
    const marks = this.pendingMarks ?? getMarksAtPoint(del.doc, del.cursor);
    return modelInsertText(del.doc, del.cursor, text, marks);
  }

  // ─── Selection sync ───────────────────────────────────────────────────────────

  // selectionchange is the only place we read the DOM selection — it keeps
  // this.cursor authoritative so every op can read from the model, not the DOM.
  private onSelectionChange(): void {
    if (!this.focused) return;
    const range = readDocRange(this.editorEl.nativeElement);
    if (range) {
      // If the cursor moved and we didn't cause it, break op coalescing so the
      // next keystroke starts a new undo group.
      if (!pointEq(range.anchor, this.cursor.anchor)) this.lastOpGroup = 'other';
      this.cursor = range;
    }
    this.updateActiveState();
    if (this.pendingMarks && (!range || !isCollapsed(range))) {
      this.pendingMarks = null;
    }
  }

  // ─── Commit ───────────────────────────────────────────────────────────────────

  private pushHistory(group: 'insert' | 'delete' | 'other'): void {
    const now = Date.now();
    const coalesce = group !== 'other'
      && group === this.lastOpGroup
      && now - this.lastOpTime < WysiwygDocEditorComponent.GROUP_MS;
    if (!coalesce) {
      this.undoStack.push({ doc: this.doc, cursor: { ...this.cursor } });
      if (this.undoStack.length > 200) this.undoStack.shift();
      this.redoStack = [];
    }
    this.lastOpGroup = group;
    this.lastOpTime = now;
  }

  private commitOp(result: OpResult, group: 'insert' | 'delete' | 'other' = 'other'): void {
    this.pushHistory(group);
    const prevDoc = this.doc;
    this.doc = result.doc;
    this.cursor = { anchor: result.cursor, focus: result.cursor };
    const cursorHandled = patchDoc(this.editorEl.nativeElement, prevDoc, this.doc, result.cursor);
    if (!cursorHandled) applyDocRange(this.cursor, this.editorEl.nativeElement);
    this.updateActiveState();
  }

  private undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push({ doc: this.doc, cursor: { ...this.cursor } });
    const entry = this.undoStack.pop()!;
    this.doc = entry.doc;
    this.cursor = entry.cursor;
    this.lastOpGroup = 'other';
    this.render();
    applyDocRange(this.cursor, this.editorEl.nativeElement);
    this.updateActiveState();
  }

  private redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push({ doc: this.doc, cursor: { ...this.cursor } });
    const entry = this.redoStack.pop()!;
    this.doc = entry.doc;
    this.cursor = entry.cursor;
    this.lastOpGroup = 'other';
    this.render();
    applyDocRange(this.cursor, this.editorEl.nativeElement);
    this.updateActiveState();
  }

  private render(): void {
    this.editorEl.nativeElement.innerHTML = renderDoc(this.doc);
  }

  private updateActiveState(): void {
    const marks = this.pendingMarks ?? getMarksAtPoint(this.doc, this.cursor.anchor);

    const active = new Set<string>();
    for (const m of marks) {
      if (m.type === 'bold')      active.add('b');
      if (m.type === 'italic')    active.add('i');
      if (m.type === 'underline') active.add('u');
      if (m.type === 'strike')    active.add('s');
    }

    const block = this.doc.children[this.cursor.anchor.path[0]];
    if (block) {
      if (block.type === 'code')    active.add('code');
      if (block.type === 'quote')   active.add('quote');
      if (block.type === 'spoiler') active.add('spoiler');
      if (block.type === 'align')   active.add(block.align);
    }

    this.activeFormats.set(active);

    const colorMark = marks.find((m): m is Mark & { type: 'color'; value: string } => m.type === 'color');
    const sizeMark  = marks.find((m): m is Mark & { type: 'size';  value: number } => m.type === 'size');
    const fontMark  = marks.find((m): m is Mark & { type: 'font';  value: string } => m.type === 'font');

    this.activeColor.set(colorMark?.value ?? null);
    this.activeFontSize.set(sizeMark?.value ?? null);
    this.activeFontFamily.set(fontMark?.value ?? null);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  getValue(): string { return serializeDoc(this.doc); }

  setValue(bbCode: string): void {
    this.doc = parseBbCode(bbCode);
    this.cursor = { ...ORIGIN };
    this.undoStack = [];
    this.redoStack = [];
    this.lastOpGroup = 'other';
    this.render();
  }

  clear(): void {
    this.doc = parseBbCode('');
    this.cursor = { ...ORIGIN };
    this.undoStack = [];
    this.redoStack = [];
    this.lastOpGroup = 'other';
    this.render();
  }

  focus(): void {
    const el = this.editorEl.nativeElement;
    if (document.activeElement === el) this.updateActiveState();
    else el.focus();
  }

  exec(command: string, value?: string): void {
    this.editorEl.nativeElement.focus();
    const range = this.cursor;

    switch (command) {
      case 'bold':          this.toggleMarkExec(range, { type: 'bold' }); break;
      case 'italic':        this.toggleMarkExec(range, { type: 'italic' }); break;
      case 'underline':     this.toggleMarkExec(range, { type: 'underline' }); break;
      case 'strikeThrough': this.toggleMarkExec(range, { type: 'strike' }); break;

      case 'justifyLeft':   this.execAlignment(range, 'left'); break;
      case 'justifyCenter': this.execAlignment(range, 'center'); break;
      case 'justifyRight':  this.execAlignment(range, 'right'); break;

      case 'foreColor':
        if (!value) this.removeMarkExec(range, 'color');
        else this.execInlineMark(range, { type: 'color', value });
        break;
      case 'fontSize':
        if (!value) {
          this.removeMarkExec(range, 'size');
        } else {
          const n = parseInt(value);
          if (!isNaN(n)) this.execInlineMark(range, { type: 'size', value: n });
        }
        break;
      case 'fontName':
        if (!value) this.removeMarkExec(range, 'font');
        else this.execInlineMark(range, { type: 'font', value });
        break;
      case 'createLink':
        if (value) this.execInlineMark(range, { type: 'link', href: value });
        break;
    }
  }

  private toggleMarkExec(range: DocRange, mark: Mark): void {
    if (isCollapsed(range)) {
      this.pendingMarks = this.pendingMarksToggled(mark);
      this.updateActiveState();
    } else {
      this.commitOp(toggleMark(this.doc, range, mark));
    }
  }

  private execInlineMark(range: DocRange, mark: Mark): void {
    if (isCollapsed(range)) {
      this.pendingMarks = this.pendingMarksWithMark(mark);
      this.updateActiveState();
    } else {
      this.commitOp(applyMark(this.doc, range, mark));
    }
  }

  private removeMarkExec(range: DocRange, type: Mark['type']): void {
    if (isCollapsed(range)) {
      const current = this.pendingMarks ?? getMarksAtPoint(this.doc, range.anchor);
      this.pendingMarks = current.filter(m => m.type !== type);
      this.updateActiveState();
    } else {
      this.commitOp(removeMark(this.doc, range, type));
    }
  }

  private pendingMarksToggled(mark: Mark): Mark[] {
    const current = this.pendingMarks ?? getMarksAtPoint(this.doc, this.cursor.anchor);
    return current.some(m => m.type === mark.type)
      ? current.filter(m => m.type !== mark.type)
      : [...current, mark];
  }

  private pendingMarksWithMark(mark: Mark): Mark[] {
    const current = this.pendingMarks ?? getMarksAtPoint(this.doc, this.cursor.anchor);
    return [...current.filter(m => m.type !== mark.type), mark];
  }

  private execAlignment(range: DocRange, align: 'left' | 'center' | 'right'): void {
    this.pushHistory('other');
    const blockIdx = range.anchor.path[0];
    if (blockIdx >= this.doc.children.length) return;

    const block = this.doc.children[blockIdx];
    let newChildren: BlockNode[];
    let newCursor: DocPoint = range.anchor;

    if (block.type === 'paragraph') {
      if (align === 'left') {
        newChildren = this.doc.children;
      } else {
        newChildren = [
          ...this.doc.children.slice(0, blockIdx),
          { type: 'align', align, children: [block] } as AlignBlock,
          ...this.doc.children.slice(blockIdx + 1),
        ];
        newCursor = { path: [blockIdx, 0], offset: range.anchor.offset };
      }
    } else if (block.type === 'align') {
      if (align === 'left') {
        const paraIdx = range.anchor.path[1] ?? 0;
        newChildren = [
          ...this.doc.children.slice(0, blockIdx),
          ...block.children,
          ...this.doc.children.slice(blockIdx + 1),
        ];
        newCursor = { path: [blockIdx + paraIdx], offset: range.anchor.offset };
      } else {
        newChildren = [
          ...this.doc.children.slice(0, blockIdx),
          { ...block, align },
          ...this.doc.children.slice(blockIdx + 1),
        ];
      }
    } else {
      return;
    }

    this.doc = { children: newChildren };
    this.cursor = { anchor: newCursor, focus: newCursor };
    this.render();
    applyDocRange(this.cursor, this.editorEl.nativeElement);
    this.updateActiveState();
  }

  // Called by post-form before insertTextAtCursor; with cursor tracking this
  // only needs to ensure the editor div is focused.
  restoreSelection(): void {
    this.editorEl.nativeElement.focus();
  }

  insertHtmlAtCursor(html: string): void {
    const div = document.createElement('div');
    div.innerHTML = html;

    this.editorEl.nativeElement.focus();
    const range  = this.cursor;
    const base   = isCollapsed(range) ? this.doc : modelDeleteRange(this.doc, range).doc;
    const cursor = isCollapsed(range) ? range.anchor : modelDeleteRange(this.doc, range).cursor;

    const sole = div.children.length === 1 && div.childNodes.length === 1
      ? div.children[0] as HTMLElement
      : null;

    if (sole?.tagName === 'IMG') {
      const src = sole.getAttribute('src') ?? '';
      if (src) { this.commitOp(modelInsertImg(base, cursor, src)); return; }
    }

    if (sole?.tagName === 'A') {
      const href = sole.getAttribute('href') ?? '';
      const text = sole.textContent ?? '';
      if (href && text) {
        this.commitOp(modelInsertText(base, cursor, text, [{ type: 'link', href }]));
        this.pendingMarks = null;
        this.onInput();
        return;
      }
    }

    // Fall back: extract text content (handles mentions and other inline spans).
    const text = div.textContent ?? '';
    if (!text) return;
    const marks = this.pendingMarks ?? getMarksAtPoint(base, cursor);
    this.commitOp(modelInsertText(base, cursor, text, marks));
    this.pendingMarks = null;
    this.onInput();
  }

  insertBlockAtCursor(html: string, _cursorSelector?: string): void {
    this.pushHistory('other');
    this.editorEl.nativeElement.focus();
    const blockIdx = this.cursor.anchor.path[0];

    const newBlocks: BlockNode[] = this.parseHtmlToBlocks(html);
    if (newBlocks.length === 0) return;

    const current = this.doc.children[blockIdx];
    const isEmpty = current?.type === 'paragraph' && current.children.length === 0;
    const insertAt = isEmpty ? blockIdx : blockIdx + 1;

    const before = this.doc.children.slice(0, isEmpty ? blockIdx : insertAt);
    const after  = this.doc.children.slice(isEmpty ? blockIdx + 1 : insertAt);

    this.doc = { children: [...before, ...newBlocks, ...after] };
    this.render();

    const firstIdx = before.length;
    const firstBlock = this.doc.children[firstIdx];
    const newCursor: DocPoint = firstBlock.type === 'quote' || firstBlock.type === 'spoiler'
      ? { path: [firstIdx, 0], offset: 0 }
      : { path: [firstIdx], offset: 0 };

    this.cursor = { anchor: newCursor, focus: newCursor };
    applyDocRange(this.cursor, this.editorEl.nativeElement);
    this.updateActiveState();
  }

  private parseHtmlToBlocks(html: string): BlockNode[] {
    const div = document.createElement('div');
    div.innerHTML = html;
    const blocks: BlockNode[] = [];

    for (const child of Array.from(div.children) as HTMLElement[]) {
      if (child.classList.contains('wysiwyg-code')) {
        blocks.push({ type: 'code', text: child.querySelector('pre')?.textContent ?? '' });
      } else if (child.tagName === 'BLOCKQUOTE') {
        const author = child.getAttribute('data-author') ?? undefined;
        blocks.push({ type: 'quote', author, children: [{ type: 'paragraph', children: [] }] });
      } else if (child.classList.contains('wysiwyg-spoiler')) {
        const title = child.querySelector('.wysiwyg-spoiler-header')?.textContent?.trim() ?? 'Spoiler';
        blocks.push({ type: 'spoiler', title, children: [{ type: 'paragraph', children: [] }] });
      } else if (child.tagName === 'DIV') {
        if (!child.className || child.className === '') {
          blocks.push({ type: 'paragraph', children: [] });
        }
      }
    }

    return blocks;
  }

  insertBbCodeBlocks(bbCode: string): void {
    this.pushHistory('other');
    const { children: parsed } = parseBbCode(bbCode);
    if (parsed.length === 0) return;

    const last = parsed[parsed.length - 1];
    const toInsert: BlockNode[] = last.type !== 'paragraph'
      ? [...parsed, { type: 'paragraph', children: [] } as ParagraphNode]
      : parsed;

    const blockIdx = this.cursor.anchor.path[0];
    const current = this.doc.children[blockIdx];
    const replaceEmpty = current?.type === 'paragraph' && current.children.length === 0;

    const before = this.doc.children.slice(0, replaceEmpty ? blockIdx : blockIdx + 1);
    const after  = this.doc.children.slice(replaceEmpty ? blockIdx + 1 : blockIdx + 1);

    this.doc = { children: [...before, ...toInsert, ...after] };
    this.render();

    const cursorIdx = before.length + toInsert.length - 1;
    const newCursor: DocPoint = { path: [cursorIdx], offset: 0 };
    this.cursor = { anchor: newCursor, focus: newCursor };
    this.editorEl.nativeElement.focus();
    applyDocRange(this.cursor, this.editorEl.nativeElement);
    this.updateActiveState();
  }

  insertTextAtCursor(text: string): void {
    this.editorEl.nativeElement.focus();
    const range  = this.cursor;
    const base   = isCollapsed(range) ? this.doc : modelDeleteRange(this.doc, range).doc;
    const cursor = isCollapsed(range) ? range.anchor : modelDeleteRange(this.doc, range).cursor;
    this.commitOp(modelInsertText(base, cursor, text, this.pendingMarks ?? getMarksAtPoint(base, cursor)));
    this.pendingMarks = null;
    this.onInput();
  }

  replaceBeforeCursor(charsToDelete: number, text: string): void {
    this.editorEl.nativeElement.focus();
    const cursor = this.cursor.anchor;
    const delRange: DocRange = {
      anchor: { path: cursor.path, offset: Math.max(0, cursor.offset - charsToDelete) },
      focus: cursor,
    };
    const del   = modelDeleteRange(this.doc, delRange);
    const marks = getMarksAtPoint(del.doc, del.cursor);
    this.commitOp(modelInsertText(del.doc, del.cursor, text, marks));
    this.onInput();
  }

  appendText(text: string): void {
    const lastIdx = this.doc.children.length - 1;
    const last = this.doc.children[lastIdx];
    if (!last || last.type !== 'paragraph') return;
    const cursor: DocPoint = { path: [lastIdx], offset: inlineLen(last.children) };
    this.commitOp(modelInsertText(this.doc, cursor, text, []));
  }

  getTextBeforeCursor(): string {
    const cursor = this.cursor.anchor;
    let result = '';

    for (let bi = 0; bi <= cursor.path[0] && bi < this.doc.children.length; bi++) {
      const block = this.doc.children[bi];
      const isLast = bi === cursor.path[0];

      if (block.type === 'code') {
        result += isLast ? block.text.slice(0, cursor.offset) : block.text + '\n';
      } else if (block.type === 'paragraph') {
        result += isLast ? this.paraTextTo(block, cursor.offset) : this.paraText(block) + '\n';
      } else if (block.type === 'align' || block.type === 'quote' || block.type === 'spoiler') {
        const paras = block.children;
        const paraIdx = isLast ? (cursor.path[1] ?? 0) : paras.length - 1;
        for (let pi = 0; pi <= paraIdx; pi++) {
          const isLastPara = isLast && pi === paraIdx;
          result += isLastPara ? this.paraTextTo(paras[pi], cursor.offset) : this.paraText(paras[pi]) + '\n';
        }
      }
    }

    return result;
  }

  private paraText(para: ParagraphNode): string {
    return para.children.map(n => n.type === 'text' ? n.text : '').join('');
  }

  private paraTextTo(para: ParagraphNode, offset: number): string {
    let chars = 0;
    let result = '';
    for (const n of para.children) {
      if (n.type === 'img') { chars += 1; continue; }
      if (chars >= offset) break;
      const take = Math.min(n.text.length, offset - chars);
      result += n.text.slice(0, take);
      chars += n.text.length;
    }
    return result;
  }

  unwrapBlock(containerSelector: string, _contentSelector?: string): void {
    this.pushHistory('other');
    const blockIdx = this.cursor.anchor.path[0];
    const block = this.doc.children[blockIdx];

    let children: ParagraphNode[] | null = null;
    if (containerSelector.includes('wysiwyg-code') && block.type === 'code') {
      children = [{ type: 'paragraph', children: block.text ? [{ type: 'text', text: block.text, marks: [] }] : [] }];
    } else if (containerSelector.includes('blockquote') || containerSelector === 'blockquote') {
      if (block.type === 'quote') children = block.children;
    } else if (containerSelector.includes('wysiwyg-spoiler')) {
      if (block.type === 'spoiler') children = block.children;
    }

    if (!children) return;

    this.doc = {
      children: [
        ...this.doc.children.slice(0, blockIdx),
        ...children,
        ...this.doc.children.slice(blockIdx + 1),
      ],
    };
    const newCursor: DocPoint = { path: [blockIdx], offset: 0 };
    this.cursor = { anchor: newCursor, focus: newCursor };
    this.render();
    applyDocRange(this.cursor, this.editorEl.nativeElement);
    this.updateActiveState();
  }

  // ─── Paste / drop ─────────────────────────────────────────────────────────────

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();

    const range  = this.cursor;
    const base   = isCollapsed(range) ? this.doc : modelDeleteRange(this.doc, range).doc;
    const cursor = isCollapsed(range) ? range.anchor : modelDeleteRange(this.doc, range).cursor;

    const block = base.children[cursor.path[0]];

    if (block?.type === 'code') {
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (text) this.commitOp(modelInsertText(base, cursor, text, []));
      this.onInput();
      return;
    }

    if (this.canUpload()) {
      const imageFiles = Array.from(event.clipboardData?.items ?? [])
        .filter(i => i.type.startsWith('image/'))
        .map(i => i.getAsFile())
        .filter((f): f is File => f != null);

      if (imageFiles.length > 0) {
        this.uploadFiles(imageFiles, cursor);
        return;
      }
    }

    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;

    const lines = text.split('\n');
    let doc = base;
    let pt  = cursor;
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) { const r = modelSplitParagraph(doc, pt); doc = r.doc; pt = r.cursor; }
      if (lines[i]) {
        const r = modelInsertText(doc, pt, lines[i], getMarksAtPoint(doc, pt));
        doc = r.doc; pt = r.cursor;
      }
    }
    this.commitOp({ doc, cursor: pt });
    this.onInput();
  }

  onDragOver(event: DragEvent): void {
    if (!this.canUpload()) return;
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    if (!this.canUpload()) return;
    event.preventDefault();
    const imageFiles = Array.from(event.dataTransfer?.files ?? [])
      .filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) return;
    this.uploadFiles(imageFiles, this.cursor.anchor);
  }

  private uploadFiles(files: File[], atCursor: DocPoint): void {
    for (const file of files) {
      this.imageService.upload(file).subscribe({
        next: (res) => {
          // Use the live cursor rather than the captured drop position in case
          // another upload landed between the drop and this response.
          const pt = this.cursor.anchor;
          this.commitOp(modelInsertImg(this.doc, pt, res.url));
        },
        error: () => {},
      });
    }
  }
}
