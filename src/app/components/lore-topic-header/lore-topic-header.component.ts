import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-lore-topic-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './lore-topic-header.component.html',
})
export class LoreTopicHeaderComponent {
  @Input() topicId!: number;
}
