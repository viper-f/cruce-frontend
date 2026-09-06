import { Component, Input, Output, EventEmitter, ViewChild, AfterViewInit, inject, OnDestroy, OnInit, signal, computed, ElementRef } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ImageService } from '../../services/image.service';
import { BoardService } from '../../services/board.service';
import { ApiService } from '../../services/api.service';
import { UserShort } from '../../models/UserShort';

import { BbToolbarComponent } from '../bb-toolbar/bb-toolbar.component';
import { WysiwygDocEditorComponent } from '../wysiwyg-editor/wysiwyg-doc-editor.component';
import { FormsModule } from '@angular/forms';

type EditorMode = 'wysiwyg' | 'bbcode';
type AutosaveStatus = 'idle' | 'typing' | 'saving' | 'saved';

interface PostDraft {
  id: number;
  draft_id: string;
  user_id: number;
  character_id: number;
  topic_id: number;
  date_created: string;
  is_manual: boolean;
  is_published: boolean;
  post_id: number | null;
}

@Component({
  selector: 'app-post-form',
  imports: [ FormsModule, BbToolbarComponent, WysiwygDocEditorComponent],
  templateUrl: './post-form.component.html',
  styleUrl: './post-form.component.css',
  standalone: true,
})
export class PostFormComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('wysiwygEditor') wysiwygEditor?: WysiwygDocEditorComponent;
  @ViewChild('messageField') messageField?: ElementRef<HTMLTextAreaElement>;

  get textareaEl(): HTMLTextAreaElement | null {
    return this.messageField?.nativeElement ?? null;
  }

  @Input() initialContent: string = '';
  @Input() isEpisode: boolean = false;
  @Input() topicId: number | null = null;
  @Input() characterId: number | null = null;
  @Output() characterIdChange = new EventEmitter<number | null>();

  private userService = inject(UserService);
  private authService = inject(AuthService);
  private imageService = inject(ImageService);
  private boardService = inject(BoardService);
  private apiService = inject(ApiService);

  editorMode = signal<EditorMode>(
    this.authService.currentUser()?.editor_type === 1 ? 'bbcode' : 'wysiwyg'
  );

  // Draft state
  drafts = signal<PostDraft[]>([]);
  showDraftList = signal(false);
  autosaveStatus = signal<AutosaveStatus>('idle');
  private autoDraftId = signal<number | null>(null);

  autosaveEnabled = signal(true);
  loadedDraftId = signal<number | null>(null);
  currentDraftGroupId = signal<string | null>(null);

  autoDraftCount = computed(() => this.drafts().filter(d => !d.is_manual).length);
  manualDraftCount = computed(() => this.drafts().filter(d => d.is_manual).length);

  // Mention state
  mentionResults: UserShort[] = [];
  private mentionAtPos: number = -1;
  private mentionSubject = new Subject<string>();
  private mentionSub: Subscription;

  // Autosave
  private autosaveSubject = new Subject<string>();
  private autosaveSub?: Subscription;
  private savedClearTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.mentionSub = this.mentionSubject.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(term => term.length >= 1 ? this.userService.searchUsers(term) : [])
    ).subscribe(results => {
      this.mentionResults = results;
    });
  }

  protected isAuthenticated = this.authService.isAuthenticated;

  ngOnInit() {
    if (this.topicId && this.authService.isAuthenticated()) {
      this.loadDrafts(true);
      this.autosaveSub = this.autosaveSubject.pipe(debounceTime(3000)).subscribe(content => {
        this.autosaveStatus.set('saving');
        this.saveAutoDraft(content);
      });
    }
  }

  private saveAutoDraft(content: string) {
    const existingId = this.autoDraftId();
    const onError = () => this.autosaveStatus.set('idle');

    if (!content.trim() && existingId) {
      this.apiService.get(`post-draft/delete/${existingId}`).subscribe({
        next: () => {
          this.autoDraftId.set(null);
          if (this.loadedDraftId() === existingId) this.loadedDraftId.set(null);
          if (this.drafts().filter(d => d.id !== existingId).length === 0) this.currentDraftGroupId.set(null);
          this.autosaveStatus.set('idle');
          this.loadDrafts();
        },
        error: onError,
      });
      return;
    }

    if (!content.trim()) {
      this.autosaveStatus.set('idle');
      return;
    }

    const onSuccess = (data: PostDraft) => {
      this.autoDraftId.set(data.id);
      this.currentDraftGroupId.set(data.draft_id);
      this.drafts.update(current => {
        const without = current.filter(d => d.id !== data.id);
        return [data, ...without];
      });
      this.autosaveStatus.set('saved');
      this.loadDrafts();
      this.savedClearTimer = setTimeout(() => this.autosaveStatus.set('idle'), 3000);
    };

    if (!existingId) {
      this.apiService.post<PostDraft>('post-draft/create', {
        character_id: this.characterId,
        topic_id: this.topicId,
        is_manual: false,
        content,
      }).subscribe({ next: onSuccess, error: onError });
    } else {
      this.apiService.post<PostDraft>(`post-draft/update/${existingId}`, {
        character_id: this.characterId,
        topic_id: this.topicId,
        is_manual: false,
        content,
      }).subscribe({ next: onSuccess, error: onError });
    }
  }

  ngAfterViewInit() {
    if (this.wysiwygEditor) {
      this.wysiwygEditor.onInput = () => this.onWysiwygInput();
    }
    if (this.initialContent) {
      this.setValue(this.initialContent);
    }
  }

  ngOnDestroy() {
    this.mentionSub.unsubscribe();
    this.autosaveSub?.unsubscribe();
    if (this.savedClearTimer) clearTimeout(this.savedClearTimer);
  }

  // --- Draft API ---

  private loadDrafts(autoLoad = false) {
    if (!this.topicId) return;
    this.apiService.get<PostDraft[]>(`post-draft/topic/${this.topicId}/latest`).subscribe({
      next: data => {
        this.drafts.set(data);
        const autoDraft = data.find(d => !d.is_manual);
        if (autoDraft) {
          const isFirstLoad = !this.autoDraftId();
          if (isFirstLoad) this.autoDraftId.set(autoDraft.id);
          if (!this.loadedDraftId()) {
            this.loadedDraftId.set(autoDraft.id);
            this.currentDraftGroupId.set(autoDraft.draft_id);
          }
          if (autoLoad && isFirstLoad) this.loadDraft(autoDraft);
        }
      },
      error: () => {},
    });
  }

  toggleDraftList() {
    this.showDraftList.update(v => !v);
  }

  saveManualDraft() {
    const autoDraft = this.drafts().find(d => !d.is_manual);
    this.apiService.post<PostDraft>('post-draft/create', {
      draft_id: autoDraft?.draft_id,
      character_id: this.characterId,
      topic_id: this.topicId,
      is_manual: true,
      content: this.getValue(),
    }).subscribe({
      next: () => this.loadDrafts(),
      error: err => console.error('Failed to save manual draft', err),
    });
  }

  loadDraft(draft: PostDraft) {
    this.apiService.get<PostDraft & { content: string }>(`post-draft/${draft.id}`).subscribe({
      next: data => {
        this.setValue(data.content);
        this.loadedDraftId.set(draft.id);
        this.currentDraftGroupId.set(data.draft_id);
        this.characterIdChange.emit(data.character_id);
        this.showDraftList.set(false);
      },
      error: err => console.error('Failed to load draft', err),
    });
  }

  deleteDraft(draft: PostDraft) {
    this.apiService.get(`post-draft/delete/${draft.id}`).subscribe({
      next: () => {
        if (this.loadedDraftId() === draft.id) this.loadedDraftId.set(null);
        this.loadDrafts();
      },
      error: err => console.error('Failed to delete draft', err),
    });
  }

  deleteDraftGroup() {
    const draftId = this.drafts()[0]?.draft_id;
    if (!draftId) return;
    this.apiService.get(`post-draft/delete-group/${draftId}`).subscribe({
      next: () => {
        this.drafts.set([]);
        this.autoDraftId.set(null);
        this.loadedDraftId.set(null);
        this.showDraftList.set(false);
      },
      error: err => console.error('Failed to delete draft group', err),
    });
  }

  updateManualDraft(draft: PostDraft) {
    this.apiService.post<PostDraft>(`post-draft/update/${draft.id}`, {
      character_id: this.characterId,
      topic_id: this.topicId,
      is_manual: true,
      content: this.getValue(),
    }).subscribe({
      next: () => this.loadDrafts(),
      error: err => console.error('Failed to update manual draft', err),
    });
  }

  // --- Public API used by viewtopic ---

  cancelPendingAutosave(): void {
    this.autosaveSub?.unsubscribe();
    this.autosaveStatus.set('idle');
    this.autosaveSub = this.autosaveSubject.pipe(debounceTime(3000)).subscribe(content => {
      this.autosaveStatus.set('saving');
      this.saveAutoDraft(content);
    });
  }

  reloadDrafts(): void {
    this.autoDraftId.set(null);
    this.loadedDraftId.set(null);
    this.currentDraftGroupId.set(null);
    this.loadDrafts();
  }

  getValue(): string {
    if (this.editorMode() === 'wysiwyg') {
      return this.wysiwygEditor?.getValue() ?? '';
    }
    return this.messageField?.nativeElement.value ?? '';
  }

  setValue(content: string): void {
    if (this.editorMode() === 'wysiwyg') {
      this.wysiwygEditor?.setValue(content);
    } else {
      if (this.messageField) this.messageField.nativeElement.value = content;
    }
  }

  clear(): void {
    this.wysiwygEditor?.clear();
    if (this.messageField) this.messageField.nativeElement.value = '';
  }

  focus(): void {
    if (this.editorMode() === 'wysiwyg') {
      this.wysiwygEditor?.focus();
    } else {
      this.messageField?.nativeElement.focus();
    }
  }

  appendText(text: string): void {
    if (this.editorMode() === 'wysiwyg') {
      this.wysiwygEditor?.appendText(text);
    } else {
      const el = this.messageField?.nativeElement;
      if (el) { el.value += text; el.focus(); }
    }
  }

  appendBbCode(bbCode: string): void {
    if (this.editorMode() === 'wysiwyg') {
      this.wysiwygEditor?.insertTextAtCursor(bbCode);
    } else {
      const el = this.messageField?.nativeElement;
      if (el) { el.value += bbCode; el.focus(); }
    }
  }

  insertAtCursor(text: string): void {
    if (this.editorMode() === 'wysiwyg') {
      this.wysiwygEditor?.restoreSelection();
      this.wysiwygEditor?.insertTextAtCursor(text);
    } else {
      const el = this.messageField?.nativeElement;
      if (!el) return;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      el.value = el.value.substring(0, start) + text + el.value.substring(end);
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    }
  }

  switchMode(): void {
    const content = this.getValue();
    const next: EditorMode = this.editorMode() === 'wysiwyg' ? 'bbcode' : 'wysiwyg';
    this.editorMode.set(next);
    this.setValue(content);
  }

  // --- Internal ---

  private notifyTyping() {
    if (!this.topicId || !this.autosaveEnabled()) return;
    if (this.savedClearTimer) { clearTimeout(this.savedClearTimer); this.savedClearTimer = null; }
    this.autosaveStatus.set('typing');
    this.autosaveSubject.next(this.getValue());
  }

  onTextareaInput(): void {
    this.notifyTyping();
    if (this.isEpisode) return;
    const el = this.messageField?.nativeElement;
    if (!el) return;
    const textBefore = el.value.substring(0, el.selectionStart ?? 0);
    const match = textBefore.match(/@([^ @]*)$/);
    if (match) {
      this.mentionAtPos = textBefore.length - match[0].length;
      this.mentionSubject.next(match[1]);
    } else {
      this.mentionResults = [];
      this.mentionAtPos = -1;
    }
  }

  private onWysiwygInput() {
    this.notifyTyping();
    if (this.isEpisode) return;
    const textBefore = this.wysiwygEditor?.getTextBeforeCursor() ?? '';
    const match = textBefore.match(/@([^ @]*)$/);
    if (match) {
      this.mentionAtPos = textBefore.length - match[0].length;
      this.mentionSubject.next(match[1]);
    } else {
      this.mentionResults = [];
      this.mentionAtPos = -1;
    }
  }

  selectMention(user: UserShort) {
    const inserted = `${user.username}\u200A`;
    if (this.editorMode() === 'wysiwyg') {
      const textBefore = this.wysiwygEditor?.getTextBeforeCursor() ?? '';
      const charsToDelete = textBefore.length - this.mentionAtPos - 1;
      this.wysiwygEditor?.replaceBeforeCursor(charsToDelete, inserted);
    } else {
      const el = this.messageField?.nativeElement;
      if (!el) return;
      const cursorPos = el.selectionStart ?? el.value.length;
      const replaceFrom = this.mentionAtPos + 1;
      el.value = el.value.substring(0, replaceFrom) + inserted + el.value.substring(cursorPos);
      el.focus();
      el.setSelectionRange(replaceFrom + inserted.length, replaceFrom + inserted.length);
    }
    this.mentionResults = [];
    this.mentionAtPos = -1;
  }

  closeMention() {
    this.mentionResults = [];
    this.mentionAtPos = -1;
  }

  onTextareaPaste(event: ClipboardEvent): void {
    if (this.boardService.board().use_image_uploading !== 'y') return;
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter(i => i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter((f): f is File => f != null);
    if (files.length === 0) return;
    event.preventDefault();
    this.uploadImagesToTextarea(files);
  }

  onTextareaDragOver(event: DragEvent): void {
    if (this.boardService.board().use_image_uploading !== 'y') return;
    event.preventDefault();
  }

  onTextareaDrop(event: DragEvent): void {
    if (this.boardService.board().use_image_uploading !== 'y') return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
    this.uploadImagesToTextarea(files);
  }

  private uploadImagesToTextarea(files: File[]): void {
    const el = this.messageField?.nativeElement;
    if (!el || files.length === 0) return;
    for (const file of files) {
      const pos = el.selectionStart ?? el.value.length;
      const placeholder = '[img]...[/img]';
      el.value = el.value.substring(0, pos) + placeholder + el.value.substring(pos);
      const start = pos;
      this.imageService.upload(file).subscribe({
        next: (res) => {
          el.value = el.value.substring(0, start) + `[img]${res.url}[/img]` + el.value.substring(start + placeholder.length);
        },
        error: () => {
          el.value = el.value.substring(0, start) + el.value.substring(start + placeholder.length);
        },
      });
    }
  }
}
