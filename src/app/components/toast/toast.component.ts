import { Component, inject, OnInit } from '@angular/core';
import {Notification} from '../../models/Notification';
import {NotificationService} from '../../services/notification.service';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-toast',
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  standalone: true,
  styleUrl: './toast.component.css'
})
export class ToastComponent implements OnInit {
  private notificationService = inject(NotificationService);
  notifications: Notification[] = [];

  ngOnInit() {
    this.notificationService.notification$.subscribe(event => {
      const newNotification: Notification = {
        id: Date.now(),
        title: event.title,
        message: event.message,
        from: 'System'
      };

      this.notifications.push(newNotification);

      // Auto-dismiss after 5 minutes (300000 ms)
      setTimeout(() => {
        this.remove(newNotification.id);
      }, 300000);
    });
  }

  remove(toastId: number) {
    this.notifications = this.notifications.filter(n => n.id !== toastId);
  }
}
