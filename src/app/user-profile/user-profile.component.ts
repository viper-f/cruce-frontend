import { Component, inject, Input, OnInit, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { FeatureService } from '../services/feature.service';
import { CurrencyService } from '../services/currency.service';

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
  protected featureService = inject(FeatureService);
  protected currencyService = inject(CurrencyService);

  userProfile = this.userService.userProfile;
  currentUser = this.authService.currentUser;

  activeCharacters = computed(() => (this.userProfile()?.characters ?? []).filter(c => c.character_status === 0));
  otherCharacters = computed(() => (this.userProfile()?.characters ?? []).filter(c => c.character_status !== 0));

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

  statusLabel(status: number): string {
    switch (status) {
      case 0: return $localize`:@@common.statusActive:Active`;
      case 1: return $localize`:@@common.statusInactive:Inactive`;
      case 2: return $localize`:@@common.statusPending:Pending`;
      case 3: return $localize`:@@common.statusDeclined:Declined`;
      default: return String(status);
    }
  }

  statusClass(status: number): string {
    switch (status) {
      case 0: return 'status-badge status-active';
      case 1: return 'status-badge status-inactive';
      case 2: return 'status-badge status-pending';
      case 3: return 'status-badge status-declined';
      default: return 'status-badge';
    }
  }

  addCharacter() {
    // Navigate to character creation or open modal
    console.log('Add character clicked');
  }
}
