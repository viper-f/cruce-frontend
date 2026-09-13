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

// GBoard on Android maintains an internal IME buffer that is independent of
// the DOM. After our editor handles a deletion (with preventDefault), GBoard
// never receives the native InputMethod onUpdateSelection callback that would
// flush its cache. The only reliable way to force a sync is to blur/focus,
// which ends the IME session (GBoard discards its buffer) and restarts it
// from the current DOM. ProseMirror and Lexical use the same technique.
const IS_ANDROID = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

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
      (keydown)="onKeyDown($event)"
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

  // Snapshot taken at compositionstart; cleared by any non-composition input.
  // Keeping it across GBoard's rapid compositionend→compositionstart re-cycles
  // lets compositionend always diff against a stable baseline, making each cycle
  // idempotent regardless of what event.data says.
  private preCompositionState: {
    doc: DocModel;
    cursor: DocRange;
    path: number[];
    blockText: string;
    historyPushed: boolean;
  } | null = null;

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
    // GBoard fires compositionend → compositionstart → compositionend in rapid
    // succession when cycling through autocorrect candidates. Returning here
    // when a snapshot already exists keeps the original baseline intact so the
    // next compositionend diffs against it rather than a mid-cycle state.
    if (this.preCompositionState !== null) return;

    const path = this.cursor.anchor.path;
    const paraEl = this.editorEl.nativeElement
      .querySelector(`[data-doc-path="${path.join(',')}"]`) as HTMLElement | null;

    this.preCompositionState = {
      doc: this.doc,
      cursor: { ...this.cursor },
      path,
      blockText: paraEl?.textContent ?? '',
      historyPushed: false,
    };
  }

  onCompositionEnd(event: CompositionEvent): void {
    const state = this.preCompositionState;
    if (!state) return;

    const paraEl = this.editorEl.nativeElement
      .querySelector(`[data-doc-path="${state.path.join(',')}"]`) as HTMLElement | null;

    const domText = paraEl?.textContent ?? '';

    if (!event.data) {
      // Composition cancelled — restore model/cursor; re-render so the DOM
      // matches (browser may have left partial composition text behind).
      this.preCompositionState = null;
      this.pendingMarks = null;
      this.doc = state.doc;
      this.cursor = state.cursor;
      this.render();
      applyDocRange(state.cursor, this.editorEl.nativeElement);
      this.updateActiveState();
      return;
    }

    // Diff the actual DOM text against the original pre-composition snapshot.
    // The snapshot is intentionally NOT advanced after each cycle — keeping the
    // original blockText as the baseline lets the GBoard append-bug heuristic
    // below see the full composition range, and keeps re-cycles idempotent.
    let change = WysiwygDocEditorComponent.diffText(state.blockText, domText);

    if (!change) {
      // DOM is unchanged — GBoard re-cycle with no new content. Keep state.
      return;
    }

    // GBoard append-without-replace bug: on autocorrect GBoard sometimes appends
    // the corrected word after the old one rather than replacing it, yielding
    // e.g. "htethe" in the DOM instead of "the". We detect this when:
    //   • the diff is a pure insertion (nothing deleted from the pre-comp text)
    //   • the inserted text is longer than event.data
    //   • the inserted text ends with event.data
    // In that case the prefix is the stale old-composition word; we discard it
    // and treat only event.data as the intended composition result.
    if (
      change.deleteFrom === change.deleteTo &&
      event.data.length > 0 &&
      change.insert.length > event.data.length &&
      change.insert.endsWith(event.data)
    ) {
      change = { deleteFrom: change.deleteFrom, deleteTo: change.deleteTo, insert: event.data };
    }

    if (!state.historyPushed) {
      this.pushHistory('other');
      state.historyPushed = true;
    }

    // Always apply from the pre-composition snapshot (state.doc / state.blockText),
    // not from this.doc. This is what keeps every cycle idempotent regardless of
    // how many times GBoard re-cycles through the same composed word.
    let base = state.doc;
    let pt: DocPoint = { path: state.path, offset: change.deleteFrom };

    if (change.deleteFrom < change.deleteTo) {
      const del = modelDeleteRange(base, {
        anchor: { path: state.path, offset: change.deleteFrom },
        focus:  { path: state.path, offset: change.deleteTo },
      });
      base = del.doc;
      pt = del.cursor;
    }

    const marks = this.pendingMarks ?? getMarksAtPoint(base, pt);
    this.pendingMarks = null;

    const result = change.insert
      ? modelInsertText(base, pt, change.insert, marks)
      : { doc: base, cursor: pt };

    this.doc = result.doc;
    this.cursor = { anchor: result.cursor, focus: result.cursor };

    // Full re-render (mirrors ProseMirror's endComposition → updateState).
    // This destroys GBoard's composition span so autocorrect is subsequently
    // delivered as insertReplacementText rather than a raw DOM mutation.
    // We no longer rely on getTargetRanges() node references, so the re-render
    // doesn't break autocorrect handling.
    this.render();
    applyDocRange(this.cursor, this.editorEl.nativeElement);
    this.updateActiveState();
    this.onInput();
    // state.historyPushed is mutated above; no other state update needed.
  }

  // Finds the minimal edit that transforms pre into post.
  // Returns null when the strings are equal (no-op for GBoard re-cycles).
  private static diffText(
    pre: string,
    post: string,
  ): { deleteFrom: number; deleteTo: number; insert: string } | null {
    if (pre === post) return null;

    let prefixLen = 0;
    const minLen = Math.min(pre.length, post.length);
    while (prefixLen < minLen && pre[prefixLen] === post[prefixLen]) prefixLen++;

    let suffixLen = 0;
    while (
      suffixLen < pre.length - prefixLen &&
      suffixLen < post.length - prefixLen &&
      pre[pre.length - 1 - suffixLen] === post[post.length - 1 - suffixLen]
    ) suffixLen++;

    return {
      deleteFrom: prefixLen,
      deleteTo: pre.length - suffixLen,
      insert: post.slice(prefixLen, post.length - suffixLen),
    };
  }

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────────

  onKeyDown(event: KeyboardEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    // event.code ('KeyB', 'KeyI', …) is layout-independent — always the physical key.
    // event.key on Windows + non-Latin layout gives the Cyrillic character instead of 'b'/'i'/…
    const keyChar = event.code?.startsWith('Key')
      ? event.code.slice(3).toLowerCase()
      : event.key.toLowerCase();

    // Handle undo/redo here so we can preventDefault before the browser applies
    // its own native undo to the contenteditable DOM (which would corrupt our model).
    if (keyChar === 'z') {
      event.preventDefault();
      event.shiftKey ? this.redo() : this.undo();
      return;
    }
    if (keyChar === 'y') {
      event.preventDefault();
      this.redo();
      return;
    }

    const cmd: Record<string, string> = {
      b: 'bold', i: 'italic', u: 'underline', s: 'strikeThrough',
    };
    const command = cmd[keyChar];
    if (!command) return;
    event.preventDefault();
    this.exec(command);
  }

  // ─── beforeinput ─────────────────────────────────────────────────────────────

  onBeforeInput(event: InputEvent): void {
    // insertReplacementText (Android autocorrect) must be intercepted before the
    // isComposing guard. GBoard fires it with isComposing=true; falling through
    // to the guard would cause us to skip it, letting the browser apply a raw DOM
    // mutation (the "append-without-replace" we were seeing) instead.
    if (event.inputType === 'insertReplacementText') {
      event.preventDefault();
      const text = event.data ?? (event as InputEvent & { dataTransfer?: DataTransfer }).dataTransfer?.getData('text/plain') ?? '';
      const state = this.preCompositionState;
      this.preCompositionState = null;

      if (text) {
        if (state) {
          // Diff the current DOM text against the pre-composition snapshot — the same
          // strategy used in onCompositionEnd. This is reliable regardless of whether
          // compositionEnd already ran and re-rendered (in which case paraEl shows the
          // composed word) or insertReplacementText fires first while isComposing=true
          // (in which case paraEl shows the raw GBoard composition text). Either way,
          // we get the right "what GBoard composed" range from state.blockText.
          // Using this.cursor for the composition range is unreliable because GBoard
          // composition keystrokes never trigger selectionchange, so this.cursor stays
          // at the pre-composition anchor throughout.
          const paraEl = this.editorEl.nativeElement
            .querySelector(`[data-doc-path="${state.path.join(',')}"]`) as HTMLElement | null;
          const domText = paraEl?.textContent ?? '';
          const composed = WysiwygDocEditorComponent.diffText(state.blockText, domText);

          let base = state.doc;
          let pt: DocPoint = { path: state.path, offset: composed?.deleteFrom ?? state.cursor.anchor.offset };

          if (composed && composed.deleteFrom < composed.deleteTo) {
            const del = modelDeleteRange(base, {
              anchor: { path: state.path, offset: composed.deleteFrom },
              focus:  { path: state.path, offset: composed.deleteTo },
            });
            base = del.doc;
            pt = del.cursor;
          }
          // Don't re-insert composed.insert — replace the composed region with text.

          if (!state.historyPushed) this.pushHistory('other');
          const marks = this.pendingMarks ?? getMarksAtPoint(base, pt);
          this.pendingMarks = null;
          const result = modelInsertText(base, pt, text, marks);
          this.doc = result.doc;
          this.cursor = { anchor: result.cursor, focus: result.cursor };
          this.render();
          applyDocRange(this.cursor, this.editorEl.nativeElement);
          if (IS_ANDROID) this.resetAndroidIME();
          this.updateActiveState();
          this.onInput();
          return;
        }

        // Fallback for non-composition autocorrect: use getTargetRanges().
        const targetRanges = (event as InputEvent & { getTargetRanges?(): StaticRange[] }).getTargetRanges?.();
        if (targetRanges?.length) {
          const tr = targetRanges[0];
          const anchor = domPositionToDocPoint(tr.startContainer, tr.startOffset, this.editorEl.nativeElement);
          const focus  = domPositionToDocPoint(tr.endContainer,   tr.endOffset,   this.editorEl.nativeElement);
          if (anchor && focus) {
            const del = modelDeleteRange(this.doc, { anchor, focus });
            const marks = getMarksAtPoint(del.doc, del.cursor);
            this.commitOp(modelInsertText(del.doc, del.cursor, text, marks), 'other', true);
            this.pendingMarks = null;
            this.onInput();
          }
        }
      }
      return;
    }

    // During IME composition the browser manages candidate text in the DOM.
    // Preventing default here would break that; compositionend handles the commit.
    if (event.isComposing) return;
    event.preventDefault();
    // Any non-composition input ends the composition tracking window.
    this.preCompositionState = null;

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
        // GBoard autocorrect fires deleteContentBackward with targetRanges covering
        // the full composed word (non-collapsed), then insertText with the correction.
        // this.cursor lags behind (selectionchange hasn't fired yet), so we must
        // read targetRanges to get the actual range the browser intends to delete.
        const targetRanges = (event as InputEvent & { getTargetRanges?(): StaticRange[] }).getTargetRanges?.();
        let handledViaTargetRanges = false;
        if (targetRanges?.length) {
          const tr = targetRanges[0];
          const anchor = domPositionToDocPoint(tr.startContainer, tr.startOffset, this.editorEl.nativeElement);
          const focus  = domPositionToDocPoint(tr.endContainer,   tr.endOffset,   this.editorEl.nativeElement);
          if (anchor && focus) {
            this.commitOp(modelDeleteRange(this.doc, { anchor, focus }), 'delete', true);
            handledViaTargetRanges = true;
          }
        }
        if (!handledViaTargetRanges) {
          if (!isCollapsed(range)) {
            this.commitOp(modelDeleteRange(this.doc, range), 'other', true);
          } else if (cursor.offset > 0) {
            const delRange: DocRange = {
              anchor: { path: cursor.path, offset: cursor.offset - 1 },
              focus: cursor,
            };
            this.commitOp(modelDeleteRange(this.doc, delRange), 'delete', true);
          } else {
            this.commitOp(modelMergePrevious(this.doc, cursor), 'other', true);
          }
        }
        this.pendingMarks = null;
        this.onInput();
        break;
      }

      case 'deleteContentForward': {
        if (!isCollapsed(range)) {
          this.commitOp(modelDeleteRange(this.doc, range), 'other', true);
        } else {
          const delRange: DocRange = {
            anchor: cursor,
            focus: { path: cursor.path, offset: cursor.offset + 1 },
          };
          this.commitOp(modelDeleteRange(this.doc, delRange), 'delete', true);
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
          if (anchor && focus) this.commitOp(modelDeleteRange(this.doc, { anchor, focus }), 'other', true);
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

    this.preCompositionState = null;
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

  private commitOp(result: OpResult, group: 'insert' | 'delete' | 'other' = 'other', fullRender = false): void {
    this.pushHistory(group);
    const prevDoc = this.doc;
    this.doc = result.doc;
    this.cursor = { anchor: result.cursor, focus: result.cursor };
    if (fullRender) {
      this.preCompositionState = null;
      this.render();
      applyDocRange(this.cursor, this.editorEl.nativeElement);
    } else {
      const cursorHandled = patchDoc(this.editorEl.nativeElement, prevDoc, this.doc, result.cursor);
      if (!cursorHandled) applyDocRange(this.cursor, this.editorEl.nativeElement);
    }
    this.updateActiveState();
  }

  // Ends the Android IME session and immediately restarts it so GBoard
  // re-reads the DOM instead of replaying its stale internal buffer.
  // blur() causes Android to tear down the InputMethod connection; focus()
  // starts a fresh one. The rAF gives the OS one frame to process the blur
  // before we re-attach. The cursor is re-applied after focus so Android
  // reports the correct anchor offset to the keyboard on reconnect.
  private resetAndroidIME(): void {
    const savedCursor = this.cursor;
    const el = this.editorEl.nativeElement;
    el.blur();
    requestAnimationFrame(() => {
      el.focus();
      applyDocRange(savedCursor, el);
    });
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
        const allChildren = block.children;
        const paraIdx = isLast ? (cursor.path[1] ?? 0) : allChildren.length - 1;
        for (let pi = 0; pi <= paraIdx; pi++) {
          const child = allChildren[pi];
          if (child.type !== 'paragraph') continue;
          const isLastPara = isLast && pi === paraIdx;
          result += isLastPara ? this.paraTextTo(child, cursor.offset) : this.paraText(child) + '\n';
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

    let children: BlockNode[] | null = null;
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
    this.preCompositionState = null;

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
