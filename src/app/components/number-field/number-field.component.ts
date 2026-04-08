import {Component, Input} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-number-field',
  imports: [FormsModule],
  templateUrl: './number-field.component.html',
  standalone: true,
})
export class NumberFieldComponent {
  @Input() fieldName: string | undefined;
  @Input() fieldValue: number | null = null;
  @Input() showFieldName: boolean = true;
  @Input() name: string | undefined;
}
