import {Component, effect, inject, Input, OnInit, OnDestroy, ViewChild, signal, computed, numberAttribute, ViewChildren, QueryList, input, untracked} from '@angular/core';
import {PostFormComponent} from '../components/post-form/post-form.component';
import {TopicService} from '../services/topic.service';
import {Router, RouterLink, ActivatedRoute} from '@angular/router';
import {CommonModule} from '@angular/common';
import {CharacterProfileComponent} from '../components/character-profile/character-profile.component';
import {TopicType} from '../models/Topic';
import {EpisodeHeaderComponent} from '../components/episode-header/episode-header.component';
import {Post} from '../models/Post';
import {BreadcrumbItem, BreadcrumbsComponent} from '../components/breadcrumbs/breadcrumbs.component';
import {ForumService} from '../services/forum.service';
import {TopicReadByComponent} from '../components/topic-read-by/topic-read-by.component';
import { CharacterSheetHeaderComponent } from '../components/character-sheet-header/character-sheet-header.component';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe'
import { CharacterService } from '../services/character.service';
import { AuthService } from '../services/auth.service';
import { BoardService } from '../services/board.service';
import { Subject, Subscription } from 'rxjs';
import { EpisodeCreateComponent } from '../episode-create/episode-create.component';
import { CharacterCreateComponent } from '../character-create/character-create.component';
import { EpisodeService } from '../services/episode.service';
import { PreviewService } from '../services/preview.service';

function coerceToPage(value: unknown): number {
  const num = numberAttribute(value, 1);
  return num < 1 ? 1 : num;
}

@Component({
  selector: 'app-viewtopic',
  imports: [
    PostFormComponent,
    RouterLink,
    CommonModule,
    CharacterProfileComponent,
    EpisodeHeaderComponent,
    BreadcrumbsComponent,
    TopicReadByComponent,
    CharacterSheetHeaderComponent,
    SafeHtmlPipe,
    EpisodeCreateComponent,
    CharacterCreateComponent
  ],
  templateUrl: './viewtopic.component.html',
  standalone: true,
  styleUrl: './viewtopic.component.css'
})
export class ViewtopicComponent implements OnInit, OnDestroy {
  topicService = inject(TopicService);
  forumService = inject(ForumService);
  characterService = inject(CharacterService);
  episodeService = inject(EpisodeService);
  authService = inject(AuthService);
  boardService = inject(BoardService);
  previewService = inject(PreviewService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  // Signal inputs for reactivity
  id = input<number | undefined, unknown>(undefined, { transform: numberAttribute });
  pageNumber = input<number, unknown>(1, { transform: coerceToPage, alias: 'page' });
  postId = input<number | undefined, unknown>(undefined, { transform: numberAttribute, alias: 'post_id' });

  topic = this.topicService.topic;
  posts = this.topicService.posts;
  subforum = this.forumService.subforum;
  userCharacterProfiles = this.characterService.userCharacterProfiles;

  accountName = this.authService.currentUser()?.username || 'Guest';
  selectedCharacterId: number | null = null;
  guestName: string = 'Guest';

  breadcrumbs: BreadcrumbItem[] = [];
  showPostForm = signal<boolean>(false);
  loadProfiles = true;
  showAccount = true;

  postsPerPage = computed(() => this.boardService.board().posts_per_page || 15);

  totalPages = computed(() => {
    const totalPosts = this.topic()?.post_number || 0;
    return Math.ceil(totalPosts / this.postsPerPage());
  });

  editingPostId = signal<number | null>(null);
  editingTopic = signal(false);

  private destroy$ = new Subject<void>();
  private lastLoadedProfilesForTopicId: number | null = null;
  private pageLoadedSubscription: Subscription | null = null;

  @ViewChild('mainPostForm') postForm!: PostFormComponent;
  @ViewChildren('editPostForm') editPostForms!: QueryList<PostFormComponent>;

  constructor() {
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

        // Ensure we only load profiles once per topic, ignoring post updates
        const currentTopicId = untracked(() => this.id());

        if (currentTopicId && this.lastLoadedProfilesForTopicId !== currentTopicId) {
          if (t.type === TopicType.character) {
            this.loadProfiles = false;
            this.showAccount = true;
            this.lastLoadedProfilesForTopicId = currentTopicId;
          } else if (t.type === TopicType.episode) {
            this.loadProfiles = false;
            this.showAccount = false;
            this.characterService.loadUserCharacterProfilesForTopic(currentTopicId);
            this.lastLoadedProfilesForTopicId = currentTopicId;
          } else if (t.type === TopicType.general) {
            this.loadProfiles = false;
            this.showAccount = true;
            this.characterService.loadUserCharacterProfilesForTopic(currentTopicId);
            this.lastLoadedProfilesForTopicId = currentTopicId;
          }
        }
      }
    });

    // Effect for showing/hiding post form
    effect(() => {
      const t = this.topic();
      const profiles = this.userCharacterProfiles();

      // Check topic permissions first
      if (!t.permissions || !t.permissions.subforum_post) {
        this.showPostForm.set(false);
        return;
      }

      if (t.type === TopicType.episode) {
        this.showPostForm.set(profiles.length > 0);
      } else {
        this.showPostForm.set(true);
      }
    });

    // Restore post form content when returning from post preview
    effect(() => {
      if (this.showPostForm()) {
        const state = this.previewService.state();
        if (state?.formType === 'post' && state.formPayload?.content) {
          setTimeout(() => {
            if (this.postForm?.messageField) {
              this.postForm.messageField.nativeElement.value = state.formPayload.content;
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
        // Only reload the main topic data if the ID has actually changed
        if (this.topic().id !== topicId) {
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

  ngOnInit() {
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
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pageLoadedSubscription) {
      this.pageLoadedSubscription.unsubscribe();
    }
  }

  onCharacterSelected(characterId: number | null) {
    this.selectedCharacterId = characterId;
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

  editPost(post: Post, event: Event) {
    event.preventDefault();
    this.editingPostId.set(post.id);
  }

  cancelEdit() {
    this.editingPostId.set(null);
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

    const formattedQuote = `[quote=${authorName}]${quoteContent}[/quote]\n`;

    // Append to the main post form
    if (this.postForm && this.postForm.messageField) {
      const textarea = this.postForm.messageField.nativeElement;
      textarea.value += formattedQuote;
      textarea.focus();
      textarea.scrollTop = textarea.scrollHeight;

      // Scroll to the form
      document.getElementById('post-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  onUpdatePost(event: Event, postId: number) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const textarea = form.querySelector('textarea');
    const content = textarea?.value;

    if (!content) return;

    const payload = {
      content: content
    };

    this.topicService.updatePost(postId, payload).subscribe({
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
    const message = this.postForm.messageField.nativeElement.value;

    if (!message || !this.id()) return;

    let characterProfileId: number | null = null;
    if (this.selectedCharacterId !== null && this.selectedCharacterId !== 'account' as any) {
      const profile = this.userCharacterProfiles().find(p => p.id === this.selectedCharacterId);
      if (profile) {
        characterProfileId = profile.id;
      }
    }

    const payload: any = {
      topic_id: +this.id()!,
      content: message,
      use_character_profile: this.selectedCharacterId !== null && this.selectedCharacterId !== 'account' as any,
      character_profile_id: characterProfileId
    };

    if (!this.authService.isAuthenticated()) {
      payload.guest_name = this.guestName;
    }

    this.topicService.createPost(payload).subscribe({
      next: () => {
        this.postForm.messageField.nativeElement.value = '';
        if (!this.authService.isAuthenticated()) {
          // Force reload to get updated view for guests
          window.location.reload();
        }
      },
      error: (err: any) => console.error('Failed to create post', err)
    });
  }

  onPreview(event: Event) {
    event.preventDefault();
    const message = this.postForm.messageField.nativeElement.value;

    if (!message || !this.id()) return;

    let characterProfileId: number | null = null;
    if (this.selectedCharacterId !== null && this.selectedCharacterId !== 'account' as any) {
      const profile = this.userCharacterProfiles().find(p => p.id === this.selectedCharacterId);
      if (profile) {
        characterProfileId = profile.id;
      }
    }

    const payload: any = {
      topic_id: +this.id()!,
      content: message,
      use_character_profile: this.selectedCharacterId !== null && this.selectedCharacterId !== 'account' as any,
      character_profile_id: characterProfileId
    };

    this.topicService.previewTopic(payload).subscribe({
      next: (previewPost: any) => {
        this.previewService.set({
          formType: 'post',
          topic: this.topic(),
          posts: this.posts(),
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

    const payload = {
      title: title
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
}
