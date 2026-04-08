import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WantedCharacter } from '../../models/WantedCharacter';
import { CustomFieldsData, CustomFieldValue } from '../../models/Character';
import { FieldTemplate } from '../../models/FieldTemplate';
import { FieldDisplayComponent } from '../field-display/field-display.component';

@Component({
  selector: 'app-wanted-character-header',
  standalone: true,
  imports: [CommonModule, FieldDisplayComponent],
  templateUrl: './wanted-character-header.component.html',
})
export class WantedCharacterHeaderComponent implements OnInit, OnChanges {
  @Input() wantedCharacter!: WantedCharacter | null;

  customFields: any[] = [];

  ngOnInit() {
    this.updateCustomFields();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['wantedCharacter']) {
      this.updateCustomFields();
    }
  }

  private updateCustomFields() {
    if (this.wantedCharacter?.custom_fields) {
      this.customFields = this.processCustomFields(this.wantedCharacter.custom_fields);
    } else {
      this.customFields = [];
    }
  }

  private processCustomFields(data: CustomFieldsData): any[] {
    if (!data || !data.field_config) return [];

    return data.field_config.map((config: FieldTemplate) => {
      const customField: CustomFieldValue | undefined = data.custom_fields ? data.custom_fields[config.machine_field_name] : undefined;
      let fieldValue: any = '';

      if (customField) {
        let content = customField.content;
        if (content !== null && content !== undefined && typeof content === 'object') {
          content = 'content' in content ? (content as any).content : '';
        }
        fieldValue = config.content_field_type === 'long_text'
          ? (customField.content_html || (content != null ? String(content) : ''))
          : content;
      }

      return {
        fieldMachineName: config.machine_field_name,
        fieldName: config.human_field_name,
        fieldValue: fieldValue ?? '',
        type: config.content_field_type,
        showFieldName: true,
        order: config.order
      };
    }).sort((a, b) => a.order - b.order);
  }
}
