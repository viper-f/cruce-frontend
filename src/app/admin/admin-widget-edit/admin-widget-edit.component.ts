import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

type SaveState = 'idle' | 'loading' | 'success' | 'error';

interface WidgetType {
  id: number;
  name: string;
}

interface WidgetDetail {
  id: number;
  name: string;
  template_id: number;
  config: string | null;
}

interface ConfigField {
  key: string;
  type: string; // 'int' | 'string' | 'text'
  value: any;
}

@Component({
  selector: 'app-admin-widget-edit',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-widget-edit.component.html',
  standalone: true,
  styleUrl: './admin-widget-edit.component.css'
})
export class AdminWidgetEditComponent implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  widgetTypes = signal<WidgetType[]>([]);
  widgetId: number | null = null;
  name = '';
  selectedTypeId: number | null = null;
  configFields = signal<ConfigField[]>([]);
  saveState = signal<SaveState>('idle');
  deleteState = signal<SaveState>('idle');

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.widgetId = idParam && idParam !== 'new' ? +idParam : null;

    this.apiService.get<WidgetType[]>('widget-type/list').subscribe({
      next: types => {
        this.widgetTypes.set(types);
        if (this.widgetId) {
          this.loadWidget();
        }
      },
      error: () => {}
    });
  }

  private loadWidget() {
    this.apiService.get<WidgetDetail>(`widget/${this.widgetId}`).subscribe({
      next: widget => {
        this.name = widget.name;
        this.selectedTypeId = widget.template_id;
        const savedConfig = widget.config ? JSON.parse(widget.config) : {};
        this.loadConfigTemplate(savedConfig);
      },
      error: () => {}
    });
  }

  onTypeChange() {
    this.loadConfigTemplate({});
  }

  delete() {
    this.deleteState.set('loading');
    this.apiService.get(`widget/${this.widgetId}/delete`).subscribe({
      next: () => this.router.navigate(['/admin/widgets']),
      error: () => {
        this.deleteState.set('error');
        setTimeout(() => this.deleteState.set('idle'), 3000);
      }
    });
  }

  private loadConfigTemplate(savedValues: Record<string, any>) {
    const type = this.widgetTypes().find(t => t.id === Number(this.selectedTypeId));
    if (!type) {
      this.configFields.set([]);
      return;
    }

    this.apiService.get<Record<string, string>>(`widget-type/${type.name}/config-template`).subscribe({
      next: template => {
        const fields: ConfigField[] = Object.entries(template).map(([key, fieldType]) => ({
          key,
          type: fieldType,
          value: savedValues[key] ?? (fieldType === 'int' ? 0 : '')
        }));
        this.configFields.set(fields);
      },
      error: () => {}
    });
  }

  save() {
    this.saveState.set('loading');

    const config: Record<string, any> = {};
    for (const field of this.configFields()) {
      config[field.key] = field.type === 'int' ? Number(field.value) : field.value;
    }

    const body: Record<string, any> = {
      name: this.name,
      config: JSON.stringify(config)
    };

    if (!this.widgetId) {
      body['template_id'] = Number(this.selectedTypeId);
    }

    const endpoint = this.widgetId ? `widget/${this.widgetId}/update` : 'widget/create';
    this.apiService.post(endpoint, body).subscribe({
      next: () => {
        this.saveState.set('success');
        setTimeout(() => this.saveState.set('idle'), 3000);
      },
      error: () => {
        this.saveState.set('error');
        setTimeout(() => this.saveState.set('idle'), 3000);
      }
    });
  }
}
