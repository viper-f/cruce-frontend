import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Episode } from '../../models/Episode';
import { ShortTextFieldDisplayComponent } from '../short-text-field-display/short-text-field-display.component';
import { LongTextFieldDisplayComponent } from '../long-text-field-display/long-text-field-display.component';
import { NumberFieldDisplayComponent } from '../number-field-display/number-field-display.component';
import { CustomFieldsData, CustomFieldValue } from '../../models/Character';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-episode-header',
  imports: [CommonModule, RouterLink, ShortTextFieldDisplayComponent, LongTextFieldDisplayComponent, NumberFieldDisplayComponent],
  templateUrl: './episode-header.component.html',
  standalone: true,
  styleUrl: './episode-header.component.css'
})
export class EpisodeHeaderComponent implements OnInit, OnChanges {
  @Input() episode!: Episode | null;
  customFields: any[] = [];

  ngOnInit() {
    this.updateCustomFields();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['episode']) {
      this.updateCustomFields();
    }
  }

  private updateCustomFields() {
    if (this.episode && this.episode.custom_fields) {
      this.customFields = this.processCustomFields(this.episode.custom_fields);
    } else {
      this.customFields = [];
    }
  }

  private processCustomFields(data: CustomFieldsData): any[] {
    if (!data || !data.field_config) return [];

    return data.field_config.map(config => {
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
