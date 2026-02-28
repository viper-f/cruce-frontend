import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EpisodeService } from '../../services/episode.service';
import { FieldTemplate } from '../../models/FieldTemplate';

interface FieldTemplateForm extends FieldTemplate {
  id?: number;
}

@Component({
  selector: 'app-episode-template-edit',
  imports: [CommonModule, FormsModule],
  templateUrl: './episode-template-edit.component.html',
  standalone: true,
  styleUrl: './episode-template-edit.component.css'
})
export class EpisodeTemplateEditComponent implements OnInit {
  episodeService = inject(EpisodeService);
  fields: FieldTemplateForm[] = [];

  fieldTypes = ['string', 'text', 'int', 'decimal', 'date'];
  contentFieldTypes = ['short_text', 'number', 'decimal', 'long_text', 'image'];

  private templateLoaded = false;

  constructor() {
    // Watch for template changes
    effect(() => {
      const template = this.episodeService.episodeTemplate();
      if (template.length > 0 && !this.templateLoaded) {
        this.templateLoaded = true;
        this.fields = template.map((field, index) => ({ ...field, id: index }));
        // Add one empty fieldset
        this.addEmptyField();
      }
    });
  }

  ngOnInit() {
    this.episodeService.loadEpisodeTemplate();

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
    console.log('Saving template:', this.fields);
    let data = this.fields.filter(field => field.machine_field_name !== '');
    this.episodeService.saveEpisodeTemplate(data);
  }
}
