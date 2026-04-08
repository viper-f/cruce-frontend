import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-short-text-field',
  imports: [],
  templateUrl: './short-text-field.component.html',
  standalone: true,
})
export class ShortTextFieldComponent {
  @Input() fieldName: string | undefined;
  @Input() fieldValue: string = '';
  @Input() showFieldName: boolean = true;
  @Input() name: string | undefined;
}
