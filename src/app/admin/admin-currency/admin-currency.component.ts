import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyService } from '../../services/currency.service';
import { CurrencyIncomeType } from '../../models/Currency';

type SaveState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-admin-currency',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-currency.component.html',
  styleUrl: './admin-currency.component.css',
})
export class AdminCurrencyComponent implements OnInit {
  private currencyService = inject(CurrencyService);

  currencyName = '';
  incomeTypes = this.currencyService.incomeTypes;
  nameState = signal<SaveState>('idle');
  incomeTypesState = signal<SaveState>('idle');

  constructor() {
    effect(() => {
      this.currencyName = this.currencyService.currencyName();
    });
  }

  ngOnInit(): void {
    this.currencyService.loadCurrencyName();
    this.currencyService.loadIncomeTypes();
  }

  saveName(): void {
    this.nameState.set('loading');
    this.currencyService.updateCurrencyName(this.currencyName).subscribe({
      next: () => this.flash(this.nameState, 'success'),
      error: (err) => {
        console.error('Failed to save currency name', err);
        this.flash(this.nameState, 'error');
      }
    });
  }

  saveIncomeTypes(): void {
    this.incomeTypesState.set('loading');
    this.currencyService.updateIncomeTypes(this.incomeTypes()).subscribe({
      next: () => this.flash(this.incomeTypesState, 'success'),
      error: (err) => {
        console.error('Failed to save income types', err);
        this.flash(this.incomeTypesState, 'error');
      }
    });
  }

  updateIncomeType(type: CurrencyIncomeType, patch: Partial<CurrencyIncomeType>): void {
    this.currencyService.patchIncomeType(type.key, patch);
  }

  private flash(state: ReturnType<typeof signal<SaveState>>, value: 'success' | 'error'): void {
    state.set(value);
    setTimeout(() => state.set('idle'), 3000);
  }
}
