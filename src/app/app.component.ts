import {afterNextRender, Component, effect, inject, Injector, OnInit, computed, signal, HostBinding} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {FooterComponent} from './components/footer/footer.component';
import {NavlinksComponent} from './components/navlinks/navlinks.component';
import {filter, map, mergeMap} from 'rxjs';
import {ToastComponent} from './components/toast/toast.component';
import {ScrollNavComponent} from './components/scroll-nav/scroll-nav.component';
import {BoardService} from './services/board.service';
import {AuthService} from './services/auth.service';
import {FeatureService} from './services/feature.service';
import {CurrencyService} from './services/currency.service';
import {UserService} from './services/user.service';
import {NotificationsComponent} from './components/notifications/notifications.component';
import {NotificationService} from './services/notification.service';
import {ApiService} from './services/api.service';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FooterComponent, NavlinksComponent, ToastComponent, NotificationsComponent, ScrollNavComponent],
  templateUrl: './app.component.html',
  standalone: true,
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private authChannel = new BroadcastChannel('auth_channel');

  boardService = inject(BoardService);
  authService = inject(AuthService);
  private userService = inject(UserService);
  private apiService = inject(ApiService);
  private sanitizer = inject(DomSanitizer);

  headerPanelHtml = signal<SafeHtml>('');

  title = computed(() => this.boardService.board().site_name || 'Cuento');

  @HostBinding('class')
  get designClass(): string {
    return this.currentUser()?.interface_design || '';
  }

  pageId = 'pun-main';
  private currentPageType = 'unknown';
  private currentPageNumId = 0;
  currentUser = this.authService.currentUser;
  currentDate = new Date();
  private notificationService = inject(NotificationService);
  private featureService = inject(FeatureService);
  private currencyService = inject(CurrencyService);
  private injector = inject(Injector);

  constructor() {
    this.listenForAuthChanges();
    this.setupRouteListener();

    // Effect to connect/disconnect notification service based on auth state
    effect(() => {
      const user = this.currentUser();
      const token = this.authService.authToken();
      if (user && user.id !== 0 && token) {
        this.notificationService.connect(token);
      } else {
        this.notificationService.disconnect();
      }
    });

    // Effect to apply font size
    effect(() => {
      const user = this.currentUser();
      if (user && user.interface_font_size) {
        const fontSize = user.interface_font_size;
        document.documentElement.style.fontSize = `${fontSize * 100}%`;
      } else {
        document.documentElement.style.fontSize = '100%';
      }
    });
  }

  ngOnInit() {
    this.boardService.loadBoard();
    this.featureService.loadFeatures().subscribe(() => {
      if (this.featureService.isFeatureActive('currency')) {
        this.currencyService.loadSettings();
      }
    });
    this.loadHeaderPanel();

    this.notificationService.panelReload$.subscribe(event => {
      if (event.panel_name === 'header') {
        this.loadHeaderPanel();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.authService.isAuthenticated()) {
        this.notificationService.loadUnreadNotifications();
        this.notificationService.sendPageChange(this.currentPageType, this.currentPageNumId);
        this.loadHeaderPanel();
      }
    });
  }

  private loadHeaderPanel() {
    this.apiService.getText('panel/header/content').subscribe({
      next: html => {
        this.headerPanelHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
        afterNextRender(() => this.processHeaderPanel(), { injector: this.injector });
      },
      error: () => {}
    });
  }

  private setupRouteListener() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.activatedRoute),
      map(route => {
        while (route.firstChild) route = route.firstChild;
        return route;
      }),
      mergeMap(route => {
        // We need both data and params
        return route.data.pipe(
          map(data => ({ data, params: route.snapshot.params }))
        );
      })
    ).subscribe(({ data, params }) => {
      this.pageId = data['pageId'] || 'pun-index';

      // Send page change notification
      let pageType = 'unknown';
      let pageId = 0;

      switch (this.pageId) {
        case 'pun-viewtopic':
          pageType = 'topic';
          pageId = +params['id'] || 0;
          break;
        case 'pun-viewforum':
          pageType = 'forum';
          pageId = +params['id'] || 0;
          break;
        case 'pun-index':
          pageType = 'home';
          break;
        case 'pun-profile':
          pageType = 'profile';
          pageId = +params['id'] || 0;
          break;
        case 'pun-character':
          pageType = 'character';
          pageId = +params['id'] || 0;
          break;
        default:
          pageType = this.pageId.replace('pun-', '');
      }

      this.currentPageType = pageType;
      this.currentPageNumId = pageId;
      this.notificationService.sendPageChange(pageType, pageId);
    });
  }

  private listenForAuthChanges(): void {
    this.authChannel.onmessage = (event) => {
      if (event.data === 'logout') {
        // When another tab logs out, update this tab's state without notifying back
        this.authService.clearLocalAuth(false);
      } else if (event.data === 'login') {
        // When another tab logs in, reload the page to get the new state.
        // Guard: if this tab is already authenticated, the message came from ourselves — skip reload.
        if (!this.authService.isAuthenticated()) {
          window.location.reload();
        }
      }
    };
  }

  private widgetRefreshIntervals: ReturnType<typeof setInterval>[] = [];

  private processHeaderPanel() {
    this.widgetRefreshIntervals.forEach(id => clearInterval(id));
    this.widgetRefreshIntervals = [];

    const panel = document.getElementById('header-widget-panel');
    if (!panel) return;

    panel.querySelectorAll<HTMLElement>('[data-is-link="true"]').forEach(widget => {
      this.attachWidgetLinks(widget);
    });

    panel.querySelectorAll<HTMLElement>('[data-refresh-interval][data-widget-id]').forEach(widget => {
      const intervalSeconds = +(widget.getAttribute('data-refresh-interval') ?? 0);
      const widgetId = widget.getAttribute('data-widget-id');
      if (!intervalSeconds || !widgetId) return;

      const isLink = widget.getAttribute('data-is-link') === 'true';
      const id = setInterval(() => {
        this.apiService.getText(`widget/${widgetId}/render?innerOnly=true`).subscribe({
          next: html => {
            widget.innerHTML = html;
            if (isLink) this.attachWidgetLinks(widget);
          },
          error: () => {}
        });
      }, intervalSeconds * 1000);
      this.widgetRefreshIntervals.push(id);
    });
  }

  private attachWidgetLinks(widget: HTMLElement) {
    widget.querySelectorAll<HTMLElement>('[data-entity-type][data-entity-id]').forEach(child => {
      const entityType = child.getAttribute('data-entity-type');
      const entityId = child.getAttribute('data-entity-id');
      if (!entityType || !entityId) return;

      const route = this.entityRoute(entityType, +entityId);
      if (!route) return;

      child.style.cursor = 'pointer';
      child.addEventListener('click', () => this.router.navigate(route));
    });
  }

  private entityRoute(entityType: string, entityId: number): any[] | null {
    switch (entityType) {
      case 'character': return ['/character', entityId];
      case 'topic':
      case 'episode':
      case 'wanted_character': return ['/viewtopic', entityId];
      case 'user': return ['/profile', entityId];
      default: return null;
    }
  }

  protected readonly Date = Date;
}
