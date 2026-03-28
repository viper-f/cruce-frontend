import { Component, inject, OnInit, Input, Output, EventEmitter, signal } from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EpisodeService } from '../services/episode.service';
import { CharacterService } from '../services/character.service';
import { ShortTextFieldComponent } from '../components/short-text-field/short-text-field.component';
import { LongTextFieldComponent } from '../components/long-text-field/long-text-field.component';
import { ImageFieldComponent } from '../components/image-field/image-field.component';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { CreateEpisodeRequest, Episode } from '../models/Episode';
import { Topic, TopicType, TopicStatus } from '../models/Topic';
import { MaskService } from '../services/mask.service';
import { ShortMask } from '../models/Character';
import { PreviewService } from '../services/preview.service';

@Component({
  selector: 'app-episode-create',
  imports: [CommonModule, ReactiveFormsModule, ShortTextFieldComponent, LongTextFieldComponent, ImageFieldComponent],
  templateUrl: './episode-create.component.html',
  styleUrl: './episode-create.component.css'
})
export class EpisodeCreateComponent implements OnInit {
  episodeService = inject(EpisodeService);
  characterService = inject(CharacterService);
  maskService = inject(MaskService);
  previewService = inject(PreviewService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  episodeTemplate = this.episodeService.episodeTemplate;
  characterSuggestions = this.characterService.shortCharacterList;

  @Input() initialData: Episode | null = null;
  @Output() formSubmit = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  // Character inputs
  characterControls = new FormArray([new FormControl('')]);
  selectedCharacterIds: (number | null)[] = [null];

  // Track which input is currently active for suggestions
  activeInputIndex: number | null = null;

  subforumId: number = 0;
  subject: string = '';

  // Mask inputs
  maskControls = new FormArray([new FormControl('')]);
  selectedMaskIds: (number | null)[] = [null];
  activeMaskInputIndex: number | null = null;
  maskSuggestions = signal<ShortMask[]>([]);

  constructor() {
    this.setupAutocomplete(0);
    this.setupMaskAutocomplete(0);
  }

  ngOnInit() {
    const previewState = this.previewService.state();
    if (previewState?.formType === 'episode') {
      const p = previewState.formPayload;
      this.subject = p.name;

      this.characterControls.clear();
      this.selectedCharacterIds = [];
      const charEntries: {id: number, name: string}[] = p._characterEntries || [];
      if (charEntries.length > 0) {
        charEntries.forEach((entry, i) => {
          this.characterControls.push(new FormControl(entry.name));
          this.selectedCharacterIds.push(entry.id);
          this.setupAutocomplete(i);
        });
      } else {
        this.characterControls.push(new FormControl(''));
        this.selectedCharacterIds.push(null);
        this.setupAutocomplete(0);
      }

      this.maskControls.clear();
      this.selectedMaskIds = [];
      const maskEntries: {id: number, name: string}[] = p._maskEntries || [];
      if (maskEntries.length > 0) {
        maskEntries.forEach((entry, i) => {
          this.maskControls.push(new FormControl(entry.name));
          this.selectedMaskIds.push(entry.id);
          this.setupMaskAutocomplete(i);
        });
      } else {
        this.maskControls.push(new FormControl(''));
        this.selectedMaskIds.push(null);
        this.setupMaskAutocomplete(0);
      }

      if (p.custom_fields) {
        const restored: any = {};
        Object.keys(p.custom_fields).forEach(key => {
          restored[key] = { content: p.custom_fields[key] };
        });
        this.initialData = { custom_fields: { custom_fields: restored } } as any;
      }

      this.previewService.clear();
    }

    this.episodeService.loadEpisodeTemplate();
    this.route.queryParams.subscribe(params => {
      if (params['fid']) {
        this.subforumId = +params['fid'];
      }
    });

    if (this.initialData) {
      this.populateForm(this.initialData);
    }
  }

  populateForm(data: Episode) {
    this.subject = data.name;

    // Clear initial controls
    this.characterControls.clear();
    this.selectedCharacterIds = [];

    this.maskControls.clear();
    this.selectedMaskIds = [];

    if (data.characters && data.characters.length > 0) {
      data.characters.forEach((char, index) => {
        this.characterControls.push(new FormControl(char.name));
        this.selectedCharacterIds.push(char.id);
        this.setupAutocomplete(index);
      });
    } else {
      this.characterControls.push(new FormControl(''));
      this.selectedCharacterIds.push(null);
      this.setupAutocomplete(0);

      // Initialize masks logic (can be expanded if episodes return initial masks)
      this.maskControls.push(new FormControl(''));
      this.selectedMaskIds.push(null);
      this.setupMaskAutocomplete(0);
    }
  }

  setupAutocomplete(index: number) {
    this.characterControls.at(index).valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      if (value && value.length >= 2) {
        this.activeInputIndex = index;
        this.characterService.loadShortCharacterList(value);
      } else {
        this.activeInputIndex = null;
        this.characterService.loadShortCharacterList('');
      }
    });
  }

  selectCharacter(index: number, charName: string, charId: number) {
    this.characterControls.at(index).setValue(charName, { emitEvent: false });
    this.selectedCharacterIds[index] = charId;
    this.activeInputIndex = null;
    this.characterService.loadShortCharacterList('');
  }

  addCharacterField() {
    this.characterControls.push(new FormControl(''));
    this.selectedCharacterIds.push(null);
    this.setupAutocomplete(this.characterControls.length - 1);
  }

  removeCharacterField(index: number) {
    if (this.characterControls.length > 1) {
      this.characterControls.removeAt(index);
      this.selectedCharacterIds.splice(index, 1);

      // If we removed the active input, clear suggestions
      if (this.activeInputIndex === index) {
        this.activeInputIndex = null;
        this.characterService.loadShortCharacterList('');
      } else if (this.activeInputIndex !== null && this.activeInputIndex > index) {
        // Adjust index if we removed an item before the active one
        this.activeInputIndex--;
      }
    }
  }

  setupMaskAutocomplete(index: number) {
    this.maskControls.at(index).valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      if (value && value.length >= 2) {
        this.activeMaskInputIndex = index;
        this.maskService.searchMasks(value).subscribe({
          next: (results) => this.maskSuggestions.set(results),
          error: (err) => {
            console.error('Failed to search masks', err);
            this.maskSuggestions.set([]);
          }
        });
      } else {
        this.activeMaskInputIndex = null;
        this.maskSuggestions.set([]);
      }
    });
  }

  selectMask(index: number, maskName: string | null, maskId: number) {
    this.maskControls.at(index).setValue(maskName || 'Unnamed Mask', { emitEvent: false });
    this.selectedMaskIds[index] = maskId;
    this.activeMaskInputIndex = null;
    this.maskSuggestions.set([]);
  }

  addMaskField() {
    this.maskControls.push(new FormControl(''));
    this.selectedMaskIds.push(null);
    this.setupMaskAutocomplete(this.maskControls.length - 1);
  }

  removeMaskField(index: number) {
    if (this.maskControls.length > 1) {
      this.maskControls.removeAt(index);
      this.selectedMaskIds.splice(index, 1);

      if (this.activeMaskInputIndex === index) {
        this.activeMaskInputIndex = null;
        this.maskSuggestions.set([]);
      } else if (this.activeMaskInputIndex !== null && this.activeMaskInputIndex > index) {
        this.activeMaskInputIndex--;
      }
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

    const customFields: any = {};

    // Iterate over template to get custom fields
    this.episodeTemplate().forEach(field => {
      const value = formData.get(field.machine_field_name);
      if (value !== null) {
        customFields[field.machine_field_name] = value;
      }
    });

    const request: any = {
      subforum_id: this.subforumId,
      name: formData.get('req_subject') as string,
      character_ids: this.selectedCharacterIds.filter((id): id is number => id !== null),
      mask_ids: this.selectedMaskIds.filter((id): id is number => id !== null),
      custom_fields: customFields
    };

    const isPreview = ((event as SubmitEvent).submitter as HTMLInputElement | null)?.name === 'preview';

    if (isPreview) {
      const characterEntries = this.selectedCharacterIds
        .map((id, i) => ({ id, name: this.characterControls.at(i).value || '' }))
        .filter(e => e.id !== null) as {id: number, name: string}[];
      const maskEntries = this.selectedMaskIds
        .map((id, i) => ({ id, name: this.maskControls.at(i).value || '' }))
        .filter(e => e.id !== null) as {id: number, name: string}[];

      this.episodeService.previewEpisode(request).subscribe({
        next: (episode: Episode) => {
          this.previewService.set({
            formType: 'episode',
            topic: {
              id: 0, name: episode.name, subforum_id: 0,
              date_created: '', date_last_post: '', date_last_post_localized: null,
              author_user_id: 0, author_username: '',
              post_number: 0, last_post_author_user_id: null, last_post_author_username: null,
              type: TopicType.episode, status: TopicStatus.active,
              episode, character: null
            } as Topic,
            posts: [],
            returnUrl: this.router.url,
            formPayload: { ...request, _characterEntries: characterEntries, _maskEntries: maskEntries }
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
      this.episodeService.createEpisode(request as CreateEpisodeRequest).subscribe({
        next: (response) => {
          console.log('Episode created successfully', response);
          this.router.navigate(['/viewforum', this.subforumId]);
        },
        error: (err) => {
          console.error('Failed to create episode', err);
        }
      });
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
