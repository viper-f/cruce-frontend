import {Component, effect, inject, Input, OnInit, OnDestroy, ViewChild, signal, computed, numberAttribute, input, untracked, LOCALE_ID} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {PostFormComponent} from '../components/post-form/post-form.component';
import {TopicService} from '../services/topic.service';
import {Router, RouterLink, ActivatedRoute} from '@angular/router';

import {CharacterProfileComponent} from '../components/character-profile/character-profile.component';
import {TopicType, TopicStatus} from '../models/Topic';
import {EpisodeHeaderComponent} from '../components/episode-header/episode-header.component';
import {Post, PostReaction} from '../models/Post';
import {Reaction} from '../models/Reaction';
import {ApiService} from '../services/api.service';
import {BreadcrumbItem, BreadcrumbsComponent} from '../components/breadcrumbs/breadcrumbs.component';
import {ForumService} from '../services/forum.service';
import {TopicReadByComponent} from '../components/topic-read-by/topic-read-by.component';
import { CharacterSheetHeaderComponent } from '../components/character-sheet-header/character-sheet-header.component';
import { WantedCharacterHeaderComponent } from '../components/wanted-character-header/wanted-character-header.component';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';
import { RouterLinksDirective } from '../directives/router-links.directive';
import { CodeCopyDirective } from '../directives/code-copy.directive';
import { CharacterService } from '../services/character.service';
import { AuthService } from '../services/auth.service';
import { BoardService } from '../services/board.service';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { EpisodeCreateComponent } from '../episode-create/episode-create.component';
import { CharacterCreateComponent } from '../character-create/character-create.component';
import { WantedCharacterCreateComponent } from '../wanted-character-create/wanted-character-create.component';
import { WantedCharacterService } from '../services/wanted-character.service';
import { EpisodeService } from '../services/episode.service';
import { PreviewService } from '../services/preview.service';
import { LoreTopicHeaderComponent } from '../components/lore-topic-header/lore-topic-header.component';
import { UserInfoComponent } from '../components/user-info/user-info.component';
import { StandardWarning } from '../models/StandardWarning';
import { FormsModule } from '@angular/forms';
import { PostSidebarComponent } from '../components/post-sidebar/post-sidebar.component';

function coerceToPage(value: unknown): number {
  const num = numberAttribute(value, 1);
  return num < 1 ? 1 : num;
}

@Component({
  selector: 'app-viewtopic',
  host: { class: 'pun-page' },
  imports: [
    PostFormComponent,
    RouterLink,
    CharacterProfileComponent,
    EpisodeHeaderComponent,
    BreadcrumbsComponent,
    TopicReadByComponent,
    CharacterSheetHeaderComponent,
    WantedCharacterHeaderComponent,
    SafeHtmlPipe,
    EpisodeCreateComponent,
    CharacterCreateComponent,
    WantedCharacterCreateComponent,
    LoreTopicHeaderComponent,
    RouterLinksDirective,
    CodeCopyDirective,
    UserInfoComponent,
    FormsModule,
    PostSidebarComponent],
  templateUrl: './viewtopic.component.html',
  standalone: true,
})
export class ViewtopicComponent implements OnInit, OnDestroy {
  private titleService = inject(Title);
  private apiService = inject(ApiService);
  topicService = inject(TopicService);
  forumService = inject(ForumService);
  characterService = inject(CharacterService);
  episodeService = inject(EpisodeService);
  wantedCharacterService = inject(WantedCharacterService);
  authService = inject(AuthService);
  boardService = inject(BoardService);
  previewService = inject(PreviewService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  private locale = inject(LOCALE_ID);

  // Signal inputs for reactivity
  id = input<number | undefined, unknown>(undefined, { transform: numberAttribute });
  pageNumber = input<number, unknown>(1, { transform: coerceToPage, alias: 'page' });
  postId = input<number | undefined, unknown>(undefined, { transform: numberAttribute, alias: 'post_id' });

  topic = this.topicService.topic;
  subforum = this.forumService.subforum;
  userCharacterProfiles = this.characterService.userCharacterProfiles;

  accountName = this.authService.currentUser()?.username || 'Guest';
  selectedCharacterId: number | null = null;
  guestName: string = 'Guest';

  breadcrumbs: BreadcrumbItem[] = [];
  showPostForm = signal<boolean>(false);
  profilesReady = signal(false);
  sidebarMode = signal(false);
  sidebarProfileCompact = signal(false);
  readonly showAccountInForm = computed(() => this.topic().type !== TopicType.episode);
  readonly isProfilesLoading = computed(() => {
    const t = this.topic();
    return t.id !== 0 &&
      (t.type === TopicType.episode || t.type === TopicType.general) &&
      !this.profilesReady() &&
      (t.permissions?.subforum_post ?? false);
  });
  savedTopicCharacter = signal<number | undefined>(undefined);
  isTopicLoading = computed(() => !!this.id() && this.topic().id !== this.id());

  postsPerPage = computed(() => this.boardService.board().posts_per_page || 15);

  currentPagePosts = computed(() => {
    const page = this.pageNumber();
    const apiPosts = this.topicService.posts();
    const wsPosts = this.topicService.wsNewPosts()
      .filter(e => e.page === page)
      .map(e => e.post);
    return [...apiPosts, ...wsPosts];
  });

  hasNewPostsOnAnotherPage = computed(() =>
    this.topicService.wsNewPosts().some(e => e.page !== this.pageNumber())
  );

  totalPages = computed(() => {
    const totalPosts = this.topic()?.post_number || 0;
    return Math.ceil(totalPosts / this.postsPerPage());
  });

  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.pageNumber();
    if (total <= 1) return [];

    const pageSet = new Set<number>();
    pageSet.add(1);
    pageSet.add(total);
    for (let p = current - 1; p <= current + 1; p++) {
      if (p >= 1 && p <= total) pageSet.add(p);
    }

    const sorted = Array.from(pageSet).sort((a, b) => a - b);
    const result: Array<{ type: 'page' | 'ellipsis'; number?: number }> = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
        result.push({ type: 'ellipsis' });
      }
      result.push({ type: 'page', number: sorted[i] });
    }
    return result;
  });

  isSubscribed = signal<boolean>(false);

  editingPostId = signal<number | null>(null);
  editingPostProfileId = signal<number | null>(null);
  editingTopic = signal(false);
  showDeactivateModal = signal(false);
  postToDelete = signal<Post | null>(null);

  episodeWarnings = signal<StandardWarning[]>([]);
  warningsAcknowledged = signal(false);
  private warningsLoaded = signal(false);

  blurAcknowledged = signal(false);
  doNotBlurChecked = false;

  readonly isEpisodeParticipant = computed(() =>
    (this.topic().can_edit ?? false) || this.userCharacterProfiles().length > 0
  );

  isGmPostMode = signal(false);
  readonly showGmToggle = computed(() => this.topic().episode?.is_gm ?? false);
  readonly effectiveGmPost = computed(() => this.isGmPostMode());

  get shouldBlur(): boolean {
    if (this.blurAcknowledged()) return false;
    if (this.showPostForm()) return false;
    if (this.isEpisodeParticipant()) return false;
    const user = this.authService.currentUser();
    if (user && user.do_not_blur) return false;
    const raw = this.boardService.board().blur_content_starting_from_rate;
    const threshold = raw ? parseInt(raw, 10) : NaN;
    if (isNaN(threshold)) return false;
    const ep = this.topic()?.episode;
    if (!ep) return false;
    return (ep.rating_language ?? 0) >= threshold || (ep.rating_violence ?? 0) >= threshold || (ep.rating_sex ?? 0) >= threshold;
  }

  acknowledgeBlur() {
    this.blurAcknowledged.set(true);
    if (this.doNotBlurChecked && this.authService.currentUser()) {
      this.apiService.post('user/do-not-blur', { do_not_blur: true }).subscribe({
        next: () => this.authService.patchCurrentUser({ do_not_blur: true }),
        error: (err) => console.error('Failed to save do_not_blur', err)
      });
    }
  }

  reactionPickerPostId = signal<number | null>(null);
  activeReactions = signal<Reaction[]>([]);
  isSubmitting = signal(false);
  private activeReactionsLoaded = false;

  private destroy$ = new Subject<void>();
  private lastLoadedProfilesForTopicId: number | null = null;
  private pageLoadedSubscription: Subscription | null = null;
  private topicLoadedOnInit = false;
  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const topicId = this.id();
      if (topicId) {
        this.topicService.loadPosts(topicId, this.pageNumber(), this.postId());
      }
    }
  };

  @ViewChild('mainPostForm') postForm!: PostFormComponent;
  @ViewChild('characterProfileRef') characterProfileRef?: CharacterProfileComponent;

  acknowledgeWarnings() {
    this.warningsAcknowledged.set(true);
    const episodeId = this.topic()?.episode?.id;
    if (episodeId && this.authService.currentUser()) {
      this.episodeService.recordWarningsConsent(episodeId).subscribe();
    }
  }

  constructor() {
    effect(() => {
      const episode = this.topic()?.episode;
      if (!episode?.has_warnings || untracked(() => this.warningsLoaded())) return;
      this.warningsLoaded.set(true);
      const locale = this.locale.startsWith('ru') ? 'ru' : 'en';
      this.episodeService.getEpisodeWarnings(episode.id, locale).subscribe({
        next: (warnings) => this.episodeWarnings.set(warnings),
        error: () => this.warningsAcknowledged.set(true)
      });
    });

    // Clear stale character profiles as soon as the route ID changes, before new topic data arrives
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (this.lastLoadedProfilesForTopicId !== null && this.lastLoadedProfilesForTopicId !== id) {
          this.characterService.clearUserCharacterProfiles();
        }
      });
    });

    // Effect for breadcrumbs and profile loading
    effect(() => {
      const t = this.topic();
      const s = this.subforum();

      if (t.id !== 0) {
        if (s?.id !== t.subforum_id) {
           this.forumService.loadSubforum(t.subforum_id);
        }

        this.breadcrumbs = [
          { label: 'Home', link: '/' },
          ...(s ? [{ label: s.name, link: `/viewforum/${s.id}` }] : []),
          { label: t.name }
        ];

        this.titleService.setTitle(t.name);

        // Ensure we only load profiles once per topic, ignoring post updates
        const currentTopicId = untracked(() => this.id());

        if (currentTopicId && t.id === currentTopicId && this.lastLoadedProfilesForTopicId !== currentTopicId) {
          if (t.type === TopicType.character) {
            this.lastLoadedProfilesForTopicId = currentTopicId;
          } else if (t.type === TopicType.episode) {
            this.profilesReady.set(false);
            this.characterService.loadUserCharacterProfilesForTopic(currentTopicId).subscribe({
              next: () => this.profilesReady.set(true),
              error: () => this.profilesReady.set(true),
            });
            this.lastLoadedProfilesForTopicId = currentTopicId;
          } else if (t.type === TopicType.general) {
            this.profilesReady.set(false);
            this.characterService.loadUserCharacterProfilesForTopic(currentTopicId).subscribe({
              next: () => this.profilesReady.set(true),
              error: () => this.profilesReady.set(true),
            });
            this.lastLoadedProfilesForTopicId = currentTopicId;
            const saved = sessionStorage.getItem(`topic-char-${currentTopicId}`);
            this.savedTopicCharacter.set(saved !== null ? JSON.parse(saved) : undefined);
          }
        }
      }
    });

    // Effect for showing/hiding post form
    effect(() => {
      const t = this.topic();
      const profiles = this.userCharacterProfiles();
      const profilesReady = this.profilesReady();

      // Check topic permissions first
      if (!t.permissions || !t.permissions.subforum_post) {
        this.showPostForm.set(false);
        return;
      }

      if (t.status === TopicStatus.inactive || t.status === TopicStatus.full) {
        this.showPostForm.set(false);
        return;
      }

      if (t.type === TopicType.episode) {
        this.showPostForm.set(profilesReady && (profiles.length > 0 || (t.episode?.is_gm ?? false)));
      } else if (t.type === TopicType.general) {
        this.showPostForm.set(profilesReady);
      } else {
        this.showPostForm.set(true);
      }
    });

    effect(() => {
      const t = this.topic();
      if (t.id !== 0 && t.is_subscribed !== undefined) {
        this.isSubscribed.set(t.is_subscribed);
      }
    });

    // Restore post form content when returning from post preview
    effect(() => {
      if (this.showPostForm()) {
        const state = this.previewService.state();
        if (state?.formType === 'post' && state.formPayload?.content) {
          setTimeout(() => {
            if (this.postForm) {
              this.postForm.setValue(state.formPayload.content);
              this.previewService.clear();
            }
          });
        }
      }
    });

    // Effect to reload posts when page or topic ID changes
    effect(() => {
      const topicId = this.id();
      const page = this.pageNumber();
      const postId = this.postId();

      if (topicId) {
        // Always reload on first mount; after that, only reload if the topic ID changed
        if (!this.topicLoadedOnInit || untracked(() => this.topic().id) !== topicId) {
          this.topicLoadedOnInit = true;
          this.topicService.loadTopic(topicId).subscribe({
            next: (data) => this.topicService.setTopic(data),
            error: (err) => {
              if (err.status === 404) {
                setTimeout(() => this.router.navigate(['/404']));
              } else {
                console.error('Failed to load topic', err);
              }
            }
          });
        }
        // Always reload posts for the current page or post_id
        this.topicService.loadPosts(topicId, page, postId);
      }
    });
  }

  isEpisode() { return this.topic().type === TopicType.episode; }
  isGeneral() { return this.topic().type === TopicType.general; }
  isCharacter() { return this.topic().type === TopicType.character; }
  isWantedCharacter() { return this.topic().type === TopicType.wanted_character; }
  isLore() { return this.topic().type === TopicType.lore; }

  readonly topicTypeClass = computed(() =>
    'topic-type-' + TopicType[this.topic().type].replace('_', '-')
  );

  ngOnInit() {
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.topicService.ownPostAdded$.pipe(takeUntil(this.destroy$)).subscribe(({ postId, page }) => {
      this.isSubmitting.set(false);
      if (page !== this.pageNumber()) {
        this.router.navigate(['/viewtopic', this.id()], { queryParams: { page } });
      } else {
        setTimeout(() => document.getElementById(String(postId))?.scrollIntoView({ behavior: 'smooth' }));
      }
    });

    this.pageLoadedSubscription = this.topicService.pageLoaded$.subscribe(pageState => {
      const topicId = this.id();
      // Only sync if the page state is for the current topic
      if (pageState.topicId !== topicId) return;

      const currentInputPage = this.pageNumber();
      const currentPostId = this.postId();

      if ((pageState.page && pageState.page !== currentInputPage) || currentPostId) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page: pageState.page, post_id: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
          ...(currentPostId ? { fragment: String(currentPostId) } : {})
        });
      }
    });
  }

  ngOnDestroy() {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pageLoadedSubscription) {
      this.pageLoadedSubscription.unsubscribe();
    }
    this.topicService.clear();
  }

  onSidebarModeChange(active: boolean) {
    this.sidebarMode.set(active);
    if (!active) this.sidebarProfileCompact.set(false);
  }

  onDraftCharacterLoaded(characterId: number | null) {
    this.characterProfileRef?.selectCharacterById(characterId);
  }

  onCharacterSelected(characterId: number | null) {
    this.selectedCharacterId = characterId;
    const topicId = this.id();
    if (topicId && this.topic().type === TopicType.general) {
      if (characterId !== null) {
        sessionStorage.setItem(`topic-char-${topicId}`, JSON.stringify(characterId));
      } else {
        sessionStorage.removeItem(`topic-char-${topicId}`);
      }
    }
  }

  onAuthorMention(username: string) {
    if (!username || !this.postForm) return;
    this.postForm.insertAtCursor(`@${username}\u200A, `);
    this.postForm.focus();
    document.getElementById('post-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  onGuestNameChanged(name: string) {
    this.guestName = name;
  }

  copyPostLink(postId: number) {
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    url.searchParams.set('post_id', String(postId));
    navigator.clipboard.writeText(url.toString());
  }

  isPostAuthor(post: Post): boolean {
    return this.authService.currentUser()?.id === post.author_user_id;
  }

  editPost(post: Post, event: Event) {
    event.preventDefault();
    this.editingPostId.set(post.id);
    const profileId = post.use_character_profile ? (post.character_profile?.id ?? null) : null;
    this.editingPostProfileId.set(profileId);
  }

  cancelEdit() {
    this.editingPostId.set(null);
  }

  deletePost(post: Post, event: Event) {
    event.preventDefault();
    this.postToDelete.set(post);
  }

  confirmDeletePost() {
    const post = this.postToDelete();
    if (!post) return;
    this.postToDelete.set(null);
    this.topicService.deletePost(post.id).subscribe({
      next: () => this.topicService.removeLocalPost(post.id),
      error: (err: any) => console.error('Failed to delete post', err)
    });
  }

  quotePost(post: Post, event: Event) {
    event.preventDefault();

    let quoteContent = '';
    const selection = window.getSelection();

    if (selection && selection.toString().trim().length > 0) {
      quoteContent = selection.toString().trim();
    } else {
      quoteContent = post.content;
    }

    const authorName = post.use_character_profile && post.character_profile
      ? post.character_profile.character_name
      : post.user_profile?.user_name || 'Unknown';

    const formattedQuote = `[quote="${authorName}" user-id=${post.author_user_id} topic-id=${this.id()} post-id=${post.id}]${quoteContent}[/quote]\n`;

    if (this.postForm) {
      this.postForm.appendBbCode(formattedQuote);
      this.postForm.focus();
      document.getElementById('post-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  onUpdatePost(event: Event, post: Post, editForm: PostFormComponent) {
    event.preventDefault();
    const content = editForm.getValue();

    if (!content) return;

    const newProfileId = this.editingPostProfileId();
    const payload: any = {
      content,
      use_character_profile: newProfileId !== null,
      character_profile_id: newProfileId ?? undefined,
    };

    this.topicService.updatePost(post.id, payload).subscribe({
      next: (updatedPost: any) => {
        if (updatedPost && updatedPost.id) {
          this.topicService.updateLocalPost(updatedPost);
        } else {
          if (this.id()) this.topicService.loadPosts(this.id()!, this.pageNumber());
        }
        this.cancelEdit();
      },
      error: (err: any) => console.error('Failed to update post', err)
    });
  }

  onSubmit(event: Event) {
    event.preventDefault();
    const message = this.postForm.getValue();

    if (!message || !this.id()) return;
    if (this.isSubmitting()) return;

    this.isSubmitting.set(true);

    const topicId = +this.id()!;
    const userId = this.authService.currentUser()?.id ?? 0;
    const idempotencyKey = `${topicId}:${userId}:${Date.now()}:${simpleHash(message)}`;

    const payload: any = {
      topic_id: topicId,
      content: message,
      idempotency_key: idempotencyKey,
    };

    if (this.effectiveGmPost()) {
      payload.is_gm_post = true;
      payload.use_character_profile = false;
    } else {
      let characterProfileId: number | null = null;
      if (this.selectedCharacterId !== null && this.selectedCharacterId !== 'account' as any) {
        const profile = this.userCharacterProfiles().find(p => p.id === this.selectedCharacterId);
        if (profile) {
          characterProfileId = profile.id;
        }
      }
      payload.use_character_profile = this.selectedCharacterId !== null && this.selectedCharacterId !== 'account' as any;
      payload.character_profile_id = characterProfileId;
    }

    if (!this.authService.isAuthenticated()) {
      payload.guest_name = this.guestName;
    }

    const draftGroupId = this.postForm.currentDraftGroupId();
    if (draftGroupId) {
      payload.from_draft_id = draftGroupId;
    }

    this.postForm.cancelPendingAutosave();
    this.postForm.clear();

    setTimeout(() => document.getElementById('post-pending')?.scrollIntoView({ behavior: 'smooth' }));

    this.topicService.createPost(payload).subscribe({
      next: () => {
        this.postForm.reloadDrafts();
        if (!this.authService.isAuthenticated()) {
          window.location.reload();
        }
        // isSubmitting stays true — placeholder remains until the WS post_created event arrives.
        // Fallback: after 8 s request a catch-up (re-sends topic_view so the server replays
        // any missed post_created events). If the post still hasn't arrived after 3 more
        // seconds, give up and reload the page via loadPosts.
        setTimeout(() => {
          if (!this.isSubmitting()) return;
          this.topicService.requestCatchup();
          setTimeout(() => {
            if (this.isSubmitting()) {
              this.isSubmitting.set(false);
              const topicId = this.id();
              if (topicId) this.topicService.loadPosts(topicId, this.pageNumber());
            }
          }, 3000);
        }, 8000);
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        console.error('Failed to create post', err);
      }
    });
  }

  onPreview(event: Event) {
    event.preventDefault();
    const message = this.postForm.getValue();

    if (!message || !this.id()) return;

    const payload: any = {
      topic_id: +this.id()!,
      content: message,
    };

    if (this.effectiveGmPost()) {
      payload.is_gm_post = true;
      payload.use_character_profile = false;
    } else {
      let characterProfileId: number | null = null;
      if (this.selectedCharacterId !== null && this.selectedCharacterId !== 'account' as any) {
        const profile = this.userCharacterProfiles().find(p => p.id === this.selectedCharacterId);
        if (profile) {
          characterProfileId = profile.id;
        }
      }
      payload.use_character_profile = this.selectedCharacterId !== null && this.selectedCharacterId !== 'account' as any;
      payload.character_profile_id = characterProfileId;
    }

    if (!this.authService.isAuthenticated()) {
      payload.guest_name = this.guestName;
    }

    this.topicService.previewTopic(payload).subscribe({
      next: (previewPost: any) => {
        this.previewService.set({
          formType: 'post',
          topic: this.topic(),
          posts: this.currentPagePosts(),
          previewPost: previewPost,
          returnUrl: this.router.url,
          formPayload: { ...payload }
        });
        this.router.navigate(['/preview']);
      },
      error: (err: any) => console.error('Preview failed', err)
    });
  }

  editTopic(event: Event) {
    event.preventDefault();
    this.editingTopic.set(true);
  }

  cancelEditTopic() {
    this.editingTopic.set(false);
  }

  onUpdateTopic(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const titleInput = form.querySelector('input[name="title"]') as HTMLInputElement;
    const title = titleInput?.value;

    if (!title || !this.id()) return;

    const stickyCheckbox = form.querySelector('input[name="is_sticky_first_post"]') as HTMLInputElement;
    const payload = {
      name: title,
      is_sticky_first_post: stickyCheckbox?.checked ?? false
    };

    this.topicService.updateTopic(this.id()!, payload).subscribe({
      next: (updatedTopic: any) => {
        if (updatedTopic && updatedTopic.id) {
          this.topicService.updateLocalTopic(updatedTopic);
        } else {
          if (this.id()) this.topicService.loadTopic(this.id()!).subscribe({ next: (data) => this.topicService.setTopic(data) });
        }
        this.cancelEditTopic();
      },
      error: (err: any) => console.error('Failed to update topic', err)
    });
  }

  onUpdateLoreTopic(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const title = (form.querySelector('input[name="title"]') as HTMLInputElement)?.value;

    if (!title || !this.id()) return;

    this.apiService.post(`lore-topic/update/${this.id()}`, { name: title }).subscribe({
      next: (updatedTopic: any) => {
        if (updatedTopic && updatedTopic.id) {
          this.topicService.updateLocalTopic(updatedTopic);
        } else {
          if (this.id()) this.topicService.loadTopic(this.id()!).subscribe({ next: (data) => this.topicService.setTopic(data) });
        }
        this.cancelEditTopic();
      },
      error: (err: any) => console.error('Failed to update lore topic', err)
    });
  }

  activateTopic() {
    if (!this.id()) return;
    this.topicService.updateTopic(this.id()!, { status: 0 }).subscribe({
      next: (updatedTopic: any) => {
        if (updatedTopic?.id) this.topicService.updateLocalTopic(updatedTopic);
        else this.topicService.updateTopicStatus(0);
      },
      error: (err: any) => console.error('Failed to activate topic', err)
    });
  }

  requestDeactivateTopic() {
    this.showDeactivateModal.set(true);
  }

  confirmDeactivateTopic() {
    if (!this.id()) return;
    this.topicService.updateTopic(this.id()!, { status: 1 }).subscribe({
      next: (updatedTopic: any) => {
        if (updatedTopic?.id) this.topicService.updateLocalTopic(updatedTopic);
        else this.topicService.updateTopicStatus(1);
        this.showDeactivateModal.set(false);
      },
      error: (err: any) => console.error('Failed to deactivate topic', err)
    });
  }

  onUpdateComplexTopic(payload: any) {
    if (!this.id()) return;

    this.topicService.updateTopic(this.id()!, payload).subscribe({
      next: (updatedTopic: any) => {
        if (updatedTopic && updatedTopic.id) {
          this.topicService.updateLocalTopic(updatedTopic);
        } else {
          if (this.id()) this.topicService.loadTopic(this.id()!).subscribe({ next: (data) => this.topicService.setTopic(data) });
        }
        this.cancelEditTopic();
      },
      error: (err: any) => console.error('Failed to update topic', err)
    });
  }

  onUpdateCharacter(payload: any) {
    const charId = this.topic().character?.id;
    if (!charId) return;

    this.characterService.updateCharacter(charId, payload).subscribe({
      next: (updatedChar: any) => {
        // Reload topic to get updated character sheet data
        if (this.id()) this.topicService.loadTopic(this.id()!).subscribe({ next: (data) => this.topicService.setTopic(data) });
        this.cancelEditTopic();
      },
      error: (err: any) => console.error('Failed to update character', err)
    });
  }

  onUpdateWantedCharacter(payload: any) {
    const wantedCharId = this.topic().wanted_character?.id;
    if (!wantedCharId) return;

    const { subforum_id, ...body } = payload;
    this.wantedCharacterService.update(wantedCharId, body).subscribe({
      next: () => {
        if (this.id()) this.topicService.loadTopic(this.id()!).subscribe({ next: (data) => this.topicService.setTopic(data) });
        this.cancelEditTopic();
      },
      error: (err: any) => console.error('Failed to update wanted character', err)
    });
  }

  toggleSubscription() {
    const topicId = this.id();
    if (!topicId) return;
    const subscribing = !this.isSubscribed();
    const endpoint = subscribing ? `topic/${topicId}/subscribe` : `topic/${topicId}/unsubscribe`;
    this.apiService.post(endpoint, {}).subscribe({
      next: () => this.isSubscribed.set(subscribing),
      error: (err: any) => console.error('Failed to toggle subscription', err)
    });
  }

  onEpisodeStatusChanged(result: { episode_status: number; topic_status: number }) {
    this.topicService.updateEpisodeStatus(result.episode_status);
    this.topicService.updateTopicStatus(result.topic_status);
  }

  onUpdateEpisode(payload: any) {
    const episodeId = this.topic().episode?.id;
    if (!episodeId) return;

    this.episodeService.updateEpisode(episodeId, payload).subscribe({
      next: () => {
        if (this.id()) this.topicService.loadTopic(this.id()!).subscribe({ next: (data) => this.topicService.setTopic(data) });
        this.cancelEditTopic();
      },
      error: (err: any) => console.error('Failed to update episode', err)
    });
  }

  openReactionPicker(postId: number, event: Event) {
    event.stopPropagation();
    if (this.reactionPickerPostId() === postId) {
      this.reactionPickerPostId.set(null);
      return;
    }
    if (!this.activeReactionsLoaded) {
      this.apiService.get<Reaction[]>('reaction/list/active').subscribe({
        next: (list) => {
          this.activeReactions.set(list);
          this.activeReactionsLoaded = true;
        },
        error: (err) => console.error('Failed to load active reactions', err)
      });
    }
    this.reactionPickerPostId.set(postId);
  }

  closeReactionPicker() {
    this.reactionPickerPostId.set(null);
  }

  addReaction(postId: number, reactionId: number) {
    this.apiService.post<void>('post-reaction/create', { post_id: postId, reaction_id: reactionId }).subscribe({
      error: (err) => console.error('Failed to add reaction', err)
    });
    this.reactionPickerPostId.set(null);
  }
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
