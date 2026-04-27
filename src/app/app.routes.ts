import { Routes } from '@angular/router';
import {HomeComponent} from './home/home.component';
import {ViewforumComponent} from './viewforum/viewforum.component';
import {ViewtopicComponent} from './viewtopic/viewtopic.component';
import {DirectChatComponent} from './direct-chat/direct-chat.component';
import {UserProfileComponent} from './user-profile/user-profile.component';
import {TransactionsComponent} from './transactions/transactions.component';
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
import {AdminFactionsComponent} from './admin/admin-factions/admin-factions.component';
import {AdminFeaturesComponent} from './admin/admin-features/admin-features.component';
import {AdminCurrencyComponent} from './admin/admin-currency/admin-currency.component';
import {AdminPostTopComponent} from './admin/admin-post-top/admin-post-top.component';
import {PostTopComponent} from './post-top/post-top.component';
import {CharacterClaimsComponent} from './admin/character-claims/character-claims.component';
import {WantedCharacterTemplateEditComponent} from './admin/wanted-character-template-edit/wanted-character-template-edit.component';
import {WantedCharacterCreateComponent} from './wanted-character-create/wanted-character-create.component';
import {WantedCharacterListComponent} from './wanted-character-list/wanted-character-list.component';
import {AdminSettingsComponent} from './admin/admin-settings/admin-settings.component';
import {AdminSubforumsComponent} from './admin/admin-subforums/admin-subforums.component';
import {TopicCommanderComponent} from './admin/topic-commander/topic-commander.component';
import {AdminUsersComponent} from './admin/admin-users/admin-users.component';
import {AdminCreateUserComponent} from './admin/admin-create-user/admin-create-user.component';
import {AdminAdditionalNavlinksComponent} from './admin/admin-additional-navlinks/admin-additional-navlinks.component';
import {PreviewComponent} from './preview/preview.component';
import {CharacterProfileEditComponent} from './character-profile-edit/character-profile-edit.component';
import { UserListComponent } from './user-list/user-list.component';
import { SettingsComponent } from './settings/settings.component';
import { ActiveTopicsComponent } from './active-topics/active-topics.component';
import { MaskListComponent } from './mask-list/mask-list.component';
import { RecoveryCodesComponent } from './recovery-codes/recovery-codes.component';
import { SettingsRestorationCodesComponent } from './settings-restoration-codes/settings-restoration-codes.component';
import { RestorePasswordComponent } from './restore-password/restore-password.component';
import { WipeOutMyUserComponent } from './wipe-out-my-user/wipe-out-my-user.component';
import { adminGuard } from './guards/admin.guard';
import { privateKeyGuard } from './guards/private-key.guard';
import { CharacterFieldListComponent } from './character-field-list/character-field-list.component';
import { AdminWidgetPanelsComponent } from './admin/admin-widget-panels/admin-widget-panels.component';
import { AdminWidgetPanelEditComponent } from './admin/admin-widget-panel-edit/admin-widget-panel-edit.component';
import { AdminWidgetsComponent } from './admin/admin-widgets/admin-widgets.component';
import { AdminWidgetEditComponent } from './admin/admin-widget-edit/admin-widget-edit.component';
import { ActiveUsersComponent } from './active-users/active-users.component';
import { AdminDesignComponent } from './admin/admin-design/admin-design.component';
import { AdminReactionsComponent } from './admin/admin-reactions/admin-reactions.component';
import { AdminSmilesComponent } from './admin/admin-smiles/admin-smiles.component';
import { PostPageComponent } from './post-page/post-page.component';
import { NotFoundComponent } from './error-pages/not-found/not-found.component';
import { ForbiddenComponent } from './error-pages/forbidden/forbidden.component';
import { ServerErrorComponent } from './error-pages/server-error/server-error.component';


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
    path: 'restore-password',
    component: RestorePasswordComponent,
    title: 'Restore Password',
    data: { pageId: 'pun-restore-password' }
  },
  {
    path: 'wipe-out-my-user',
    component: WipeOutMyUserComponent,
    title: 'Delete My Account',
    data: { pageId: 'pun-wipe-out-my-user' }
  },
  {
    path: 'register',
    component: RegisterComponent,
    data: { pageId: 'pun-register' }
  },
  {
    path: 'recovery-codes',
    component: RecoveryCodesComponent,
    title: 'Recovery Codes',
    data: { pageId: 'pun-recovery-codes' }
  },
  {
    path: 'restoration-codes',
    component: SettingsRestorationCodesComponent,
    title: 'Recovery Codes Settings',
    data: { pageId: 'pun-restoration-codes' }
  },
  {
    path: 'direct-chat',
    component: DirectChatComponent,
    canActivate: [privateKeyGuard],
    data: { pageId: 'pun-direct-chat' }
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
    path: 'preview',
    component: PreviewComponent,
    title: 'Preview',
    data: { pageId: 'pun-preview' }
  },
  {
    path: 'character-create',
    component: CharacterCreateComponent,
    title: 'Create Character',
    data: { pageId: 'pun-create-character' }
  },
  {
    path: 'wanted-character-create',
    component: WantedCharacterCreateComponent,
    title: 'Create Wanted Character',
    data: { pageId: 'pun-create-wanted-character' }
  },
  {
    path: 'viewtopic/:id',
    component: ViewtopicComponent,
    data: { pageId: 'pun-viewtopic' }
  },
  {
    path: 'post-top/:id',
    component: PostTopComponent,
    title: 'Post Top',
    data: { pageId: 'pun-post-top' }
  },
  {
    path: 'profile/:id',
    component: UserProfileComponent,
    title: 'User Profile',
    data: { pageId: 'pun-profile' }
  },
  {
    path: 'profile/:user_id/transactions',
    component: TransactionsComponent,
    title: 'Transactions',
    data: { pageId: 'pun-transactions' }
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
    path: 'character-field-list/:field',
    component: CharacterFieldListComponent,
    title: 'Character Field List',
    data: { pageId: 'pun-character-field-list' }
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
    path: 'wanted-character-list',
    component: WantedCharacterListComponent,
    title: 'Wanted Characters',
    data: { pageId: 'pun-wanted-character-list' }
  },
  {
    path: 'active-topics',
    component: ActiveTopicsComponent,
    title: 'Active Topics',
    data: { pageId: 'pun-active-topics' }
  },
  {
    path: 'active-users',
    component: ActiveUsersComponent,
    title: 'Active Users',
    data: { pageId: 'pun-active-users' }
  },
  {
    path: 'character-profile-update/:id',
    component: CharacterProfileEditComponent,
    title: 'Update Character Profile',
    data: { pageId: 'pun-character-profile-update' }
  },
  {
    path: 'user-masks/:userId',
    component: MaskListComponent,
    title: 'User Masks',
    data: { pageId: 'pun-user-masks' }
  },
  {
    path: 'admin',
    component: AdminWrapperComponent,
    canActivate: [adminGuard],
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
        path: 'settings',
        component: AdminSettingsComponent,
        title: 'Admin - Settings'
      },
      {
        path: 'factions',
        component: AdminFactionsComponent,
        title: 'Admin - Factions'
      },
      {
        path: 'permissions',
        component: PermissionMatrixComponent,
        title: 'Admin - Permissions'
      },
      {
        path: 'character-claims',
        component: CharacterClaimsComponent,
        title: 'Admin - Character Claims'
      },
      {
        path: 'wanted-character-template',
        component: WantedCharacterTemplateEditComponent,
        title: 'Admin - Wanted Character Template'
      },
      {
        path: 'subforums',
        component: AdminSubforumsComponent,
        title: 'Admin - Subforums'
      },
      {
        path: 'topic-commander',
        component: TopicCommanderComponent,
        title: 'Admin - Topic Commander'
      },
      {
        path: 'users',
        component: AdminUsersComponent,
        title: 'Admin - Users'
      },
      {
        path: 'create-user',
        component: AdminCreateUserComponent,
        title: 'Admin - Create User'
      },
      {
        path: 'widget-panels',
        component: AdminWidgetPanelsComponent,
        title: 'Admin - Widget Panels'
      },
      {
        path: 'widget-panels/:key',
        component: AdminWidgetPanelEditComponent,
        title: 'Admin - Edit Widget Panel'
      },
      {
        path: 'widgets',
        component: AdminWidgetsComponent,
        title: 'Admin - Widgets'
      },
      {
        path: 'widget/new',
        component: AdminWidgetEditComponent,
        title: 'Admin - Create Widget'
      },
      {
        path: 'widget/:id',
        component: AdminWidgetEditComponent,
        title: 'Admin - Edit Widget'
      },
      {
        path: 'design',
        component: AdminDesignComponent,
        title: 'Admin - Design'
      },
      {
        path: 'additional-navlinks',
        component: AdminAdditionalNavlinksComponent,
        title: 'Admin - Additional Navlinks'
      },
      {
        path: 'features',
        component: AdminFeaturesComponent,
        title: 'Admin - Features'
      },
      {
        path: 'features/currency',
        component: AdminCurrencyComponent,
        title: 'Admin - Currency'
      },
      {
        path: 'features/post_top',
        component: AdminPostTopComponent,
        title: 'Admin - Post Top'
      },
      {
        path: 'reactions',
        component: AdminReactionsComponent,
        title: 'Admin - Reactions'
      },
      {
        path: 'smiles',
        component: AdminSmilesComponent,
        title: 'Admin - Smiles'
      }
    ]
  },
  {
    path: 'post-page/:id',
    component: PostPageComponent,
    data: { pageId: 'pun-post-page' }
  },
  {
    path: '403',
    component: ForbiddenComponent,
    title: 'Forbidden',
    data: { pageId: 'pun-403' }
  },
  {
    path: '500',
    component: ServerErrorComponent,
    title: 'Server Error',
    data: { pageId: 'pun-500' }
  },
  {
    path: '**',
    component: NotFoundComponent,
    title: 'Page Not Found',
    data: { pageId: 'pun-404' }
  }
];
