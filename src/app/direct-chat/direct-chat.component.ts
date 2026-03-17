import {Component, ElementRef, inject, OnInit, ViewChild} from '@angular/core';
import {User} from '../models/User';
import {Message} from '../models/Message';
import {DirectChat, DirectChatListItem} from '../models/DirectChat';
import {DirectChatService} from '../services/direct-chat.service';
import {UserService} from '../services/user.service';
import {UserShort} from '../models/UserShort';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-direct-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './direct-chat.component.html',
  standalone: true,
  styleUrl: './direct-chat.component.css'
})
export class DirectChatComponent implements OnInit {
  private directChatService = inject(DirectChatService);
  private userService = inject(UserService);

  @ViewChild('chatInput') messageField!: ElementRef<HTMLTextAreaElement>;

  chatList = this.directChatService.chatList;

  activeUser: User = {
    id: 0,
    username: "",
    interface_timezone: '',
    interface_language: '',
    interface_font_size: 1,
    avatar: '',
    roles: []
  };
  messages: Message[] = [
    new Message(1, 'Hi!', 'today', false)
  ];
  showSearch = true;

  newChatTerm = '';
  autocompleteResults: UserShort[] = [];
  selectedNewChatUser: UserShort | null = null;
  private searchSubject = new Subject<string>();

  ngOnInit() {
    this.directChatService.loadChatList();

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => term.length >= 2 ? this.userService.searchUsers(term) : [])
    ).subscribe(results => {
      this.autocompleteResults = results;
    });
  }

  onNewChatInput() {
    this.selectedNewChatUser = null;
    this.searchSubject.next(this.newChatTerm);
  }

  selectNewChatUser(user: UserShort) {
    this.selectedNewChatUser = user;
    this.newChatTerm = user.username;
    this.autocompleteResults = [];
  }

  addChat() {
    if (!this.selectedNewChatUser) return;
    const user = this.selectedNewChatUser;
    this.directChatService.createChat(user.id).subscribe({
      next: (response) => {
        this.directChatService.prependChat({
          chat_id: response.chat_id,
          user_id: user.id,
          username: user.username,
          unread_count: 0
        });
        this.newChatTerm = '';
        this.selectedNewChatUser = null;
        this.autocompleteResults = [];
      },
      error: (err) => console.error('Failed to create chat', err)
    });
  }

  insertTag(tag: string) {
    const textarea = this.messageField.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const tagBase = tag.split('=')[0];
    const openTag = `[${tag}]`;
    const closeTag = `[/${tagBase}]`;

    const selectedText = text.substring(start, end);
    const replacement = openTag + selectedText + closeTag;

    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    textarea.focus();

    const newPos = start + openTag.length + selectedText.length;
    textarea.setSelectionRange(newPos, newPos);
  }

  handleSend() {}
  selectUser(chat: DirectChatListItem) {}
  toggleSearch() {}
  onSearch(event: Event) {}
  highlightMatch(text: string) { return text; }
}
