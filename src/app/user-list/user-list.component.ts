import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../services/user.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './user-list.component.html',
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);

  showArchived = signal(false);

  filteredUserList = computed(() => {
    const list = this.userService.userList();
    return this.showArchived() ? list : list.filter(u => u.user_status !== 1);
  });

  ngOnInit() {
    this.userService.loadUserList();
  }
}
