import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

type Step = 'code' | 'password' | 'loading' | 'done';

@Component({
  selector: 'app-restore-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './restore-password.component.html',
})
export class RestorePasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  step = signal<Step>('code');
  isLoading = signal(false);
  codeError = signal<string | null>(null);
  passwordError = signal<string | null>(null);
  showPassword = signal(false);

  private plainCode = '';
  private encryptedKeyData: { private_key: { private_key: string; iv: string; salt: string }; security_code: string } | null = null;

  private passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const pw = control.get('newPassword');
    const confirm = control.get('confirmPassword');
    if (pw && confirm && pw.value !== confirm.value) {
      confirm.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  };

  codeForm = this.fb.group({
    recoveryCode: ['', [Validators.required]]
  });

  passwordForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  isCodeInvalid(field: string): boolean {
    const c = this.codeForm.get(field);
    return !!(c && c.invalid && c.touched);
  }

  isPasswordInvalid(field: string): boolean {
    const c = this.passwordForm.get(field);
    return !!(c && c.invalid && c.touched);
  }

  submitCode() {
    if (this.codeForm.invalid) return;

    const code = this.codeForm.value.recoveryCode!;
    this.isLoading.set(true);
    this.codeError.set(null);

    this.plainCode = code;
    this.authService.hashPassword(code).then(hashedCode => {
      this.authService.recoverWithCode(hashedCode).subscribe({
      next: (data) => {
        this.encryptedKeyData = data;
        this.isLoading.set(false);
        this.step.set('password');
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 400) {
          this.codeError.set($localize`:@@restorePassword.invalidCode:The recovery code is incorrect or has already been used.`);
        } else {
          this.codeError.set($localize`:@@restorePassword.codeError:Something went wrong. Please try again.`);
        }
      }
    });
    });
  }

  async submitPassword() {
    if (this.passwordForm.invalid || !this.encryptedKeyData) return;

    this.isLoading.set(true);
    this.passwordError.set(null);

    try {
      const newPassword = this.passwordForm.value.newPassword!;
      const hashedNewPassword = await this.authService.hashPassword(newPassword);

      const { private_key: pkData, security_code } = this.encryptedKeyData;
      const pkcs8Buffer = await this.decryptKeyBuffer(pkData.private_key, pkData.iv, pkData.salt, this.plainCode);
      const reEncrypted = await this.encryptKeyBuffer(pkcs8Buffer, hashedNewPassword);

      this.authService.updatePasswordWithKey(
        hashedNewPassword,
        reEncrypted.private_key,
        reEncrypted.iv,
        reEncrypted.salt,
        security_code
      ).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.passwordError.set(err?.error?.error || err?.error?.message || $localize`:@@restorePassword.updateError:Failed to update password. Please try again.`);
        }
      });
    } catch (err) {
      console.error('[restore-password] crypto error', err);
      console.error('[restore-password] encryptedKeyData', this.encryptedKeyData);
      this.isLoading.set(false);
      this.passwordError.set($localize`:@@restorePassword.cryptoError:Failed to process recovery key. The code may be invalid.`);
    }
  }

  private toStandardBase64(str: string): string {
    const s = str.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
    return s.padEnd(s.length + (4 - s.length % 4) % 4, '=');
  }

  private async decryptKeyBuffer(
    privateKeyBase64: string,
    ivBase64: string,
    saltBase64: string,
    passphrase: string
  ): Promise<ArrayBuffer> {
    const encryptedBytes = Uint8Array.from(atob(this.toStandardBase64(privateKeyBase64)), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(this.toStandardBase64(ivBase64)), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(this.toStandardBase64(saltBase64)), c => c.charCodeAt(0));

    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, encryptedBytes);
  }

  private async encryptKeyBuffer(
    pkcs8Buffer: ArrayBuffer,
    passphrase: string
  ): Promise<{ private_key: string; iv: string; salt: string }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, pkcs8Buffer);

    const toBase64 = (buf: ArrayBuffer | Uint8Array) =>
      btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)));

    return {
      private_key: toBase64(encryptedBuffer),
      iv: toBase64(iv),
      salt: toBase64(salt)
    };
  }
}
