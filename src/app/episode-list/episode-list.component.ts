import {Component, inject, OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Episode, EpisodeFilterRequest} from '../models/Episode';
import {CharacterShort} from '../models/Character';
import {FormsModule} from '@angular/forms';
import {TopicStatus} from '../models/Topic';
import {EpisodeService} from '../services/episode.service';
import {CharacterService} from '../services/character.service';
import {FactionService} from '../services/faction.service';
import {CommonModule} from '@angular/common';
import {debounceTime, distinctUntilChanged, Subject} from 'rxjs';
import {Faction} from '../models/Faction';


@Component({
  selector: 'app-episode-list',
  imports: [
    RouterLink,
    FormsModule,
    CommonModule
  ],
  templateUrl: './episode-list.component.html',
  standalone: true,
})
export class EpisodeListComponent implements OnInit {
  protected episodeService = inject(EpisodeService);
  protected characterService = inject(CharacterService);
  protected factionService = inject(FactionService);

  protected currentPage: number = 1;
  protected totalPages: number = 1;
  protected topics = this.episodeService.episodeListPage;
  protected selectedCharacters: CharacterShort[] = [];
  protected selectedSubforums: number[] = [];
  protected selectedFactions: number[] = [];
  protected searchQuery: string = '';
  protected characterSearchQuery: string = '';
  protected subforums = this.episodeService.subforumList;
  protected characterSuggestions = this.characterService.shortCharacterList;
  protected factions = this.factionService.factions;

  // Subject to handle search input debouncing
  private characterSearchTerms = new Subject<string>();

  constructor() {
    this.episodeService.loadSubforumList();
    this.factionService.loadFactions();
  }

  public ngOnInit(): void {
    this.characterSearchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.characterService.loadShortCharacterList(term);
    });

    this.applyFilters();
  }

  protected isSelected(id: number): boolean {
    return this.selectedSubforums.includes(id);
  }

  protected toggleForum(id: number): void {
    const index = this.selectedSubforums.indexOf(id);
    if (index > -1) {
      this.selectedSubforums.splice(index, 1);
    } else {
      this.selectedSubforums.push(id);
    }
  }

  protected onSearchChange() {
    this.characterSearchTerms.next(this.characterSearchQuery);
  }

  protected selectCharacter(character: CharacterShort) {
    // Check if character is not already selected
    if (!this.selectedCharacters.find(c => c.id === character.id)) {
      this.selectedCharacters.push(character);
    }
    // Clear search
    this.characterSearchQuery = '';
    // Clear suggestions in service
    this.characterService.loadShortCharacterList('');
  }

  protected removeChar(id: number) {
    const index = this.selectedCharacters.findIndex(c => c.id === id);
    if (index > -1) {
      this.selectedCharacters.splice(index, 1);
    }
  }

  protected toggleGroup(faction: Faction) {
    const index = this.selectedFactions.indexOf(faction.id);
    if (index > -1) {
      this.selectedFactions.splice(index, 1);
    } else {
      this.selectedFactions.push(faction.id);
    }
  }

  protected applyFilters() {
    const request: EpisodeFilterRequest = {
      subforum_ids: this.selectedSubforums,
      character_ids: this.selectedCharacters.map(c => c.id),
      faction_ids: this.selectedFactions,
      page: this.currentPage
    };

    this.episodeService.loadEpisodeListPage(this.currentPage, request);
  }

  protected readonly TopicStatus = TopicStatus;
}
