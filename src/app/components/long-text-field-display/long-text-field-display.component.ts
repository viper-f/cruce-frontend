import {Component, Input} from '@angular/core';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

@Component({
  selector: 'app-long-text-field-display',
  imports: [SafeHtmlPipe],
  templateUrl: './long-text-field-display.component.html',
  standalone: true,
})
export class LongTextFieldDisplayComponent {
  @Input() fieldMachineName: string | undefined;
  @Input() fieldName: string | undefined;
  @Input() fieldValue: string = '';
  @Input() showFieldName: boolean = true;
}
