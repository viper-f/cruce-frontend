import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { Reaction } from '../../models/Reaction';

type UploadState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-admin-reactions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-reactions.component.html',
})
export class AdminReactionsComponent implements OnInit {
  private apiService = inject(ApiService);

  reactions = signal<Reaction[]>([]);
  uploadState = signal<UploadState>('idle');

  ngOnInit() {
    this.loadReactions();
  }

  private loadReactions() {
    this.apiService.get<Reaction[]>('reaction/list').subscribe({
      next: (list) => this.reactions.set(list),
      error: (err) => console.error('Failed to load reactions', err)
    });
  }

  toggle(reaction: Reaction) {
    const endpoint = reaction.is_active
      ? `reaction/deactivate/${reaction.id}`
      : `reaction/activate/${reaction.id}`;

    this.apiService.post(endpoint, {}).subscribe({
      next: () => this.reactions.update(list =>
        list.map(r => r.id === reaction.id ? { ...r, is_active: !r.is_active } : r)
      ),
      error: (err) => console.error('Failed to toggle reaction', err)
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    this.uploadState.set('loading');

    this.apiService.post<Reaction>('reaction/create', formData).subscribe({
      next: (reaction) => {
        this.reactions.update(list => [...list, reaction]);
        this.uploadState.set('success');
        setTimeout(() => this.uploadState.set('idle'), 3000);
        input.value = '';
      },
      error: (err) => {
        console.error('Failed to upload reaction', err);
        this.uploadState.set('error');
        setTimeout(() => this.uploadState.set('idle'), 3000);
      }
    });
  }
}
