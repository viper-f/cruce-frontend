import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { LongTextFieldComponent } from '../components/long-text-field/long-text-field.component';
import { CharacterProfileComponent } from '../components/character-profile/character-profile.component';
import { AuthService } from '../services/auth.service';
import { TopicService } from '../services/topic.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CreateTopicRequest, Topic, TopicType, TopicStatus } from '../models/Topic';
import { Post } from '../models/Post';
import { PreviewService } from '../services/preview.service';

@Component({
  selector: 'app-topic-create',
  imports: [LongTextFieldComponent, CharacterProfileComponent],
  templateUrl: './topic-create.component.html',
  standalone: true,
})
export class TopicCreateComponent implements OnInit {
  private authService = inject(AuthService);
  private topicService = inject(TopicService);
  private previewService = inject(PreviewService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  accountName = this.authService.currentUser()?.username || 'Guest';
  selectedCharacterId: number | null = null;
  subforumId: number = 0;
  restoredTitle: string = '';
  restoredContent: string = '';

  @ViewChild(LongTextFieldComponent) messageField!: LongTextFieldComponent;

  ngOnInit() {
    const previewState = this.previewService.state();
    if (previewState?.formType === 'topic') {
      this.restoredTitle = previewState.formPayload.title;
      this.restoredContent = previewState.formPayload.content;
      this.previewService.clear();
    }

    this.route.queryParams.subscribe(params => {
      if (params['fid']) {
        this.subforumId = +params['fid'];
      }
    });
  }

  onCharacterSelected(characterId: number | null) {
    this.selectedCharacterId = characterId;
  }

  onSubmit(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const title = formData.get('req_subject') as string;
    const content = this.messageField.messageField.nativeElement.value;

    if (!title || !content || !this.subforumId) {
      console.error('Missing required fields');
      return;
    }

    const request: CreateTopicRequest = {
      subforum_id: this.subforumId,
      title: title,
      content: content,
      use_character_profile: this.selectedCharacterId !== null,
      character_profile_id: this.selectedCharacterId
    };

    const isPreview = ((event as SubmitEvent).submitter as HTMLInputElement | null)?.name === 'preview';

    if (isPreview) {
      this.topicService.previewTopic(request).subscribe({
        next: (post: Post) => {
          this.previewService.set({
            formType: 'topic',
            topic: {
              id: 0, name: request.title, subforum_id: request.subforum_id,
              date_created: '', date_last_post: '', date_last_post_localized: null,
              author_user_id: 0, author_username: '',
              post_number: 1, last_post_author_user_id: null, last_post_author_username: null,
              type: TopicType.general, status: TopicStatus.active,
              episode: null, character: null
            } as Topic,
            posts: [post],
            returnUrl: this.router.url,
            formPayload: { ...request }
          });
          this.router.navigate(['/preview']);
        },
        error: (err) => console.error('Preview failed', err)
      });
      return;
    }

    this.topicService.createTopic(request).subscribe({
      next: (response: any) => {
        console.log('Topic created successfully', response);
        // Assuming response contains the new topic ID, redirect to it
        // If not, redirect to the subforum
        if (response && response.id) {
            this.router.navigate(['/viewtopic', response.id]);
        } else {
            this.router.navigate(['/viewforum', this.subforumId]);
        }
      },
      error: (err) => console.error('Failed to create topic', err)
    });
  }
}
