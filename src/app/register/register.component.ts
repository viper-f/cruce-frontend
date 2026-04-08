import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);

  private passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      // Set an error on the confirmPassword field specifically
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    return null;
  };

  registerForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, {
    validators: this.passwordMatchValidator // Apply validator to the group
  });

  togglePasswordVisibility() {
    this.showPassword.update(value => !value);
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading.set(true);
      // Destructure to remove confirmPassword before sending to API
      const { confirmPassword, ...registerData } = this.registerForm.value;

      const username = registerData.username || '';
      const password = registerData.password || '';

      const codes = this.userService.generateRecoveryCodes();

      this.authService.register(registerData).pipe(
        switchMap(() => this.authService.loginSilently({ username, password })),
        switchMap(() => from(this.authService.hashPassword(password))),
        switchMap(hashedPassword => this.userService.generateAndSaveKeys(hashedPassword, codes))
      ).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/recovery-codes'], { state: { codes } });
        },
        error: (err) => {
          this.isLoading.set(false);
          const backendError = err.error?.error || err.error?.message || 'Registration failed.';
          this.errorMessage.set(backendError);
        }
      });
    }
  }

  isInvalid(controlName: string): boolean {
    const control = this.registerForm.get(controlName);
    return !!(control && control.invalid && control.touched);
  }
}
