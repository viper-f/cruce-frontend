import {Component, computed, inject, OnInit, Signal} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CharacterService } from '../services/character.service';
import { Faction } from '../models/Faction';

@Component({
  selector: 'app-character-list',
  imports: [
    RouterLink
  ],
  templateUrl: './character-list.component.html',
  standalone: true,
  styleUrl: './character-list.component.css'
})
export class CharacterListComponent implements OnInit {
  characterService = inject(CharacterService);
  // Access the signal directly
  characterList = this.characterService.characterList;

  // Computed signal to group factions
  groupedCharacterList = computed(() => {
    const list = this.characterList();
    if (!list || list.length === 0) {
      return [];
    }

    const groups: Faction[][] = [];
    let currentGroup: Faction[] | null = null;

    for (const faction of list) {
      // Start a new group for Level 0
      if (faction.level === 0) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = [faction];
      }
      // Add descendants to the current group
      else if (currentGroup) {
        currentGroup.push(faction);
      }
    }

    // Push the last group
    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  });

  ngOnInit() {
    this.characterService.loadCharacterList();
  }

}
