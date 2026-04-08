import {Component, computed, inject, OnInit, signal} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CharacterService } from '../services/character.service';
import { Faction } from '../models/Faction';

@Component({
  selector: 'app-character-list',
  imports: [
    RouterLink,
    FormsModule
  ],
  templateUrl: './character-list.component.html',
  standalone: true,
})
export class CharacterListComponent implements OnInit {
  characterService = inject(CharacterService);
  characterList = this.characterService.characterList;

  showCharacters = signal(true);
  showImportantRoles = signal(true);
  showWantedCharacters = signal(true);

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
  }

}
