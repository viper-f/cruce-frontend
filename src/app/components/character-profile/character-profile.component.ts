import { Component, EventEmitter, inject, Input, OnInit, Output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Post } from '../../models/Post';
import { ShortTextFieldDisplayComponent } from '../short-text-field-display/short-text-field-display.component';
import { LongTextFieldDisplayComponent } from '../long-text-field-display/long-text-field-display.component';
import { CharacterProfile, CustomFieldsData, CustomFieldValue } from '../../models/Character';
import { FormsModule } from '@angular/forms';
import { CharacterService } from '../../services/character.service';
import { AuthService } from '../../services/auth.service';
import { NumberFieldDisplayComponent } from '../number-field-display/number-field-display.component';
import { ImageFieldDisplayComponent } from '../image-field-display/image-field-display.component';
import { CroppedImageFieldDisplayComponent } from '../cropped-image-field-display/cropped-image-field-display.component';

@Component({
  selector: 'app-character-profile',
  imports: [CommonModule, ShortTextFieldDisplayComponent, LongTextFieldDisplayComponent, NumberFieldDisplayComponent, ImageFieldDisplayComponent, CroppedImageFieldDisplayComponent, FormsModule],
  templateUrl: './character-profile.component.html',
  standalone: true,
})
export class CharacterProfileComponent implements OnInit {
  private characterService = inject(CharacterService);
  public authService = inject(AuthService);

  @Input() post?: Post;
  @Input() accountName: string = '';
  @Input() loadProfiles: boolean = true;
  @Input() showAccount: boolean = true;
  @Output() characterSelected = new EventEmitter<number | null>();
  @Output() guestNameChanged = new EventEmitter<string>();
  @Output() authorClicked = new EventEmitter<string>();

  characters = this.characterService.userCharacterProfiles;
  selectedCharacterId: number | 'account' | null = 'account';

  displayName: string = '';
  displayAvatar: string = '';
  isCharacter: boolean = false;
  customFields: any[] = [];

  guestName: string = 'Guest';

  constructor() {
    effect(() => {
      const chars = this.characters();
      if (!this.post && !this.showAccount && chars.length > 0 && this.selectedCharacterId === 'account') {
        // If account is hidden and we have characters, select the first one
        this.selectedCharacterId = chars[0].id;
        this.onSelect();
      }
    });
  }

  ngOnInit() {
    if (this.post) {
      this.initFromPost();
    } else {
      if (this.loadProfiles && this.authService.isAuthenticated()) {
        this.characterService.loadUserCharacterProfiles();
      }
      this.initForForm();
    }
  }

  private initFromPost() {
    if (this.post!.use_character_profile && this.post!.character_profile !== null) {
      this.isCharacter = true;
      this.displayName = this.post!.character_profile.is_mask && this.post!.character_profile.mask_name
        ? '🎭 ' + this.post!.character_profile.mask_name
        : this.post!.character_profile.character_name;
      this.displayAvatar = this.post!.character_profile.avatar;
      this.customFields = this.processCustomFields(this.post!.character_profile.custom_fields);
    } else {
      this.isCharacter = false;
      this.displayName = this.post!.user_profile?.user_name ?? '';
      this.displayAvatar = this.post!.user_profile?.avatar ?? '';
    }
  }

  private initForForm() {
    if (this.showAccount || !this.authService.isAuthenticated()) {
      this.isCharacter = false;
      this.displayName = this.authService.isAuthenticated() ? this.accountName : this.guestName;
      this.displayAvatar = this.authService.currentUser()?.avatar ?? '';
      this.selectedCharacterId = 'account';
    } else {
      // If account is hidden, we wait for characters to load (handled by effect)
      // or if already loaded, select first
      const chars = this.characters();
      if (chars.length > 0) {
        this.selectedCharacterId = chars[0].id;
        this.onSelect();
      }
    }
  }

  onSelect() {
    if (this.selectedCharacterId === 'account') {
      this.isCharacter = false;
      this.displayName = this.authService.isAuthenticated() ? this.accountName : this.guestName;
      this.displayAvatar = this.authService.currentUser()?.avatar ?? '';
      this.customFields = [];
      this.characterSelected.emit(null);
    } else {
      const searchId = Number(this.selectedCharacterId);
      const char = this.characters().find(c => c.id === searchId);
      if (char) {
        this.isCharacter = true;
        this.displayName = char.is_mask && char.mask_name ? char.mask_name : char.character_name;
        this.displayAvatar = char.avatar;
        this.customFields = this.processCustomFields(char.custom_fields);
        this.characterSelected.emit(char.id);
      }
    }
  }

  onGuestNameChange() {
    this.displayName = this.guestName;
    this.guestNameChanged.emit(this.guestName);
  }

  private processCustomFields(data: CustomFieldsData): any[] {
    if (!data || !data.field_config) return [];

    return data.field_config.map(config => {
      const customField: CustomFieldValue | undefined = data.custom_fields ? data.custom_fields[config.machine_field_name] : undefined;
      let fieldValue: any = '';

      if (customField) {
        fieldValue = config.content_field_type === 'long_text' ? customField.content_html : customField.content;
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
}
