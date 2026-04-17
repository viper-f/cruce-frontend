import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService } from '../services/api.service';
import { ActiveUserInfo } from '../models/event';

const PAGE_TYPE_NAMES: Record<string, string> = {
  home: $localize`:@@activeUsers.page.home:Home`,
  forum: $localize`:@@activeUsers.page.forum:Forum`,
  profile: $localize`:@@activeUsers.page.profile:Profile`,
  character: $localize`:@@activeUsers.page.character:Character`,
  episode: $localize`:@@activeUsers.page.episode:Episode`,
  'character-list': $localize`:@@activeUsers.page.characterList:Character List`,
  'episode-list': $localize`:@@activeUsers.page.episodeList:Episode List`,
  'wanted-character-list': $localize`:@@activeUsers.page.wantedCharacterList:Wanted Character List`,
  'user-list': $localize`:@@activeUsers.page.userList:User List`,
  'active-topics': $localize`:@@activeUsers.page.activeTopics:Active Topics`,
  'direct-chat': $localize`:@@activeUsers.page.directChat:Direct Chat`,
  'active-users': $localize`:@@activeUsers.page.activeUsers:Active Users`,
  settings: $localize`:@@activeUsers.page.settings:Settings`,
  login: $localize`:@@activeUsers.page.login:Login`,
  register: $localize`:@@activeUsers.page.register:Registration`,
};

@Component({
  selector: 'app-active-users',
  imports: [RouterLink, DatePipe],
  templateUrl: './active-users.component.html',
  standalone: true,
})
export class ActiveUsersComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);

  users = signal<ActiveUserInfo[]>([]);

  private visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      this.fetchActiveUsers();
    }
  };

  ngOnInit() {
    this.fetchActiveUsers();
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnDestroy() {
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  private fetchActiveUsers() {
    this.apiService.get<ActiveUserInfo[]>('active-users/activity').subscribe(users => {
      this.users.set(users);
    });
  }

  pageLabel(user: ActiveUserInfo): string {
    if (user.current_page_type === 'topic' && user.current_page_name) {
      return user.current_page_name;
    }
    return PAGE_TYPE_NAMES[user.current_page_type] || user.current_page_type;
  }

  pageRoute(user: ActiveUserInfo): any[] | null {
    const id = user.current_page_id ? +user.current_page_id : null;
    switch (user.current_page_type) {
      case 'topic':
      case 'episode': return id ? ['/viewtopic', id] : null;
      case 'forum': return id ? ['/viewforum', id] : null;
      case 'profile': return id ? ['/profile', id] : null;
      case 'character': return id ? ['/character', id] : null;
      case 'home': return ['/'];
      case 'character-list': return ['/character-list'];
      case 'episode-list': return ['/episode-list'];
      case 'wanted-character-list': return ['/wanted-character-list'];
      case 'user-list': return ['/user-list'];
      case 'active-topics': return ['/active-topics'];
      case 'direct-chat': return ['/direct-chat'];
      case 'active-users': return ['/active-users'];
      case 'settings': return ['/settings'];
      default: return null;
    }
  }
}
