import { Component, Input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserInfo } from '../../models/User';

@Component({
  selector: 'app-user-info',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './user-info.component.html',
})
export class UserInfoComponent {
  @Input({ required: true }) userInfo!: UserInfo;

  statusLabel(status: number): string {
    switch (status) {
      case 0: return $localize`:@@common.statusActive:Active`;
      case 1: return $localize`:@@common.statusInactive:Inactive`;
      case 2: return $localize`:@@common.statusPending:Pending`;
      case 3: return $localize`:@@common.statusDeclined:Declined`;
      default: return String(status);
    }
  }

  statusClass(status: number): string {
    switch (status) {
      case 0: return 'status-badge status-active';
      case 1: return 'status-badge status-inactive';
      case 2: return 'status-badge status-pending';
      case 3: return 'status-badge status-declined';
      default: return 'status-badge';
    }
  }
}
