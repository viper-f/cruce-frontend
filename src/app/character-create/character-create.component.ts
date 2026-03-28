import { Component, inject, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CharacterService } from '../services/character.service';
import { FactionService } from '../services/faction.service';
import { ShortTextFieldComponent } from '../components/short-text-field/short-text-field.component';
import { LongTextFieldComponent } from '../components/long-text-field/long-text-field.component';
import { ImageFieldComponent } from '../components/image-field/image-field.component';
import { FactionChooseComponent } from '../components/faction-choose/faction-choose.component';
import { CreateCharacterRequest, Character } from '../models/Character';
import { Topic, TopicType, TopicStatus } from '../models/Topic';
import { Faction } from '../models/Faction';
import { CommonModule } from '@angular/common';
import { PreviewService } from '../services/preview.service';

@Component({
  selector: 'app-character-create',
  imports: [ShortTextFieldComponent, LongTextFieldComponent, ImageFieldComponent, FactionChooseComponent, CommonModule],
  templateUrl: './character-create.component.html',
  standalone: true,
  styleUrl: './character-create.component.css'
})
export class CharacterCreateComponent implements OnInit {
  characterService = inject(CharacterService);
  factionService = inject(FactionService);
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
    }
  }

  populateForm(data: Character) {
    this.characterName = data.name;
    this.characterAvatar = data.avatar || '';
    if (data.factions && data.factions.length > 0) {
      const roots = data.factions.filter(f => !f.parent_id || f.parent_id === 0);

      if (roots.length > 0) {
        this.factionPaths = roots.map(root => {
           return data.factions!.filter(f => f.id === root.id || this.isDescendant(f, root, data.factions!));
        });
      } else {
         this.factionPaths = [data.factions];
      }
    }
  }

  isDescendant(child: Faction, root: Faction, all: Faction[]): boolean {
      return true;
  }

  onFactionsChanged(index: number, factions: Faction[]) {
    this.factionPaths[index] = factions;
  }

  addFactionPath() {
    this.factionPaths.push([]);
  }

  removeFactionPath(index: number) {
    if (this.factionPaths.length > 1) {
      this.factionPaths.splice(index, 1);
    }
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
