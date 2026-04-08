import { Component, inject, OnInit, Input, Output, EventEmitter, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CharacterService } from '../services/character.service';
import { TopicService } from '../services/topic.service';
import { FieldInputComponent } from '../components/field-input/field-input.component';
import { FactionPathsComponent } from '../components/faction-paths/faction-paths.component';
import { CreateCharacterRequest, Character } from '../models/Character';
import { Topic, TopicType, TopicStatus } from '../models/Topic';
import { Faction } from '../models/Faction';
import { CommonModule } from '@angular/common';
import { PreviewService } from '../services/preview.service';

@Component({
  selector: 'app-character-create',
  imports: [FieldInputComponent, FactionPathsComponent, CommonModule],
  templateUrl: './character-create.component.html',
  standalone: true,
})
export class CharacterCreateComponent implements OnInit {
  characterService = inject(CharacterService);
  topicService = inject(TopicService);
  previewService = inject(PreviewService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  characterTemplate = this.characterService.characterTemplate;

  @Input() initialData: Character | null = null;
  @Output() formSubmit = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  subforumId: number = 0;
  factionPaths: Faction[][] = [[]]; // Start with one empty path

  characterName: string = '';
  characterAvatar: string = '';

  statusActive = signal(false);
  isPending = false;
  showConfirmModal = signal(false);

  ngOnInit() {
    const previewState = this.previewService.state();
    if (previewState?.formType === 'character') {
      const p = previewState.formPayload;
      this.initialData = {
        name: p.name,
        avatar: p.avatar,
        factions: p.factions,
        custom_fields: { custom_fields: p.custom_fields }
      } as any;
      this.previewService.clear();
    }

    this.characterService.loadCharacterTemplate();
    this.route.queryParams.subscribe(params => {
      if (params['fid']) {
        this.subforumId = +params['fid'];
      }
    });

    if (this.initialData) {
      this.populateForm(this.initialData);
      this.statusActive.set(this.initialData.character_status === 0);
      this.isPending = this.initialData.character_status === 2;
    }
  }

  activate() {
    if (this.isPending || !this.initialData) return;
    this.characterService.activateCharacter(this.initialData.id).subscribe({
      next: (res) => {
        this.statusActive.set(res.character_status === 0);
        this.topicService.updateTopicStatus(res.topic_status);
        this.topicService.updateCharacterStatus(res.character_status);
      },
      error: (err) => console.error('Failed to activate character', err)
    });
  }

  requestDeactivate() {
    this.showConfirmModal.set(true);
  }

  confirmDeactivate() {
    if (!this.initialData) return;
    this.characterService.deactivateCharacter(this.initialData.id).subscribe({
      next: (res) => {
        this.statusActive.set(res.character_status === 0);
        this.topicService.updateTopicStatus(res.topic_status);
        this.topicService.updateCharacterStatus(res.character_status);
        this.showConfirmModal.set(false);
      },
      error: (err) => console.error('Failed to deactivate character', err)
    });
  }

  cancelDeactivate() {
    this.showConfirmModal.set(false);
  }

  populateForm(data: Character) {
    this.characterName = data.name;
    this.characterAvatar = data.avatar || '';
  }

  onFactionsChanged(paths: Faction[][]) {
    this.factionPaths = paths;
  }

  getFieldValue(machineName: string): any {
    if (this.initialData && this.initialData.custom_fields && this.initialData.custom_fields.custom_fields) {
      const field = this.initialData.custom_fields.custom_fields[machineName];
      return field ? field.content : null;
    }
    return null;
  }

  onSubmit(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const customFields: { [key: string]: any } = {};
    this.characterTemplate().forEach(field => {
      let value: any = formData.get(field.machine_field_name);
      if (value !== null) {
        if (field.field_type === 'int') {
          const parsed = parseInt(value, 10);
          value = isNaN(parsed) ? null : parsed;
        }
        customFields[field.machine_field_name] = {
          'content': value
        };
      }
    });

    // Flatten all selected factions
    const allSelectedFactions = this.factionPaths.flat();

    // Remove duplicates if any
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

    const request: any = {
      subforum_id: this.subforumId,
      name: formData.get('req_name') as string,
      avatar: formData.get('req_avatar') as string,
      custom_fields: customFields,
      factions: factions
    };

    const isPreview = ((event as SubmitEvent).submitter as HTMLInputElement | null)?.name === 'preview';

    if (isPreview) {
      this.characterService.previewCharacter(request).subscribe({
        next: (character: Character) => {
          this.previewService.set({
            formType: 'character',
            topic: {
              id: 0, name: character.name, subforum_id: 0,
              date_created: '', date_last_post: '', date_last_post_localized: null,
              author_user_id: 0, author_username: '',
              post_number: 0, last_post_author_user_id: null, last_post_author_username: null,
              type: TopicType.character, status: TopicStatus.active,
              episode: null, character
            } as Topic,
            posts: [],
            returnUrl: this.router.url,
            formPayload: request
          });
          this.router.navigate(['/preview']);
        },
        error: (err) => console.error('Preview failed', err)
      });
      return;
    }

    if (this.formSubmit.observed) {
      this.formSubmit.emit(request);
    } else {
      this.characterService.createCharacter(request as CreateCharacterRequest).subscribe({
        next: (response) => {
          console.log('Character created successfully', response);
          this.router.navigate(['/viewforum', this.subforumId]);
        },
        error: (err) => {
          console.error('Failed to create character', err);
        }
      });
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
