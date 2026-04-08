import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PreviewService } from '../services/preview.service';
import { TopicType } from '../models/Topic';
import { CharacterProfileComponent } from '../components/character-profile/character-profile.component';
import { EpisodeHeaderComponent } from '../components/episode-header/episode-header.component';
import { CharacterSheetHeaderComponent } from '../components/character-sheet-header/character-sheet-header.component';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';

@Component({
  selector: 'app-preview',
  imports: [CommonModule, CharacterProfileComponent, EpisodeHeaderComponent, CharacterSheetHeaderComponent, SafeHtmlPipe],
  standalone: true,
  templateUrl: './preview.component.html',
})
export class PreviewComponent {
  previewService = inject(PreviewService);
  router = inject(Router);

  state = this.previewService.state;
  TopicType = TopicType;

  returnToEdit() {
    const returnUrl = this.state()?.returnUrl;
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
    }
  }
}
