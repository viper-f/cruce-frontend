import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-image-field-display',
  imports: [],
  standalone: true,
  templateUrl: './image-field-display.component.html',
})
export class ImageFieldDisplayComponent {
  @Input() fieldName: string | undefined;
  @Input() fieldValue: string | undefined;
  @Input() showFieldName: boolean = true;
}
