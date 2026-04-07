import { Component, inject, signal } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-create-user',
  standalone: true,
  imports: [],
  templateUrl: './admin-create-user.component.html',
  styleUrl: './admin-create-user.component.css'
})
export class AdminCreateUserComponent {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  success = signal(false);
  error = signal<string | null>(null);

  onSubmit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    this.success.set(false);
    this.error.set(null);

    from(this.authService.hashPassword(password)).pipe(
      switchMap(hashedPassword => this.apiService.post<void>('admin/user/create', { username, password: hashedPassword }))
    ).subscribe({
      next: () => {
        this.success.set(true);
        form.reset();
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Failed to create user')
    });
  }
}
