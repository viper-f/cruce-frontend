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
  styleUrl: './toast.component.css'
})
export class ToastComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private audio = new Audio('/notification.mp3');
  notifications: NotificationData[] = [];

  ngOnInit() {
    this.notificationService.notification$.subscribe((event: NotificationData) => {
      this.notifications.push(event);

      if (!this.authService.currentUser()?.disable_sound) {
        this.audio.currentTime = 0;
        this.audio.play().catch(err => console.warn('Audio play failed:', err));
      }

      // Auto-dismiss after 5 minutes (300000 ms)
      setTimeout(() => {
        this.remove(event.id);
      }, 300000);
    });
  }

  remove(toastId: number) {
    this.notifications = this.notifications.filter(n => n.id !== toastId);
  }
}
