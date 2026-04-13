import { Component, inject, Input, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PostTopService } from '../services/post-top.service';
import { PostTopResult } from '../models/PostTop';

@Component({
  selector: 'app-post-top',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './post-top.component.html',
  styleUrl: './post-top.component.css',
})
export class PostTopComponent implements OnInit {
  @Input() id!: number;

  private postTopService = inject(PostTopService);

  top: PostTopResult | null = null;
  loading = true;
  error = false;

  ngOnInit(): void {
    this.postTopService.getTop(this.id).subscribe({
      next: (data) => {
        this.top = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load post top', err);
        this.loading = false;
        this.error = true;
      },
    });
  }
}
