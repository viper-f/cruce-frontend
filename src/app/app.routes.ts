import { Routes } from '@angular/router';
import {HomeComponent} from './home/home.component';
import {ViewforumComponent} from './viewforum/viewforum.component';
import {ViewtopicComponent} from './viewtopic/viewtopic.component';
import {MessengerComponent} from './messenger/messenger.component';
import {UserProfileComponent} from './user-profile/user-profile.component';
import {CharacterviewComponent} from './characterview/characterview.component';
import {CharacterListComponent} from './character-list/character-list.component';
import {EpisodeListComponent} from './episode-list/episode-list.component';
import {LoginComponent} from './login/login.component';
import {RegisterComponent} from './register/register.component';
import {AdminWrapperComponent} from './admin/admin-wrapper/admin-wrapper.component';
import {AdminNotificationsComponent} from './admin/admin-notifications/admin-notifications.component';
import {CharacterTemplateEditComponent} from './admin/character-template-edit/character-template-edit.component';
import {TopicCreateComponent} from './topic-create/topic-create.component';
import {EpisodeCreateComponent} from './episode-create/episode-create.component';
import {CharacterCreateComponent} from './character-create/character-create.component';
import {EpisodeTemplateEditComponent} from './admin/episode-template-edit/episode-template-edit.component';
import {CharacterProfileTemplateEditComponent} from './admin/character-profile-template-edit/character-profile-template-edit.component';
import {PermissionMatrixComponent} from './admin/permission-matrix/permission-matrix.component';
import {CharacterProfileEditComponent} from './character-profile-edit/character-profile-edit.component';
import { UserListComponent } from './user-list/user-list.component';
import { SettingsComponent } from './settings/settings.component';
import { ActiveTopicsComponent } from './active-topics/active-topics.component';


export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Home page',
    data: { pageId: 'pun-index' }
  },
  {
    path: 'login',
    component: LoginComponent,
    data: { pageId: 'pun-login' }
  },
  {
    path: 'register',
    component: RegisterComponent,
    data: { pageId: 'pun-register' }
  },
  {
    path: 'messenger',
    component: MessengerComponent,
    data: { pageId: 'pun-messenger' }
  },
  {
    path: 'settings',
    component: SettingsComponent,
    title: 'Settings',
    data: { pageId: 'pun-settings' }
  },
  {
    path: 'viewforum/:id',
    component: ViewforumComponent,
    title: 'View Forum',
    data: { pageId: 'pun-viewforum' }
  },
  {
    path: 'topic-create',
    component: TopicCreateComponent,
    title: 'Create Topic',
    data: { pageId: 'pun-create-topic' }
  },
  {
    path: 'episode-create',

    component: EpisodeCreateComponent,
    title: 'Create Episode',
    data: { pageId: 'pun-create-episode' }
  },
  {
    path: 'character-create',
    component: CharacterCreateComponent,
    title: 'Create Character',
    data: { pageId: 'pun-create-character' }
  },
  {
    path: 'viewtopic/:id',
    component: ViewtopicComponent,
    data: { pageId: 'pun-viewtopic' }
  },
  {
    path: 'profile/:id',
    component: UserProfileComponent,
    title: 'User Profile',
    data: { pageId: 'pun-profile' }
  },
  {
    path: 'character/:id',
    component: CharacterviewComponent,
    title: 'Character',
    data: { pageId: 'pun-character' }
  },
  {
    path: 'character-list',
    component: CharacterListComponent,
    title: 'Character List',
    data: { pageId: 'pun-character-list' }
  },
  {
    path: 'user-list',
    component: UserListComponent,
    title: 'User List',
    data: { pageId: 'pun-user-list' }
  },
  {
    path: 'episode-list',
    component: EpisodeListComponent,
    title: 'Episode List',
    data: { pageId: 'pun-episode-list' }
  },
  {
    path: 'active-topics',
    component: ActiveTopicsComponent,
    title: 'Active Topics',
    data: { pageId: 'pun-active-topics' }
  },
  {
    path: 'character-profile-update/:id',
    component: CharacterProfileEditComponent,
    title: 'Update Character Profile',
    data: { pageId: 'pun-character-profile-update' }
  },
  {
    path: 'admin',
    component: AdminWrapperComponent,
    data: { pageId: 'pun-admin' },
    children: [
      {
        path: 'notifications',
        component: AdminNotificationsComponent,
        title: 'Admin - Notifications'
      },
      {
        path: 'character-template',
        component: CharacterTemplateEditComponent,
        title: 'Admin - Character Template'
      },
      {
        path: 'episode-template',
        component: EpisodeTemplateEditComponent,
        title: 'Admin - Episode Template'
      },
      {
        path: 'character-profile-template',
        component: CharacterProfileTemplateEditComponent,
        title: 'Admin - Character Profile Template'
      },
      {
        path: 'permissions',
        component: PermissionMatrixComponent,
        title: 'Admin - Permissions'
      }
    ]
  }
];
