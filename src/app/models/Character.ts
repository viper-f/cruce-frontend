import {UserShort} from './UserShort';
import {Field} from './Field';
import {FieldTemplate} from './FieldTemplate';
import {Faction} from './Faction';

export interface Character {
  id: number;
  user_id: number;
  name: string;
  avatar: string | null;
  custom_fields: CustomFieldsData;
  character_status: number;
  topic_id: number;
  total_episodes: number;
  factions: Faction[] | null;
  episodes: CharacterEpisode[];
}

export interface CharacterEpisode {
  id: number;
  name: string;
  topic_id: number;
  characters: CharacterShort[];
  date_last_post: string | null;
  last_post_author_username: string | null;
}

export interface CharacterShort {
  id: number;
  name: string;
  avatar: string;
}

export interface CustomFieldValue {
  content: any;
  content_html: string;
}

export interface CustomFieldsData {
  custom_fields: { [key: string]: CustomFieldValue };
  field_config: FieldTemplate[];
}

export interface CharacterProfile {
  id: number;
  character_id: number | null;
  character_name: string;
  avatar: string;
  custom_fields: CustomFieldsData;
  is_mask: boolean | null;
  mask_name: string | null;
}

export interface CreateCharacterRequest {
  subforum_id: number;
  name: string;
  avatar: string | null;
  custom_fields: { [key: string]: any };
  factions: Faction[];
}

export interface ShortMask {
  id: number;
  mask_name: string;
  user_id: number;
  user_name: string;
}
