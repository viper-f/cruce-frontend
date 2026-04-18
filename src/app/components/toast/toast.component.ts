import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { CurrencyService } from '../../services/currency.service';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NotificationData } from '../../models/event';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-toast',
  imports: [CommonModule, RouterLink],
  templateUrl: './toast.component.html',
  standalone: true,
  animations: [
    trigger('toastAnim', [
      transition(':enter', [
        style({ transform: 'translateX(-120%)', opacity: 0 }),
        animate('300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms cubic-bezier(0.55, 0.055, 0.675, 0.19)',
          style({ transform: 'translateX(-120%)', opacity: 0 }))
      ])
    ])
  ]
})
export class ToastComponent implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  protected currencyService = inject(CurrencyService);
  private audio = new Audio('/notification.mp3');
  private destroy$ = new Subject<void>();
  notifications: NotificationData[] = [];

  ngOnInit() {
    this.notificationService.sound$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.audio.currentTime = 0;
        this.audio.play().catch(err => console.warn('Audio play failed:', err));
      });

    this.notificationService.notification$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: NotificationData) => {
        setTimeout(() => { this.notifications = [...this.notifications, event]; });
        setTimeout(() => this.autoRemove(event), 10000);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Called when the user manually closes a toast — always dismisses from the header too
  remove(toastId: number) {
    const notification = this.notifications.find(n => n.id === toastId);
    if (notification) {
      this.notificationService.dismissNotification(notification);
    }
    this.notifications = this.notifications.filter(n => n.id !== toastId);
  }

  // Called when a toast auto-dismisses — only dismisses account_update from the header
  private autoRemove(event: NotificationData) {
    if (event.type === 'account_update') {
      this.notificationService.dismissNotification(event);
    }
    this.notifications = this.notifications.filter(n => n.id !== event.id);
  }
}
