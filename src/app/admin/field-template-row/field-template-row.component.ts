import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FieldTemplate } from '../../models/FieldTemplate';

export interface FieldTemplateForm extends FieldTemplate {
  id?: number;
}

@Component({
  selector: 'app-field-template-row',
  imports: [FormsModule],
  templateUrl: './field-template-row.component.html',
  styleUrl: './field-template-row.component.css',
  standalone: true
})
export class FieldTemplateRowComponent {
  @Input() field!: FieldTemplateForm;
  @Input() index!: number;
  @Output() remove = new EventEmitter<void>();

  fieldTypes = ['string', 'text', 'int', 'decimal', 'date'];
  contentFieldTypes = ['short_text', 'number', 'decimal', 'long_text', 'image', 'cropped_image'];
}
