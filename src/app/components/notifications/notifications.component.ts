import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { NotificationEvent } from '../../models/event';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './notifications.component.html',
  standalone: true,
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent implements OnInit {
  private notificationService = inject(NotificationService);

  notifications = signal<NotificationEvent[]>([]);

  systemNotifications = signal<NotificationEvent[]>([]);
  gameNotifications = signal<NotificationEvent[]>([]);
  mentionNotifications = signal<NotificationEvent[]>([]);

  activeModal: string | null = null;

  ngOnInit() {
    this.notificationService.notification$.subscribe(notification => {
      this.notifications.update(current => [notification, ...current]);
      this.categorizeNotifications();
    });
  }

  private categorizeNotifications() {
    const all = this.notifications();
    this.systemNotifications.set(all.filter(n => n.notification_type === 'system'));
    this.gameNotifications.set(all.filter(n => n.notification_type === 'game'));
    this.mentionNotifications.set(all.filter(n => n.notification_type === 'mention'));
  }

  openModal(type: string) {
    this.activeModal = type;
  }

  closeModal() {
    this.activeModal = null;
  }
}
