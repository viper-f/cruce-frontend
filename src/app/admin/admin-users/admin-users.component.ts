import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

export interface AdminUserListItem {
  id: number;
  username: string;
  user_status: number;
  date_registered: string | null;
  date_last_visit: string | null;
  character_count: number;
  last_game_post_date: string | null;
}

export interface Role {
  id: number;
  name: string;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css'
})
export class AdminUsersComponent implements OnInit {
  private apiService = inject(ApiService);

  users = signal<AdminUserListItem[]>([]);
  allRoles = signal<Role[]>([]);
  rolesModalUser = signal<AdminUserListItem | null>(null);
  selectedRoleIds = signal<Set<number>>(new Set());

  banModalUser = signal<AdminUserListItem | null>(null);
  banReason = signal<string>('');

  editModalUser = signal<AdminUserListItem | null>(null);
  editUsername = signal<string>('');
  editAvatar = signal<string>('');

  ngOnInit() {
    this.apiService.get<AdminUserListItem[]>('admin/user-list').subscribe({
      next: (data) => this.users.set(data),
      error: (err) => console.error('Failed to load admin user list', err)
    });

    this.apiService.get<Role[]>('admin/role/list').subscribe({
      next: (data) => this.allRoles.set(data),
      error: (err) => console.error('Failed to load roles', err)
    });
  }

  openRolesModal(user: AdminUserListItem) {
    this.rolesModalUser.set(user);
    this.apiService.get<Role[]>(`admin/user/roles/${user.id}`).subscribe({
      next: (roles) => this.selectedRoleIds.set(new Set(roles.map(r => r.id))),
      error: () => this.selectedRoleIds.set(new Set())
    });
  }

  closeRolesModal() {
    this.rolesModalUser.set(null);
  }

  toggleRole(roleId: number) {
    const current = new Set(this.selectedRoleIds());
    if (current.has(roleId)) {
      current.delete(roleId);
    } else {
      current.add(roleId);
    }
    this.selectedRoleIds.set(current);
  }

  isRoleSelected(roleId: number): boolean {
    return this.selectedRoleIds().has(roleId);
  }

  openEditModal(user: AdminUserListItem) {
    this.editUsername.set(user.username);
    this.editAvatar.set('');
    this.editModalUser.set(user);
  }

  closeEditModal() {
    this.editModalUser.set(null);
  }

  submitEdit() {
    const user = this.editModalUser();
    if (!user) return;
    const body: { username?: string; avatar?: string } = {};
    const username = this.editUsername().trim();
    const avatar = this.editAvatar().trim();
    if (username && username !== user.username) body.username = username;
    if (avatar) body.avatar = avatar;
    this.apiService.post(`admin/user/update/${user.id}`, body).subscribe({
      next: () => {
        if (body.username) {
          this.users.update(list => list.map(u => u.id === user.id ? { ...u, username: body.username! } : u));
        }
        this.closeEditModal();
      },
      error: (err) => console.error('Failed to update user', err)
    });
  }

  openBanModal(user: AdminUserListItem) {
    this.banReason.set('');
    this.banModalUser.set(user);
  }

  closeBanModal() {
    this.banModalUser.set(null);
  }

  submitBan() {
    const user = this.banModalUser();
    if (!user) return;
    const body = { reason: this.banReason() };
    this.apiService.post(`admin/user/ban/${user.id}`, body).subscribe({
      next: () => this.closeBanModal(),
      error: (err) => console.error('Failed to ban user', err)
    });
  }

  saveRoles() {
    const user = this.rolesModalUser();
    if (!user) return;
    const body = { user_id: user.id, role_ids: Array.from(this.selectedRoleIds()) };
    this.apiService.post('admin/user/roles/update', body).subscribe({
      next: () => this.closeRolesModal(),
      error: (err) => console.error('Failed to update roles', err)
    });
  }
}
