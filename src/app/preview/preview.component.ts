import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PreviewService } from '../services/preview.service';
import { TopicType } from '../models/Topic';
import { TopicService } from '../services/topic.service';
import { CharacterProfileComponent } from '../components/character-profile/character-profile.component';
import { EpisodeHeaderComponent } from '../components/episode-header/episode-header.component';
import { CharacterSheetHeaderComponent } from '../components/character-sheet-header/character-sheet-header.component';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';
import { RouterLinksDirective } from '../directives/router-links.directive';

@Component({
  selector: 'app-preview',
  imports: [CommonModule, CharacterProfileComponent, EpisodeHeaderComponent, CharacterSheetHeaderComponent, SafeHtmlPipe, RouterLinksDirective],
  standalone: true,
  templateUrl: './preview.component.html',
})
export class PreviewComponent {
  previewService = inject(PreviewService);
  router = inject(Router);
  topicService = inject(TopicService);

  state = this.previewService.state;
  TopicType = TopicType;

  returnToEdit() {
    const returnUrl = this.state()?.returnUrl;
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
    }
  }

  submitPost() {
    const payload = this.state()?.formPayload;
    if (!payload) return;
    this.topicService.createPost(payload).subscribe({
      next: () => {
        this.previewService.clear();
        const returnUrl = this.state()?.returnUrl;
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
        }
      },
      error: (err: any) => console.error('Failed to create post', err)
    });
  }

  submitTopic() {
    const state = this.state();
    if (!state?.formPayload) return;
    const { createEndpoint, ...request } = state.formPayload;
    this.topicService.createTopic(request, createEndpoint).subscribe({
      next: (response: any) => {
        this.previewService.clear();
        if (response?.id) {
          this.router.navigate(['/viewtopic', response.id]);
        } else {
          this.router.navigate(['/viewforum', request.subforum_id]);
        }
      },
      error: (err: any) => console.error('Failed to create topic', err)
    });
  }
}
