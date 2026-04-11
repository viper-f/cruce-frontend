import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { CurrencyName, CurrencyIncomeType } from '../models/Currency';

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private apiService = inject(ApiService);

  private currencyNameSignal = signal<string>('');
  readonly currencyName = this.currencyNameSignal.asReadonly();

  private incomeTypesSignal = signal<CurrencyIncomeType[]>([]);
  readonly incomeTypes = this.incomeTypesSignal.asReadonly();

  loadCurrencyName(): void {
    this.apiService.get<CurrencyName>('currency/name').subscribe({
      next: (data) => this.currencyNameSignal.set(data.currency_name),
      error: (err) => console.error('Failed to load currency name', err)
    });
  }

  loadIncomeTypes(): void {
    this.apiService.get<CurrencyIncomeType[]>('currency/income-types').subscribe({
      next: (data) => this.incomeTypesSignal.set(data),
      error: (err) => console.error('Failed to load income types', err)
    });
  }

  updateCurrencyName(name: string) {
    return this.apiService.post<CurrencyName>('currency/name/update', { currency_name: name });
  }

  patchIncomeType(key: string, patch: Partial<CurrencyIncomeType>): void {
    this.incomeTypesSignal.update(list =>
      list.map(t => t.key === key ? { ...t, ...patch } : t)
    );
  }

  updateIncomeTypes(types: CurrencyIncomeType[]) {
    const payload = types.map(t => ({ key: t.key, amount: t.amount, is_active: t.is_active }));
    return this.apiService.post<CurrencyIncomeType[]>('currency/income-types/update', payload);
  }
}
