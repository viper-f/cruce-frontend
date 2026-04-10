import { Component, HostListener, signal } from '@angular/core';

@Component({
  selector: 'app-scroll-nav',
  templateUrl: './scroll-nav.component.html',
  standalone: true,
})
export class ScrollNavComponent {
  showUp = signal(false);
  showDown = signal(true);

  @HostListener('window:scroll')
  onScroll() {
    const scrollTop = window.scrollY;
    const scrollBottom = scrollTop + window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    this.showUp.set(scrollTop > 250);
    this.showDown.set(scrollBottom < docHeight - 250);
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  scrollToBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }
}
