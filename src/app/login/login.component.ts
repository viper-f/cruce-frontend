import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private userService = inject(UserService);


  isLoading = signal(false);
  archivedReason = signal<string | null>(null);

  loginForm = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  isFieldInvalid(field: string) {
    const control = this.loginForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      const credentials = this.loginForm.value;
      const password = credentials.password || '';

      this.authService.login(credentials as any).subscribe({
        next: () => {
          this.isLoading.set(false);
          // handleAuth already navigated to '/'. Start key decryption in background.
          this.authService.hashPassword(password).then(hashedPassword => {
            this.userService.loadAndDecryptPrivateKey(hashedPassword).subscribe();
          });
        },
        error: (err) => {
          this.isLoading.set(false);
          if (err.status === 403) {
            this.archivedReason.set(err.error?.reason ?? null);
          }
        }
      });
    }
  }
}
