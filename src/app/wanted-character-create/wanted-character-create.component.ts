import { Component, inject, OnInit, Input, Output, EventEmitter, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WantedCharacterService } from '../services/wanted-character.service';
import { FieldInputComponent } from '../components/field-input/field-input.component';
import { FactionPathsComponent } from '../components/faction-paths/faction-paths.component';
import { Faction } from '../models/Faction';
import { WantedCharacter } from '../models/WantedCharacter';
import { TopicService } from '../services/topic.service';

@Component({
  selector: 'app-wanted-character-create',
  standalone: true,
  imports: [CommonModule, FieldInputComponent, FactionPathsComponent],
  templateUrl: './wanted-character-create.component.html',
})
export class WantedCharacterCreateComponent implements OnInit {
  private wantedCharacterService = inject(WantedCharacterService);
  private topicService = inject(TopicService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  template = this.wantedCharacterService.template;
  subforumId: number = 0;
  characterName: string = '';
  factionPaths: Faction[][] = [[]];

  @Input() initialData: WantedCharacter | null = null;
  @Output() formSubmit = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  statusActive = signal(false);
  showConfirmModal = signal(false);

  activate() {
    if (!this.initialData) return;
    this.wantedCharacterService.activate(this.initialData.id).subscribe({
      next: (res) => {
        this.statusActive.set(res.wanted_character_status === 0);
        this.topicService.updateTopicStatus(res.topic_status);
        this.topicService.updateWantedCharacterStatus(res.wanted_character_status);
      },
      error: (err) => console.error('Failed to activate wanted character', err)
    });
  }

  requestDeactivate() {
    this.showConfirmModal.set(true);
  }

  confirmDeactivate() {
    if (!this.initialData) return;
    this.wantedCharacterService.deactivate(this.initialData.id).subscribe({
      next: (res) => {
        this.statusActive.set(res.wanted_character_status === 0);
        this.topicService.updateTopicStatus(res.topic_status);
        this.topicService.updateWantedCharacterStatus(res.wanted_character_status);
        this.showConfirmModal.set(false);
      },
      error: (err) => console.error('Failed to deactivate wanted character', err)
    });
  }

  cancelDeactivate() {
    this.showConfirmModal.set(false);
  }

  ngOnInit() {
    this.statusActive.set((this.initialData?.wanted_character_status ?? 1) === 0);
    this.wantedCharacterService.loadTemplate();
    this.route.queryParams.subscribe(params => {
      if (params['fid']) {
        this.subforumId = +params['fid'];
      }
    });

    if (this.initialData) {
      this.characterName = this.initialData.name;
    }
  }

  getFieldValue(machineName: string): any {
    if (this.initialData?.custom_fields?.custom_fields) {
      const field = this.initialData.custom_fields.custom_fields[machineName];
      return field ? field.content : null;
    }
    return null;
  }

  onCancel() {
    this.cancel.emit();
  }

  onFactionsChanged(paths: Faction[][]) {
    this.factionPaths = paths;
  }

  onSubmit(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const customFields: { [key: string]: any } = {};
    this.template().forEach(field => {
      let value: any = formData.get(field.machine_field_name);
      if (value !== null) {
        if (field.field_type === 'int') {
          const parsed = parseInt(value, 10);
          value = isNaN(parsed) ? null : parsed;
        }
        customFields[field.machine_field_name] = { content: value };
      }
    });

    const allSelectedFactions = this.factionPaths.flat();
    const uniqueFactions = Array.from(new Map(allSelectedFactions.map(f => [f.id, f])).values());
    const factions = uniqueFactions.map(f => ({
      id: f.id,
      name: f.name,
      parent_id: f.parent_id,
      level: f.level,
      description: f.description,
      icon: f.icon,
      show_on_profile: true,
      faction_status: 0,
      characters: []
    }));

    const request = {
      subforum_id: this.subforumId,
      name: formData.get('req_name') as string,
      custom_fields: customFields,
      factions
    };

    if (this.formSubmit.observed) {
      this.formSubmit.emit(request);
    } else {
      this.wantedCharacterService.save(request).subscribe({
        next: (response: any) => {
          if (response?.id) {
            this.router.navigate(['/viewtopic', response.id]);
          } else {
            this.router.navigate(['/viewforum', this.subforumId]);
          }
        },
        error: (err) => console.error('Failed to save wanted character', err)
      });
    }
  }
}
