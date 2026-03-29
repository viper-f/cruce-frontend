import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ClaimFactionResponse } from '../models/CharacterClaim';

@Injectable({ providedIn: 'root' })
export class CharacterClaimService {
  private apiService = inject(ApiService);

  factions = signal<ClaimFactionResponse[]>([]);

  load(): void {
    this.apiService.get<ClaimFactionResponse[]>('character-claims').subscribe({
      next: (data) => this.factions.set(data),
      error: (err) => console.error('Failed to load character claims', err)
    });
  }
}
