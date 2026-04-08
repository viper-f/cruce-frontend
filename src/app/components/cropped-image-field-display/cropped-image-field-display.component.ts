import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-cropped-image-field-display',
  imports: [],
  standalone: true,
  templateUrl: './cropped-image-field-display.component.html',
})
export class CroppedImageFieldDisplayComponent {
  @Input() fieldName: string | undefined;
  @Input() fieldValue: string | undefined;
  @Input() showFieldName: boolean = true;
}
