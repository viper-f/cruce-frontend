import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CharacterProfile, ShortMask } from '../models/Character';
import {ApiService} from './api.service';

@Injectable({
  providedIn: 'root'
})
export class MaskService {
  private apiService = inject(ApiService);

  getUserMasks(userId: number): Observable<CharacterProfile[]> {
    return this.apiService.get<CharacterProfile[]>(`user-masks/${userId}`);
  }

  getMask(id: number): Observable<CharacterProfile> {
    return this.apiService.get<CharacterProfile>(`mask/${id}`);
  }

  createMask(data: any): Observable<any> {
    return this.apiService.post('mask/create', data);
  }

  updateMask(id: number, data: any): Observable<any> {
    return this.apiService.post(`mask/update/${id}`, data);
  }

  searchMasks(term: string): Observable<ShortMask[]> {
    return this.apiService.get<ShortMask[]>(`mask-autocomplete/${term}`);
  }
}
