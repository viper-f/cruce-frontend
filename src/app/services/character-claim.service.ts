import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CharacterClaim, ClaimFactionResponse } from '../models/CharacterClaim';

@Injectable({ providedIn: 'root' })
export class CharacterClaimService {
  private apiService = inject(ApiService);

  factions = signal<ClaimFactionResponse[]>([]);

  createClaim(claim: { name: string; description: string | null; can_change_name: boolean }, factionIds: number[]): Observable<CharacterClaim> {
    return this.apiService.post<CharacterClaim>('character-claim/create', { claim, faction_ids: factionIds });
  }

  createRoleClaim(characterName: string, factionId: number): Observable<void> {
    return this.apiService.post<void>('role-claim/create', { character_name: characterName, faction_id: factionId });
  }

  load(): void {
    this.apiService.get<ClaimFactionResponse[]>('character-claims').subscribe({
      next: (data) => this.factions.set(data),
      error: (err) => console.error('Failed to load character claims', err)
    });
  }
}
