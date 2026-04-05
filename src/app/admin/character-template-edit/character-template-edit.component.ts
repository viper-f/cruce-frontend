import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CharacterService } from '../../services/character.service';
import { FieldTemplateRowComponent, FieldTemplateForm } from '../field-template-row/field-template-row.component';

@Component({
  selector: 'app-character-template-edit',
  imports: [FieldTemplateRowComponent],
  templateUrl: './character-template-edit.component.html',
  standalone: true,
  styleUrl: './character-template-edit.component.css'
})
export class CharacterTemplateEditComponent implements OnInit {
  characterService = inject(CharacterService);
  fields: FieldTemplateForm[] = [];
  saveState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');

  private templateLoaded = false;

  constructor() {
    // Watch for template changes
    effect(() => {
      const template = this.characterService.characterTemplate();
      if (template.length > 0 && !this.templateLoaded) {
        this.templateLoaded = true;
        this.fields = template.map((field, index) => ({ ...field, id: index }));
        // Add one empty fieldset
        this.addEmptyField();
      }
    });
  }

  ngOnInit() {
    this.characterService.loadCharacterTemplate();

    // Add empty field if template is still empty after init
    setTimeout(() => {
      if (this.fields.length === 0) {
        this.addEmptyField();
      }
    }, 200);
  }

  addEmptyField() {
    this.fields.push({
      id: this.fields.length,
      machine_field_name: '',
      human_field_name: '',
      field_type: 'text',
      content_field_type: 'string',
      order: this.fields.length
    });
  }

  removeField(index: number) {
    this.fields.splice(index, 1);
  }

  saveTemplate() {
    this.saveState.set('loading');
    const data = this.fields.filter(field => field.machine_field_name !== '');
    this.characterService.saveCharacterTemplate(data).subscribe({
      next: () => { this.saveState.set('success'); setTimeout(() => this.saveState.set('idle'), 3000); },
      error: () => { this.saveState.set('error'); setTimeout(() => this.saveState.set('idle'), 3000); }
    });
  }
}
