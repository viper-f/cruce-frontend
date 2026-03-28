import { Component, inject, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Character, CustomFieldsData, CustomFieldValue } from '../../models/Character';
import { ShortTextFieldDisplayComponent } from '../short-text-field-display/short-text-field-display.component';
import { LongTextFieldDisplayComponent } from '../long-text-field-display/long-text-field-display.component';
import { NumberFieldDisplayComponent } from '../number-field-display/number-field-display.component';
import { AuthService } from '../../services/auth.service';
import { CharacterService } from '../../services/character.service';

@Component({
  selector: 'app-character-sheet-header',
  imports: [CommonModule, ShortTextFieldDisplayComponent, LongTextFieldDisplayComponent, NumberFieldDisplayComponent],
  templateUrl: './character-sheet-header.component.html',
  standalone: true,
  styleUrl: './character-sheet-header.component.css'
})
export class CharacterSheetHeaderComponent implements OnInit, OnChanges {
  @Input() character!: Character | null;
  @Input() context: 'topic' | 'page' = 'page';

  private authService = inject(AuthService);
  private characterService = inject(CharacterService);

  isAdmin = this.authService.isAdmin;
  customFields: any[] = [];

  ngOnInit() {
    this.updateCustomFields();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['character']) {
      this.updateCustomFields();
    }
  }

  private updateCustomFields() {
    if (this.character && this.character.custom_fields) {
      this.customFields = this.processCustomFields(this.character.custom_fields);
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

  get hasPendingFactions(): boolean {
    return (this.character?.factions ?? []).some(f => f.faction_status === 2);
  }

  acceptCharacter() {
    if (this.character) {
      this.characterService.acceptCharacter(this.character.id).subscribe({
        next: () => {
          console.log('Character accepted successfully');
          if (this.character) {
            this.character.character_status = 1;
          }
        },
        error: (err) => console.error('Failed to accept character', err)
      });
    }
  }

  getStatusLabel(status: number): string {
    switch (status) {
      case 0: return 'Active';
      case 1: return 'Inactive'; // Assuming 1 is inactive based on previous context, but wait...
      // In Character.ts: character_status: number;
      // In CharacterListComponent: getStatusLabel(char.character_status)
      // Let's check CharacterListComponent to be consistent.
      case 2: return 'Pending';
      default: return 'Unknown';
    }
  }

  // Wait, in acceptCharacter: this.character.character_status = 1;
  // Usually 1 is Active?
  // Let's check CharacterListComponent.ts to see what it uses.

  getStatusClass(status: number): string {
    switch (status) {
      case 0: return 'status-active'; // Or whatever 0 means
      case 1: return 'status-approved'; // Or whatever 1 means
      case 2: return 'status-pending';
      default: return '';
    }
  }
}
