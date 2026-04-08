import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-number-field-display',
  imports: [],
  templateUrl: './number-field-display.component.html',
  standalone: true,
})
export class NumberFieldDisplayComponent {
  @Input() fieldMachineName: string | undefined;
  @Input() fieldName: string | undefined;
  @Input() fieldValue: number | null = null;
  @Input() showFieldName: boolean = true;
}
