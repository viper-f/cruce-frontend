import { Component, inject } from '@angular/core';
import { LongTextFieldComponent } from '../components/long-text-field/long-text-field.component';
import { CharacterProfileComponent } from '../components/character-profile/character-profile.component';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-topic-create',
  imports: [LongTextFieldComponent, CharacterProfileComponent],
  templateUrl: './topic-create.component.html',
  standalone: true,
  styleUrl: './topic-create.component.css'
})
export class TopicCreateComponent {
  private authService = inject(AuthService);

  accountName = this.authService.currentUser()?.username || 'Guest';
  selectedCharacterId: number | null = null;

  onCharacterSelected(characterId: number | null) {
    this.selectedCharacterId = characterId;
    console.log('Selected character ID:', this.selectedCharacterId);
  }
}
