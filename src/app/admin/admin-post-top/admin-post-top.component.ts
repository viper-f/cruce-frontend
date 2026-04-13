import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PostTopService } from '../../services/post-top.service';
import { PostTop, PostTopCreateRequest } from '../../models/PostTop';

@Component({
  selector: 'app-admin-post-top',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-post-top.component.html',
  styleUrl: './admin-post-top.component.css',
})
export class AdminPostTopComponent implements OnInit {
  private postTopService = inject(PostTopService);

  tops = signal<PostTop[]>([]);
  showCreateForm = false;
  saving = signal(false);

  newTop: PostTopCreateRequest = this.emptyTop();

  ngOnInit(): void {
    this.postTopService.loadTops().subscribe({
      next: (data) => this.tops.set(data),
      error: (err) => console.error('Failed to load tops', err),
    });
  }

  openCreateForm(): void {
    this.newTop = this.emptyTop();
    this.showCreateForm = true;
  }

  cancelCreate(): void {
    this.showCreateForm = false;
  }

  create(): void {
    this.saving.set(true);
    this.postTopService.createTop(this.newTop).subscribe({
      next: (top) => {
        this.tops.update(list => [...list, top]);
        this.showCreateForm = false;
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Failed to create top', err);
        this.saving.set(false);
      },
    });
  }

  update(top: PostTop): void {
    this.postTopService.updateTop(top.id, {
      name: top.name,
      user_count: top.user_count,
      days: top.days,
      is_monthly: top.is_monthly,
      is_open: top.is_open,
      start_date: top.start_date,
    }).subscribe({
      next: (updated) => this.tops.update(list => list.map(t => t.id === updated.id ? updated : t)),
      error: (err) => console.error('Failed to update top', err),
    });
  }

  delete(id: number): void {
    this.postTopService.deleteTop(id).subscribe({
      next: () => this.tops.update(list => list.filter(t => t.id !== id)),
      error: (err) => console.error('Failed to delete top', err),
    });
  }

  private emptyTop(): PostTopCreateRequest {
    return { name: '', user_count: 10, days: null, is_monthly: false, is_open: true, start_date: null };
  }
}
