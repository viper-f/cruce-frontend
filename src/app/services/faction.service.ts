import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import { Faction } from '../models/Faction';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FactionService {
  private apiService = inject(ApiService);

  currentFactionId = signal<number>(0);
  currentFactionChildren = signal<Faction[]>([]);
  factionsSignal = signal<Faction[]>([]);
  readonly factions = this.factionsSignal.asReadonly();

  constructor() {
    effect(() => {
      const parentId = this.currentFactionId();
      this.loadFactionChildren(parentId);
    });
  }

  getFactionChildren(id: number, includePending = false): Observable<Faction[]> {
    const params = includePending ? new HttpParams().set('include_pending', 'true') : undefined;
    return this.apiService.get<Faction[]>(`faction-children/${id}/get`, params);
  }

  loadFactionChildren(id: number): void {
    this.getFactionChildren(id).subscribe({
      next: (data) => {
        this.currentFactionChildren.set(data);
      },
      error: (err) => {
        console.error('Failed to load faction children', err);
        this.currentFactionChildren.set([]);
      }
    });
  }

  setCurrentFaction(id: number) {
    this.currentFactionId.set(id);
  }

  loadFactions(): void {
    this.apiService.get<Faction[]>('factions/get').subscribe({
      next: (data) => {
        this.factionsSignal.set(data);
      },
      error: (err) => {
        console.error('Failed to load factions', err);
      }
    })
  }

  private wantedFactionsSignal = signal<Faction[]>([]);
  readonly wantedFactions = this.wantedFactionsSignal.asReadonly();

  loadWantedFactions(): void {
    this.apiService.get<Faction[]>('factions/get/wanted').subscribe({
      next: (data) => this.wantedFactionsSignal.set(data),
      error: (err) => console.error('Failed to load wanted factions', err)
    });
  }

  factionTree = signal<Faction[]>([]);

  loadFactionTree(): void {
    this.apiService.get<Faction[]>('faction-tree').subscribe({
      next: (data) => this.factionTree.set(data),
      error: (err) => console.error('Failed to load faction tree', err)
    });
  }

  pendingFactions = signal<Faction[]>([]);

  loadPendingFactions(): void {
    this.apiService.get<Faction[]>('factions/pending').subscribe({
      next: (data) => this.pendingFactions.set(data),
      error: (err) => console.error('Failed to load pending factions', err)
    });
  }

  updateFaction(id: number, payload: Faction): Observable<Faction> {
    return this.apiService.post<Faction>(`faction/update/${id}`, payload);
  }

  updateFactionStatus(id: number, faction_status: number): Observable<Faction> {
    return this.apiService.post<Faction>(`faction/update/${id}`, { faction_status });
  }

  deleteFaction(id: number): Observable<void> {
    return this.apiService.get<void>(`faction/delete/${id}`);
  }

  createFaction(faction: Faction): Observable<Faction> {
    return this.apiService.post<Faction>('faction/create', faction);
  }

  createPendingFaction(faction: Faction): Observable<Faction> {
    return this.apiService.post<Faction>('faction/create-pending', faction);
  }
}
