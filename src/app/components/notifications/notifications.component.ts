import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { NotificationData } from '../../models/event';
import { Router, RouterLink } from '@angular/router';
import { DirectChatService } from '../../services/direct-chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './notifications.component.html',
  standalone: true,
})
export class NotificationsComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private directChatService = inject(DirectChatService);
  private authService = inject(AuthService);
  private router = inject(Router);

  systemNotifications = this.notificationService.systemNotifications;
  gameNotifications = this.notificationService.gameNotifications;
  mentionNotifications = this.notificationService.mentionNotifications;
  directMessageNotifications = this.notificationService.directMessageNotifications;
  reactionNotifications = this.notificationService.reactionNotifications;
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

  isTypeDisabled(type: string): boolean {
    return this.authService.currentUser()?.notification_settings
      ?.find(s => s.notification_type === type)?.disable_all ?? false;
  }
}
