import { Component, inject, OnInit } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NotificationData } from '../../models/event';
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
export class ToastComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private audio = new Audio('/notification.mp3');
  notifications: NotificationData[] = [];

  ngOnInit() {
    this.notificationService.notification$.subscribe((event: NotificationData) => {
      if (!this.authService.currentUser()?.disable_sound) {
        this.audio.currentTime = 0;
        this.audio.play().catch(err => console.warn('Audio play failed:', err));
      }

      this.notifications = [...this.notifications, event];

      setTimeout(() => this.remove(event.id), 10000);
    });
  }

  remove(toastId: number) {
    const notification = this.notifications.find(n => n.id === toastId);
    if (notification) {
      this.notificationService.dismissNotification(notification);
    }
    this.notifications = this.notifications.filter(n => n.id !== toastId);
  }
}
