import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { FieldTemplate } from '../models/FieldTemplate';
import { GetWantedCharacterListRequest, WantedCharacter, WantedCharacterListResponse } from '../models/WantedCharacter';
import { Faction } from '../models/Faction';

@Injectable({ providedIn: 'root' })
export class WantedCharacterService {
  private apiService = inject(ApiService);

  private templateSignal = signal<FieldTemplate[]>([]);
  readonly template = this.templateSignal.asReadonly();

  private listSignal = signal<WantedCharacter[]>([]);
  readonly wantedCharacterList = this.listSignal.asReadonly();

  private totalPagesSignal = signal<number>(1);
  readonly totalPages = this.totalPagesSignal.asReadonly();

  loadListPage(request: GetWantedCharacterListRequest): void {
    this.apiService.post<WantedCharacterListResponse>('wanted-character/list', request).subscribe({
      next: (data) => {
        this.listSignal.set(data.items);
        this.totalPagesSignal.set(data.total_pages);
      },
      error: (err) => console.error('Failed to load wanted character list', err)
    });
  }

  private treeListSignal = signal<Faction[]>([]);
  readonly wantedCharacterTreeList = this.treeListSignal.asReadonly();

  loadTreeList(): void {
    this.apiService.get<Faction[]>('wanted-character/tree-list').subscribe({
      next: (data) => this.treeListSignal.set(data),
      error: (err) => console.error('Failed to load wanted character tree list', err)
    });
  }

  loadTemplate(): void {
    this.apiService.get<FieldTemplate[]>('template/wanted_character/get').subscribe({
      next: (data) => this.templateSignal.set(data.sort((a, b) => a.order - b.order)),
      error: (err) => console.error('Failed to load wanted character template', err)
    });
  }

  get(id: number): Observable<WantedCharacter> {
    return this.apiService.get<WantedCharacter>(`wanted-character/get/${id}`);
  }

  save(data: any): Observable<any> {
    return this.apiService.post('wanted-character/create', data);
  }

  update(id: number, data: any): Observable<any> {
    return this.apiService.post(`wanted-character/update/${id}`, data);
  }

  activate(id: number): Observable<{ wanted_character_status: number, topic_status: number }> {
    return this.apiService.post<{ wanted_character_status: number, topic_status: number }>(`wanted-character/activate/${id}`, null);
  }

  deactivate(id: number): Observable<{ wanted_character_status: number, topic_status: number }> {
    return this.apiService.post<{ wanted_character_status: number, topic_status: number }>(`wanted-character/deactivate/${id}`, null);
  }

  createClaimRecord(claimId: number): Observable<void> {
    return this.apiService.post<void>('claim-record/create', { claim_type: 'wanted_character', claim_id: claimId });
  }

  revokeClaimRecord(claimRecordId: number): Observable<void> {
    return this.apiService.post<void>('claim-record/revoke', { claim_record_id: claimRecordId });
  }
}
