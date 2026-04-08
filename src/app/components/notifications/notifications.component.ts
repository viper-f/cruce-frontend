import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { NotificationData } from '../../models/event';
import { Router, RouterLink } from '@angular/router';
import { DirectChatService } from '../../services/direct-chat.service';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './notifications.component.html',
  standalone: true,
})
export class NotificationsComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private directChatService = inject(DirectChatService);
  private router = inject(Router);

  systemNotifications = this.notificationService.systemNotifications;
  gameNotifications = this.notificationService.gameNotifications;
  mentionNotifications = this.notificationService.mentionNotifications;
  directMessageNotifications = this.notificationService.directMessageNotifications;
  dmNotifications = computed(() => this.directChatService.chatList().filter(c => c.unread_count > 0));

  activeModal: string | null = null;

  ngOnInit() {
    this.notificationService.loadUnreadNotifications();
    this.directChatService.loadChatList();
  }

  openModal(type: string) {
    this.activeModal = type;
  }

  closeModal() {
    this.activeModal = null;
  }

  dismissNotification(notification: NotificationData, event: MouseEvent) {
    event.stopPropagation();
    this.notificationService.dismissNotification(notification);
  }

  onNotificationClick(item: NotificationData) {
    this.notificationService.dismissNotification(item);
    this.closeModal();
  }
}
