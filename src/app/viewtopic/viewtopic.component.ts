import {Component, effect, inject, Input, OnInit, OnDestroy, ViewChild, signal, computed, numberAttribute, ViewChildren, QueryList} from '@angular/core';
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
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { EpisodeCreateComponent } from '../episode-create/episode-create.component';
import { CharacterCreateComponent } from '../character-create/character-create.component';

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
  authService = inject(AuthService);
  boardService = inject(BoardService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  @Input({ transform: numberAttribute }) id?: number;
  @Input({ transform: coerceToPage, alias: 'page' }) pageNumber: number = 1;

  topic = this.topicService.topic;
  posts = this.topicService.posts;
  currentPage = this.topicService.currentPage;
  subforum = this.forumService.subforum;
  userCharacterProfiles = this.characterService.userCharacterProfiles;

  accountName = this.authService.currentUser()?.username || 'Guest';
  selectedCharacterId: number | null = null;

  breadcrumbs: BreadcrumbItem[] = [];
  showPostForm = signal<boolean>(true);
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

        if (t.type === TopicType.character) {
          this.loadProfiles = false;
          this.showAccount = true;
        } else if (t.type === TopicType.episode) {
          this.loadProfiles = false;
          this.showAccount = false;
          this.characterService.loadUserCharacterProfilesForTopic(t.id);
        } else if (t.type === TopicType.general) {
          this.loadProfiles = false;
          this.showAccount = true;
          this.characterService.loadUserCharacterProfilesForTopic(t.id);
        }
      }
    });

    // Effect for showing/hiding post form
    effect(() => {
      const t = this.topic();
      const profiles = this.userCharacterProfiles();

      if (t.type === TopicType.episode) {
        this.showPostForm.set(profiles.length > 0);
      } else {
        this.showPostForm.set(true);
      }
    });

    // Sync page number with URL when it changes in service (e.g. from post_id redirect)
    effect(() => {
      const servicePage = this.currentPage();
      // We only update if the service page differs from our current input page
      // But pageNumber is an Input, so we check if we should navigate
      if (servicePage && servicePage !== this.pageNumber) {
        // We use router navigate to update the URL without reloading everything if possible,
        // or just to reflect state.
        // Important: avoid infinite loops.
        // We update query params.
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page: servicePage },
          queryParamsHandling: 'merge',
          replaceUrl: true // Replace history to avoid back button loops
        });
      }
    });
  }

  isEpisode() { return this.topic().type === TopicType.episode; }
  isGeneral() { return this.topic().type === TopicType.general; }
  isCharacter() { return this.topic().type === TopicType.character; }

  ngOnInit() {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([paramMap, queryParamMap]) => {
        const topicId = Number(paramMap.get('id'));
        const page = coerceToPage(queryParamMap.get('page'));
        const postId = Number(queryParamMap.get('post_id'));

        if (topicId) {
          // Only reload the main topic data if the ID has actually changed
          if (this.topic().id !== topicId) {
            this.topicService.loadTopic(topicId);
          }
          // Always reload posts for the current page or post_id
          this.topicService.loadPosts(topicId, page, postId || undefined);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCharacterSelected(characterId: number | null) {
    this.selectedCharacterId = characterId;
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
             if (this.id) this.topicService.loadPosts(this.id, this.pageNumber);
        }
        this.cancelEdit();
      },
      error: (err) => console.error('Failed to update post', err)
    });
  }

  onSubmit(event: Event) {
    event.preventDefault();
    const message = this.postForm.messageField.nativeElement.value;

    if (!message || !this.id) return;

    let characterProfileId: number | null = null;
    if (this.selectedCharacterId !== null) {
      const profile = this.userCharacterProfiles().find(p => p.character_id === this.selectedCharacterId);
      if (profile) {
        characterProfileId = profile.id;
      }
    }

    const payload = {
      topic_id: +this.id,
      content: message,
      use_character_profile: this.selectedCharacterId !== null,
      character_profile_id: characterProfileId
    };

    this.topicService.createPost(payload).subscribe({
      next: () => {
        this.postForm.messageField.nativeElement.value = '';
      },
      error: (err) => console.error('Failed to create post', err)
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

    if (!title || !this.id) return;

    const payload = {
      title: title
    };

    this.topicService.updateTopic(this.id, payload).subscribe({
      next: (updatedTopic: any) => {
        if (updatedTopic && updatedTopic.id) {
          this.topicService.updateLocalTopic(updatedTopic);
        } else {
          if (this.id) this.topicService.loadTopic(this.id);
        }
        this.cancelEditTopic();
      },
      error: (err) => console.error('Failed to update topic', err)
    });
  }

  onUpdateComplexTopic(payload: any) {
    if (!this.id) return;

    this.topicService.updateTopic(this.id, payload).subscribe({
      next: (updatedTopic: any) => {
        if (updatedTopic && updatedTopic.id) {
          this.topicService.updateLocalTopic(updatedTopic);
        } else {
          if (this.id) this.topicService.loadTopic(this.id);
        }
        this.cancelEditTopic();
      },
      error: (err) => console.error('Failed to update topic', err)
    });
  }
}
