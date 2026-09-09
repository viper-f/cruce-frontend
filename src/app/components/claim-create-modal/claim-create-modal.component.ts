import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FactionPathsComponent } from '../faction-paths/faction-paths.component';
import { CharacterClaimService } from '../../services/character-claim.service';
import { CharacterService } from '../../services/character.service';
import { Faction } from '../../models/Faction';

@Component({
  selector: 'app-claim-create-modal',
  standalone: true,
  imports: [FormsModule, FactionPathsComponent],
  templateUrl: './claim-create-modal.component.html',
})
export class ClaimCreateModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  private claimService = inject(CharacterClaimService);
  private characterService = inject(CharacterService);

  characterName = '';
  selectedFactionPaths: Faction[][] = [];

  onFactionsChanged(paths: Faction[][]) {
    this.selectedFactionPaths = paths;
  }

  get leafFactionId(): number | null {
    const firstPath = this.selectedFactionPaths[0];
    if (!firstPath || firstPath.length === 0) return null;
    return firstPath[firstPath.length - 1].id;
  }

  onSubmit() {
    const factionId = this.leafFactionId;
    if (!this.characterName.trim() || factionId === null) return;

    this.claimService.createRoleClaim(this.characterName.trim(), factionId).subscribe({
      next: () => {
        this.characterService.loadCharacterList();
        this.created.emit();
        this.close.emit();
      },
      error: (err) => console.error('Failed to create role claim', err)
    });
  }

  onCancel() {
    this.close.emit();
  }
}
