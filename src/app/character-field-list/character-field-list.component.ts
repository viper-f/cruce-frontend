import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-character-field-list',
  standalone: true,
  templateUrl: './character-field-list.component.html',
})
export class CharacterFieldListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);

  humanFieldName = signal<string>('');
  items = signal<string[]>([]);

  ngOnInit() {
    const machineName = this.route.snapshot.paramMap.get('field')!;
    this.apiService.get<{ human_field_name: string; values: string[] }>(`character/field-list/${machineName}`).subscribe({
      next: (data) => {
        this.humanFieldName.set(data.human_field_name);
        this.items.set(data.values);
      },
      error: (err) => console.error('Failed to load field list', err)
    });
  }
}
