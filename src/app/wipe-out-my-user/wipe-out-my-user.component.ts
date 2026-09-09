import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-wipe-out-my-user',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './wipe-out-my-user.component.html',
})
export class WipeOutMyUserComponent {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);

  showConfirmModal = signal(false);
  isLoading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.group({
    recoveryCode: ['', [Validators.required]]
  });

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && c.touched);
  }

  requestWipe() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.showConfirmModal.set(true);
  }

  cancelWipe() {
    this.showConfirmModal.set(false);
  }

  confirmWipe() {
    this.showConfirmModal.set(false);
    this.isLoading.set(true);
    this.error.set(null);

    this.apiService.post<void>('user/wipe', { recovery_code: this.form.value.recoveryCode }).subscribe({
      next: () => {
        this.authService.logout();
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.error?.error || $localize`:@@wipeOutMyUser.error:Something went wrong. Please check your recovery code and try again.`);
      }
    });
  }
}
