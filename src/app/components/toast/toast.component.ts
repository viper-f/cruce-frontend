import { Component, inject, OnInit } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NotificationData } from '../../models/event';

@Component({
  selector: 'app-toast',
  imports: [CommonModule, RouterLink],
  templateUrl: './toast.component.html',
  standalone: true,
})
export class ToastComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private audio = new Audio('/notification.mp3');
  notifications: NotificationData[] = [];
  removingIds: number[] = [];

  private readonly ANIMATION_MS = 300;

  ngOnInit() {
    this.notificationService.notification$.subscribe((event: NotificationData) => {
      this.notifications = [...this.notifications, event];

      if (!this.authService.currentUser()?.disable_sound) {
        setTimeout(() => {
          this.audio.currentTime = 0;
          this.audio.play().catch(err => console.warn('Audio play failed:', err));
        });
      }

      setTimeout(() => this.remove(event.id), 10000);
    });
  }

  remove(toastId: number) {
    if (this.removingIds.includes(toastId)) return;
    this.removingIds = [...this.removingIds, toastId];

    setTimeout(() => {
      const notification = this.notifications.find(n => n.id === toastId);
      if (notification) {
        this.notificationService.dismissNotification(notification);
      }
      this.notifications = this.notifications.filter(n => n.id !== toastId);
      this.removingIds = this.removingIds.filter(id => id !== toastId);
    }, this.ANIMATION_MS);
  }
}
