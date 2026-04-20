import { Directive, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Apply to any element that renders backend HTML via [innerHTML].
 * Intercepts clicks on internal <a> tags and routes them through
 * the Angular Router to avoid full page reloads.
 */
@Directive({
  selector: '[appRouterLinks]',
  standalone: true,
})
export class RouterLinksDirective {
  private router = inject(Router);

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest('a');
    if (!target) return;

    const href = target.getAttribute('href');
    if (!href) return;

    // Let external links, anchors-only, and non-http(s) schemes pass through
    if (
      target.host !== window.location.host ||
      href.startsWith('#') ||
      !href.startsWith('http')
    ) {
      return;
    }

    event.preventDefault();
    const url = new URL(href);
    this.router.navigateByUrl(url.pathname + url.search + url.hash);
  }
}
