import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { AdditionalNavlinkService } from '../../services/additional-navlink.service';
import { AdditionalNavlink, AdditionalNavlinkType } from '../../models/AdditionalNavlink';

@Component({
  selector: '[app-navlinks]',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navlinks.component.html',
})
export class NavlinksComponent {
  protected authService = inject(AuthService);
  private userService = inject(UserService);
  private additionalNavlinkService = inject(AdditionalNavlinkService);
  private router = inject(Router);

  public isAuthenticated = this.authService.isAuthenticated;
  public currentUser = this.authService.currentUser;
  public hasPrivateKey = this.userService.privateKey;
  public additionalNavlinks = this.additionalNavlinkService.navlinks;

  logout(event: Event) {
    event.preventDefault();
    this.authService.logout();
  }

  isLoginNavlinkActive(link: AdditionalNavlink): boolean {
    return link.type === AdditionalNavlinkType.Login && this.isAuthenticated();
  }

  handleNavlink(event: Event, link: AdditionalNavlink) {
    event.preventDefault();
    if (link.type === AdditionalNavlinkType.Login) {
      if (this.isAuthenticated()) return;
      const username = link.config['username'] ?? '';
      const password = link.config['password'] ?? '';
      this.authService.login({ username, password }).subscribe({
        next: () => {
          const url = link.config['url'];
          if (url) {
            this.router.navigateByUrl(url);
          } else if (this.router.url === '/') {
            window.location.reload();
          } else {
            this.router.navigateByUrl('/');
          }
        },
        error: (err) => console.error('Navlink login failed', err)
      });
    } else {
      const url = link.config['url'] ?? '/';
      this.router.navigateByUrl(url);
    }
  }
}
