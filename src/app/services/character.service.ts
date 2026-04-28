import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';
import { FieldTemplate } from "../models/FieldTemplate";
import { Faction } from "../models/Faction";
import { CharacterShort, CharacterProfile, CreateCharacterRequest, Character, CharacterListItem } from "../models/Character";
import { ClaimAutocompleteItem } from "../models/CharacterClaim";

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private apiService = inject(ApiService);
  private characterTemplateSignal = signal<FieldTemplate[]>([]);
  readonly characterTemplate = this.characterTemplateSignal.asReadonly();
  private characterListSignal = signal<Faction[]>([]);
  readonly characterList = this.characterListSignal.asReadonly();
  private shortCharacterListSignal = signal<CharacterShort[]>([]);
  readonly shortCharacterList = this.shortCharacterListSignal.asReadonly();
  private userCharactersSignal = signal<CharacterShort[]>([]);
  readonly userCharacters = this.userCharactersSignal.asReadonly();
  private userCharacterProfilesSignal = signal<CharacterProfile[]>([]);
  readonly userCharacterProfiles = this.userCharacterProfilesSignal.asReadonly();
  private characterProfileTemplateSignal = signal<FieldTemplate[]>([]);
  readonly characterProfileTemplate = this.characterProfileTemplateSignal.asReadonly();

  readonly characterSignal = signal<Character | null>(null);
  readonly character = this.characterSignal.asReadonly();

  private characterProfileSignal = signal<CharacterProfile | null>(null);
  readonly characterProfile = this.characterProfileSignal.asReadonly();

  loadCharacterTemplate(): void {
    this.apiService.get<FieldTemplate[]>('template/character/get').subscribe({
      next: (data) => {
        const sortedData = data.sort((a, b) => a.order - b.order);
        this.characterTemplateSignal.set(sortedData);
      },
      error: (err) => {
        console.error('Failed to load character template', err);
      }
    });
  }

  loadCharacterList(): void {
    this.apiService.get<Faction[]>('character-list').subscribe({
      next: (data) => {
        this.characterListSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load character list', err);
      }
    })
  }

  saveCharacterTemplate(template: FieldTemplate[]) {
    return this.apiService.post('template/character/update', template);
  }

  loadShortCharacterList(term: string): void {
    if (!term || term.trim() === '') {
      this.shortCharacterListSignal.set([]);
      return;
    }
    this.apiService.get<CharacterShort[]>(`character-autocomplete/${term}`).subscribe({
      next: (data) => {
        this.shortCharacterListSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load short character list', err);
        this.shortCharacterListSignal.set([]);
      }
    })
  }

  loadUserCharacters(): void {
    this.apiService.get<CharacterShort[]>('user/characters').subscribe({
      next: (data) => {
        this.userCharactersSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load user characters', err);
      }
    })
  }

  loadUserCharacterProfiles(): void {
    this.apiService.get<CharacterProfile[]>('user/character-profiles').subscribe({
      next: (data) => {
        this.userCharacterProfilesSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load user character profiles', err);
      }
    })
  }

  loadUserCharacterProfilesForTopic(topicId: number): void {
    this.apiService.get<CharacterProfile[]>(`user/character-profiles-topic/${topicId}`).subscribe({
      next: (data) => {
        this.userCharacterProfilesSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load user character profiles for topic', err);
        this.userCharacterProfilesSignal.set([]);
      }
    })
  }

  loadCharacterProfileTemplate(): void {
    this.apiService.get<FieldTemplate[]>('template/character_profile/get').subscribe({
      next: (data) => {
        const sortedData = data.sort((a, b) => a.order - b.order);
        this.characterProfileTemplateSignal.set(sortedData);
      },
      error: (err) => {
        console.error('Failed to load character profile template', err);
      }
    });
  }

  saveCharacterProfileTemplate(template: FieldTemplate[]) {
    return this.apiService.post('template/character_profile/update', template);
  }

  createCharacter(data: CreateCharacterRequest) {
    return this.apiService.post('character/create', data);
  }

  previewCharacter(data: any) {
    return this.apiService.post<any>('character/preview', data);
  }

  loadCharacter(id: number) {
    return this.apiService.get<Character>(`character/get/${id}`);
  }

  updateCharacter(id: number, data: any) {
    return this.apiService.post(`character/update/${id}`, data);
  }

  loadCharacterProfile(id: number): void {
    this.apiService.get<CharacterProfile>(`character-profile/get/${id}`).subscribe({
      next: (data) => {
        this.characterProfileSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load character profile', err);
        this.characterProfileSignal.set(null);
      }
    });
  }

  updateCharacterProfile(id: number, data: any) {
    return this.apiService.post(`character-profile/update/${id}`, data);
  }

  acceptCharacter(id: number) {
    return this.apiService.post(`character/accept/${id}`, {});
  }

  declineCharacter(id: number) {
    return this.apiService.post(`character/decline/${id}`, {});
  }

  activateCharacter(id: number) {
    return this.apiService.post<{ character_status: number, topic_status: number }>(`character/activate/${id}`, null);
  }

  deactivateCharacter(id: number) {
    return this.apiService.post<{ character_status: number, topic_status: number }>(`character/deactivate/${id}`, null);
  }

  pendingCharacter(id: number) {
    return this.apiService.post(`character/pending/${id}`, {});
  }

  private wantedCharacterTemplateSignal = signal<FieldTemplate[]>([]);
  readonly wantedCharacterTemplate = this.wantedCharacterTemplateSignal.asReadonly();

  loadWantedCharacterTemplate(): void {
    this.apiService.get<FieldTemplate[]>('template/wanted_character/get').subscribe({
      next: (data) => this.wantedCharacterTemplateSignal.set(data.sort((a, b) => a.order - b.order)),
      error: (err) => console.error('Failed to load wanted character template', err)
    });
  }

  saveWantedCharacterTemplate(template: FieldTemplate[]) {
    return this.apiService.post('template/wanted_character/update', template);
  }

  private claimAutocompleteSignal = signal<ClaimAutocompleteItem[]>([]);
  readonly claimAutocomplete = this.claimAutocompleteSignal.asReadonly();

  loadWantedCharacterAutocomplete(term: string): void {
    if (!term) { this.claimAutocompleteSignal.set([]); return; }
    this.apiService.get<ClaimAutocompleteItem[]>(`wanted-character-autocomplete/${term}`).subscribe({
      next: (data) => this.claimAutocompleteSignal.set(data),
      error: (err) => { console.error('Failed to load wanted character autocomplete', err); this.claimAutocompleteSignal.set([]); }
    });
  }

  loadClaimAutocomplete(term: string): void {
    if (!term) { this.claimAutocompleteSignal.set([]); return; }
    this.apiService.get<ClaimAutocompleteItem[]>(`claim-autocomplete/${term}`).subscribe({
      next: (data) => this.claimAutocompleteSignal.set(data),
      error: (err) => { console.error('Failed to load claim autocomplete', err); this.claimAutocompleteSignal.set([]); }
    });
  }

  clearClaimAutocomplete(): void {
    this.claimAutocompleteSignal.set([]);
  }
}
