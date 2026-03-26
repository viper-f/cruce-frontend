import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Post } from '../../models/Post';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

@Component({
  selector: 'post-insert',
  standalone: true,
  imports: [SafeHtmlPipe],
  template: `
    @if (contentHtml(); as html) {
      <div [innerHTML]="html | safeHtml"></div>
    }
  `
})
export class PostInsertComponent implements OnInit {
  @Input() dataInsert!: string;

  private apiService = inject(ApiService);
  contentHtml = signal<string | null>(null);

  ngOnInit() {
    if (!this.dataInsert) return;
    this.apiService.get<Post>(`post/${this.dataInsert}`).subscribe({
      next: (post) => this.contentHtml.set(post.content_html),
      error: (err) => console.error('post-insert failed to load', err)
    });
  }
}
