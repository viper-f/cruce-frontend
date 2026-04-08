import { Component, inject, Input, OnInit, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './user-profile.component.html',
})
export class UserProfileComponent implements OnInit {
  @Input() id?: number;

  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router = inject(Router);

  userProfile = this.userService.userProfile;
  currentUser = this.authService.currentUser;

  isOwnProfile = computed(() => {
    const profile = this.userProfile();
    const current = this.currentUser();
    return profile && current && profile.user_id === current.id;
  });

  ngOnInit() {
    if (this.id) {
      this.userService.loadUserProfile(this.id).subscribe({
        next: (data) => this.userService.userProfileSignal.set(data),
        error: (err) => {
          if (err.status === 404) {
            setTimeout(() => this.router.navigate(['/404']));
          } else {
            console.error('Failed to load user profile', err);
          }
        }
      });
    }
  }

  addCharacter() {
    // Navigate to character creation or open modal
    console.log('Add character clicked');
  }
}
