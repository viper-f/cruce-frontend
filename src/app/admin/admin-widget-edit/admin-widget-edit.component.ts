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

interface ConfigFieldDef {
  type: string;
  values?: string[];
  endpoint?: string;
  can_empty?: boolean;
}

interface EndpointOption {
  value: string;
  label: string;
}

interface ConfigField {
  key: string;
  type: string;
  value: any;
  values?: string[];           // static select options
  endpoint?: string;           // endpoint template, e.g. "entity/fields/:entity_type"
  endpointOptions: EndpointOption[]; // dynamically loaded select options
  dependsOn: string[];         // keys of fields referenced in endpoint
  canEmpty: boolean;
  isSpecial: boolean;          // key starts with _, handled separately in template
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

  onTypeChange(typeId: number) {
    this.selectedTypeId = typeId;
    this.loadConfigTemplate({});
  }

  private loadConfigTemplate(savedValues: Record<string, any>) {
    const type = this.widgetTypes().find(t => t.id === Number(this.selectedTypeId));
    if (!type) {
      this.configFields.set([]);
      return;
    }

    this.apiService.get<Record<string, ConfigFieldDef>>(`widget-type/${type.name}/config-template`).subscribe({
      next: template => {
        if (!template || typeof template !== 'object' || Array.isArray(template)) {
          this.configFields.set([]);
          return;
        }
        const fields: ConfigField[] = Object.entries(template).map(([key, def]) => {
          const dependsOn = def.endpoint
            ? (def.endpoint.match(/:(\w+)/g) ?? []).map(p => p.slice(1))
            : [];
          const canEmpty = !!def.can_empty;
          const isSpecial = key.startsWith('_');
          const specialDefault = key === '_refresh_interval' ? 0 : false;
          const defaultValue = isSpecial
            ? (savedValues[key] ?? specialDefault)
            : (savedValues[key] ?? (def.type === 'int' ? 0 : (canEmpty ? '' : (def.values?.[0] ?? ''))));
          return {
            key,
            type: def.type,
            value: defaultValue,
            values: def.values,
            endpoint: def.endpoint,
            endpointOptions: [],
            dependsOn,
            canEmpty,
            isSpecial
          };
        });

        console.log('[widget-edit] setting configFields', fields);
        this.configFields.set(fields);

        // Load endpoint options for fields that have endpoints
        for (const field of fields) {
          if (field.endpoint) {
            this.loadEndpointOptions(field);
          }
        }
      },
      error: (err) => { console.error('[widget-edit] config template error', err); }
    });
  }

  private loadEndpointOptions(field: ConfigField) {
    if (!field.endpoint) return;

    const fields = this.configFields();
    let endpoint = field.endpoint;

    // Replace :param placeholders with current field values
    for (const dep of field.dependsOn) {
      const depField = fields.find(f => f.key === dep);
      if (!depField?.value) return; // wait until dependency has a value
      endpoint = endpoint.replace(`:${dep}`, encodeURIComponent(depField.value));
    }

    this.apiService.get<any[]>(endpoint).subscribe({
      next: raw => {
        const options: EndpointOption[] = raw.map(item =>
          typeof item === 'string'
            ? { value: item, label: item }
            : { value: item.machine_field_name, label: item.human_field_name }
        );
        this.configFields.update(fs =>
          fs.map(f => f.key === field.key ? { ...f, endpointOptions: options } : f)
        );
      },
      error: () => {}
    });
  }

  onFieldChange(changedField: ConfigField) {
    // Reload endpoint options for any field that depends on the changed field
    const fields = this.configFields();
    for (const field of fields) {
      if (field.dependsOn.includes(changedField.key)) {
        this.loadEndpointOptions(field);
      }
    }
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

  save() {
    this.saveState.set('loading');

    const config: Record<string, any> = {};
    for (const field of this.configFields()) {
      if (!field.isSpecial && (field.value === '' || field.value === null || field.value === undefined)) continue;
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
