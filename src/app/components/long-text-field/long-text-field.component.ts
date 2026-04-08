import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BbToolbarComponent } from '../bb-toolbar/bb-toolbar.component';

@Component({
  selector: 'app-long-text-field',
  imports: [CommonModule, BbToolbarComponent],
  templateUrl: './long-text-field.component.html',
  standalone: true,
})
export class LongTextFieldComponent {
  @Input() fieldName: string | undefined;
  @Input() fieldValue: string = '';
  @Input() showFieldName: boolean = true;
  @Input() name: string | undefined;
  @Input() rows: number = 20;

  @ViewChild('textareaEl') messageField!: ElementRef<HTMLTextAreaElement>;
}
