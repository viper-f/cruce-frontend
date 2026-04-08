import { Component, inject, OnInit, effect, Input, booleanAttribute, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CharacterService } from '../services/character.service';
import { MaskService } from '../services/mask.service';
import { AuthService } from '../services/auth.service';
import { FieldInputComponent } from '../components/field-input/field-input.component';
import { ImageFieldComponent } from '../components/image-field/image-field.component';
import { FormsModule } from '@angular/forms';
import { CharacterProfile } from '../models/Character';

@Component({
  selector: 'app-character-profile-edit',
  imports: [FieldInputComponent, ImageFieldComponent, FormsModule],
  templateUrl: './character-profile-edit.component.html',
  standalone: true
})
export class CharacterProfileEditComponent implements OnInit {
  private characterService = inject(CharacterService);
  private maskService = inject(MaskService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @Input({ transform: booleanAttribute }) is_mask: boolean = false;

  template = this.characterService.characterProfileTemplate;

  // Local signal to hold the data, whether it comes from character profile or mask
  currentProfileData = signal<CharacterProfile | null>(null);

  characterId: number = 0;
  characterName: string = '';
  characterAvatar: string = '';
  isNewMask: boolean = false;
  saveState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');

  constructor() {
    // Sync from character service if we are dealing with a character profile
    effect(() => {
      if (!this.is_mask && !this.isNewMask) {
        this.currentProfileData.set(this.characterService.characterProfile());
      }
    });

    // Update form fields when profile data changes
    effect(() => {
      if (!this.isNewMask) {
        const p = this.currentProfileData();
        if (p) {
          // If it's a mask, it might have mask_name. If it's a character, character_name.
          this.characterName = p.character_name || (p as any).mask_name || '';
          this.characterAvatar = p.avatar;
        }
      }
    });
  }

  ngOnInit() {
    this.characterService.loadCharacterProfileTemplate();
    this.route.params.subscribe(params => {
      if (params['id']) {
        if (params['id'] === 'new' || params['id'] === '0') {
          this.isNewMask = true;
          this.characterId = 0;
          this.characterName = '';
          this.characterAvatar = '';
          this.currentProfileData.set(null);
        } else {
          this.isNewMask = false;
          this.characterId = +params['id'];

          if (this.is_mask) {
            this.maskService.getMask(this.characterId).subscribe({
              next: (data) => this.currentProfileData.set(data),
              error: (err: any) => console.error('Failed to load mask', err)
            });
          } else {
            this.characterService.loadCharacterProfile(this.characterId);
          }
        }
      }
    });
  }

  onSubmit(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const customFields: { [key: string]: any } = {};
    this.template().forEach(field => {
      let value: any = formData.get(field.machine_field_name);
      if (value !== null) {
        if (field.content_field_type === 'number') {
          value = parseInt(value, 10);
        }
        customFields[field.machine_field_name] = {
          'content': value
        };
      }
    });

    const avatar = formData.get('avatar') as string;

    if (this.is_mask) {
      // Logic for Masks
      const payload: any = {
        mask_name: this.characterName,
        avatar,
        custom_fields: customFields
      };

      this.saveState.set('loading');
      if (this.isNewMask) {
        this.maskService.createMask(payload).subscribe({
          next: () => {
            const currentUser = this.authService.currentUser();
            if (currentUser) {
              this.router.navigate(['/profile', currentUser.id]);
            } else {
               this.router.navigate(['/']);
            }
          },
          error: (err: any) => { console.error('Failed to create mask', err); this.saveState.set('error'); setTimeout(() => this.saveState.set('idle'), 3000); }
        });
      } else {
        this.maskService.updateMask(this.characterId, payload).subscribe({
          next: () => { this.saveState.set('success'); setTimeout(() => this.saveState.set('idle'), 3000); },
          error: (err: any) => { console.error('Failed to update mask', err); this.saveState.set('error'); setTimeout(() => this.saveState.set('idle'), 3000); }
        });
      }
    } else {
      // Logic for Character Profiles (only update)
      const updatePayload = {
        avatar,
        custom_fields: customFields
      };

      this.saveState.set('loading');
      this.characterService.updateCharacterProfile(this.characterId, updatePayload).subscribe({
        next: () => { this.saveState.set('success'); setTimeout(() => this.saveState.set('idle'), 3000); },
        error: (err: any) => { console.error('Failed to update character profile', err); this.saveState.set('error'); setTimeout(() => this.saveState.set('idle'), 3000); }
      });
    }
  }

  getFieldValue(machineName: string): any {
    if (this.isNewMask) return null;
    const p = this.currentProfileData();
    if (!p || !p.custom_fields || !p.custom_fields.custom_fields) return null;
    const field = p.custom_fields.custom_fields[machineName];
    return field ? field.content : null;
  }
}
