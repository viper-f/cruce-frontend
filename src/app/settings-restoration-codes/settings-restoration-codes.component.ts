import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { from, switchMap } from 'rxjs';

type Step = 'idle' | 'checking' | 'confirm' | 'loading' | 'done' | 'error';
type Mode = 'initial_setup' | 'regenerate';

@Component({
  selector: 'app-settings-restoration-codes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-restoration-codes.component.html',
})
export class SettingsRestorationCodesComponent {
  private authService = inject(AuthService);
  private userService = inject(UserService);

  step = signal<Step>('idle');
  mode = signal<Mode | null>(null);
  password = '';
  newCodes = signal<string[]>([]);
  errorMessage = signal<string | null>(null);

  private pendingCodes: string[] = [];

  async startGeneration() {
    this.step.set('checking');
    try {
      const hasKeyInDb = await this.userService.hasPrivateKeyInDb();
      if (hasKeyInDb) {
        this.mode.set('regenerate');
        this.step.set('confirm');
        return;
      }

      this.userService.checkPrivateKeySet().subscribe({
        next: (isSet) => {
          this.mode.set(isSet ? 'regenerate' : 'initial_setup');
          this.step.set('confirm');
        },
        error: () => {
          this.errorMessage.set('Failed to check account encryption status.');
          this.step.set('error');
        }
      });
    } catch {
      this.errorMessage.set('Failed to access local key storage.');
      this.step.set('error');
    }
  }

  generate() {
    if (!this.password) return;

    this.step.set('loading');

    const codes = this.userService.generateRecoveryCodes();
    this.pendingCodes = codes;

    from(this.authService.hashPassword(this.password)).pipe(
      switchMap(hashedPassword =>
        this.mode() === 'initial_setup'
          ? this.userService.initialSetupAndSaveKeys(hashedPassword, codes)
          : this.userService.saveRegeneratedRecoveryCodes(hashedPassword, codes)
      )
    ).subscribe({
      next: () => {
        this.newCodes.set(this.pendingCodes);
        this.step.set('done');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error || err?.error?.message || 'Failed to generate recovery codes.');
        this.step.set('error');
      }
    });
  }

  cancel() {
    this.password = '';
    this.step.set('idle');
    this.mode.set(null);
  }

  reset() {
    this.password = '';
    this.errorMessage.set(null);
    this.step.set('idle');
    this.mode.set(null);
  }
}
