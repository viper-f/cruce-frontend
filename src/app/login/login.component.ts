import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import {Router} from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);


  isLoading = signal(false);

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
          console.log('[Login] login succeeded, hashing password...');
          this.authService.hashPassword(password).then(hashedPassword => {
            console.log('[Login] password hashed, calling loadAndDecryptPrivateKey...');
            this.userService.loadAndDecryptPrivateKey(hashedPassword).subscribe({
              next: () => {
                console.log('[Login] private key loaded and cached successfully');
                this.isLoading.set(false);
                this.router.navigate(['/']);
              },
              error: (err) => {
                console.error('[Login] failed to load private key', err);
                this.isLoading.set(false);
                this.router.navigate(['/']);
              }
            });
          });
        },
        error: () => this.isLoading.set(false)
      });
    }
  }
}
