import { Component, ElementRef, Input, ViewChild, AfterViewInit, inject, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { UserService } from '../../services/user.service';
import { UserShort } from '../../models/UserShort';
import { CommonModule } from '@angular/common';
import { BbToolbarComponent } from '../bb-toolbar/bb-toolbar.component';

@Component({
  selector: 'app-post-form',
  imports: [CommonModule, BbToolbarComponent],
  templateUrl: './post-form.component.html',
  standalone: true,
})
export class PostFormComponent implements AfterViewInit, OnDestroy {
  @ViewChild('messageField') messageField!: ElementRef<HTMLTextAreaElement>;
  @Input() initialContent: string = '';
  @Input() isEpisode: boolean = false;

  private userService = inject(UserService);

  mentionResults: UserShort[] = [];
  private mentionAtPos: number = -1;
  private mentionSubject = new Subject<string>();
  private mentionSub: Subscription;

  constructor() {
    this.mentionSub = this.mentionSubject.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(term => term.length >= 1 ? this.userService.searchUsers(term) : [])
    ).subscribe(results => {
      this.mentionResults = results;
    });
  }

  ngAfterViewInit() {
    if (this.initialContent) {
      this.messageField.nativeElement.value = this.initialContent;
    }
  }

  ngOnDestroy() {
    this.mentionSub.unsubscribe();
  }

  onTextareaInput() {
    if (this.isEpisode) return;

    const textarea = this.messageField.nativeElement;
    const cursor = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursor);

    const match = textBeforeCursor.match(/@([^\u200A@]*)$/);
    if (match) {
      this.mentionAtPos = cursor - match[0].length;
      this.mentionSubject.next(match[1]);
    } else {
      this.mentionResults = [];
      this.mentionAtPos = -1;
    }
  }

  selectMention(user: UserShort) {
    const textarea = this.messageField.nativeElement;
    const cursor = textarea.selectionStart;
    const text = textarea.value;

    const before = text.substring(0, this.mentionAtPos);
    const after = text.substring(cursor);
    const inserted = `@${user.username}\u200A`;

    textarea.value = before + inserted + after;
    textarea.focus();
    const newPos = this.mentionAtPos + inserted.length;
    textarea.setSelectionRange(newPos, newPos);

    this.mentionResults = [];
    this.mentionAtPos = -1;
  }

  closeMention() {
    this.mentionResults = [];
    this.mentionAtPos = -1;
  }
}
