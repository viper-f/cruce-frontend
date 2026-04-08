import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CharacterProfile } from '../models/Character';
import { MaskService } from '../services/mask.service';

@Component({
  selector: 'app-mask-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mask-list.component.html',
})
export class MaskListComponent implements OnInit {
  // Accept the userId so it can be embedded dynamically anywhere
  @Input({ required: true }) userId!: number;

  private maskService = inject(MaskService);

  masks = signal<CharacterProfile[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadMasks();
  }

  private loadMasks(): void {
    this.maskService.getUserMasks(this.userId).subscribe({
      next: (data) => {
        this.masks.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load user masks', err);
        this.error.set('Could not load user masks.');
        this.isLoading.set(false);
      }
    });
  }
}
