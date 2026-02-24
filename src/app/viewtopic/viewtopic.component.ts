import {Component, effect, inject, Input, OnInit, ViewChild, signal, computed} from '@angular/core';
import {PostFormComponent} from '../components/post-form/post-form.component';
import {TopicService} from '../services/topic.service';
import {Router, RouterLink} from '@angular/router';
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
    SafeHtmlPipe
  ],
  templateUrl: './viewtopic.component.html',
  standalone: true,
  styleUrl: './viewtopic.component.css'
})
export class ViewtopicComponent implements OnInit {
  topicService = inject(TopicService);
  forumService = inject(ForumService);
  characterService = inject(CharacterService);
  authService = inject(AuthService);
  router = inject(Router);

  @Input() id?: number;
  @Input() page: number = 1;

  topic = this.topicService.topic;
  posts = this.topicService.posts;
  subforum = this.forumService.subforum;
  userCharacterProfiles = this.characterService.userCharacterProfiles;

  accountName = this.authService.currentUser()?.username || 'Guest';
  selectedCharacterId: number | null = null;

  breadcrumbs: BreadcrumbItem[] = [];
  showPostForm = signal<boolean>(true);
  loadProfiles = true;
  showAccount = true;

  postsPerPage = 15;
  totalPages = computed(() => Math.ceil(this.topic().post_number / this.postsPerPage));

  @ViewChild(PostFormComponent) postForm!: PostFormComponent;

  constructor() {
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

        // Handle character profiles based on topic type
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

    effect(() => {
      const t = this.topic();
      const profiles = this.userCharacterProfiles();

      if (t.type === TopicType.episode) {
        this.showPostForm.set(profiles.length > 0);
      } else {
        this.showPostForm.set(true);
      }
    });
  }

  isEpisode() {
    return this.topic().type === TopicType.episode;
  }

  isGeneral() {
    return this.topic().type === TopicType.general;
  }

  isCharacter() {
    return this.topic().type === TopicType.character;
  }

  ngOnInit() {
    if (this.id) {
      this.topicService.loadTopic(this.id);
      this.topicService.loadPosts(this.id, this.page);
    }
  }

  onCharacterSelected(characterId: number | null) {
    this.selectedCharacterId = characterId;
  }

  goToPage(pageNumber: number) {
    if (pageNumber >= 1 && pageNumber <= this.totalPages()) {
      this.router.navigate(['/viewtopic', this.id], { queryParams: { page: pageNumber } });
    }
  }

  onSubmit(event: Event) {
    event.preventDefault();
    const message = this.postForm.messageField.nativeElement.value;

    if (!message || !this.id) return;

    const payload = {
      topic_id: +this.id,
      content: message,
      use_character_profile: this.selectedCharacterId !== null,
      character_profile_id: this.selectedCharacterId
    };

    this.topicService.createPost(payload).subscribe({
      next: () => {
        this.postForm.messageField.nativeElement.value = '';
      },
      error: (err) => console.error('Failed to create post', err)
    });
  }
}
