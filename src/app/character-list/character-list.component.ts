import {Component, computed, inject, OnInit, signal} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CharacterService } from '../services/character.service';
import { FactionService } from '../services/faction.service';
import { WantedCharacterService } from '../services/wanted-character.service';
import { GlobalSettingsService } from '../services/global-settings.service';
import { AuthService } from '../services/auth.service';
import { Faction } from '../models/Faction';
import { CharacterListItem } from '../models/Character';
import { FactionCreateModalComponent } from '../components/faction-create-modal/faction-create-modal.component';
import { ClaimCreateModalComponent } from '../components/claim-create-modal/claim-create-modal.component';

@Component({
  selector: 'app-character-list',
  imports: [
    RouterLink,
    FormsModule,
    FactionCreateModalComponent,
    ClaimCreateModalComponent,
  ],
  templateUrl: './character-list.component.html',
  standalone: true,
})
export class CharacterListComponent implements OnInit {
  characterService = inject(CharacterService);
  factionService = inject(FactionService);
  private wantedCharacterService = inject(WantedCharacterService);
  private settingsService = inject(GlobalSettingsService);
  private authService = inject(AuthService);
  characterList = this.characterService.characterList;

  canAddFaction = computed(() => {
    const isGuest = !this.authService.isAuthenticated();
    return isGuest
      ? this.settingsService.isEnabled('allow_guests_create_factions')
      : this.settingsService.isEnabled('allow_users_create_factions');
  });

  canAddClaim = computed(() => {
    const isGuest = !this.authService.isAuthenticated();
    return isGuest
      ? this.settingsService.isEnabled('allow_guests_create_claims')
      : this.settingsService.isEnabled('allow_users_create_claims');
  });

  showCharacters = signal(true);
  showImportantRoles = signal(true);
  showWantedCharacters = signal(true);

  showAddFactionModal = signal(false);
  showAddClaimModal = signal(false);

  openAddFactionModal() {
    this.showAddFactionModal.set(true);
  }

  onFactionModalClose() {
    this.showAddFactionModal.set(false);
  }

  canRevokeChar(char: CharacterListItem): boolean {
    if (!char.claim_record_id) return false;
    const userId = this.authService.currentUser()?.id;
    if (userId && userId === char.claim_author_id) return true;
    if (char.claim_guest_hash) {
      const cookie = document.cookie.split('; ').find(c => c.startsWith(`claim_hash_${char.claim_guest_hash}=`));
      return !!cookie;
    }
    return false;
  }

  revokeCharClaim(char: CharacterListItem, event: Event) {
    event.preventDefault();
    if (!char.claim_record_id) return;
    this.wantedCharacterService.revokeClaimRecord(char.claim_record_id).subscribe({
      next: () => this.characterService.loadCharacterList(),
      error: (err) => console.error('Failed to revoke claim', err)
    });
  }

  onFactionCreated(faction: Faction) {
    this.factionService.createPendingFaction(faction).subscribe({
      next: () => this.characterService.loadCharacterList(),
      error: (err) => console.error('Failed to create faction', err)
    });
  }

  groupedCharacterList = computed(() => {
    const list = this.characterList();
    if (!list || list.length === 0) {
      return [];
    }

    const groups: Faction[][] = [];
    let currentGroup: Faction[] | null = null;

    for (const faction of list) {
      if (faction.level === 0) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = [faction];
      } else if (currentGroup) {
        currentGroup.push(faction);
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  });

  filteredGroupedCharacterList = computed(() => {
    const showChars = this.showCharacters();
    const showRoles = this.showImportantRoles();
    const showWanted = this.showWantedCharacters();

    return this.groupedCharacterList()
      .map(group =>
        group.map(faction => ({
          ...faction,
          characters: (faction.characters ?? []).filter(char => {
            if (!char.is_claim && showChars) return true;
            if (char.is_claim && char.wanted_character_id == null && showRoles) return true;
            if (char.wanted_character_id != null && showWanted) return true;
            return false;
          })
        }))
      )
      .filter(group => group.some(faction => faction.characters.length > 0));
  });

  ngOnInit() {
    this.characterService.loadCharacterList();
    this.settingsService.loadSettings();
  }

}
