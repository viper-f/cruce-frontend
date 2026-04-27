import {Episode} from './Episode';
import {Character} from './Character';
import {WantedCharacter} from './WantedCharacter';
import {SubforumPermissions} from './Subforum';

export interface Topic {
  id: number;
  name: string;
  subforum_id: number;
  subforum_name?: string;
  date_created: string;
  date_last_post: string;
  date_last_post_localized: string | null;
  author_user_id: number;
  author_username: string;
  post_number: number;
  last_post_author_user_id: number|null;
  last_post_author_username: string|null;
  last_post_id?: number | null;
  last_viewed_id?: number | null;
  type: TopicType;
  status: TopicStatus;
  episode: Episode|null;
  character: Character|null;
  wanted_character: WantedCharacter|null;
  is_sticky?: boolean;
  is_sticky_first_post?: boolean;
  can_edit?: boolean;
  not_viewed?: boolean;
  permissions?: SubforumPermissions | null;
}

export enum TopicType {
  general = 0,
  episode = 1,
  character = 2,
  wanted_character = 3
}

export enum TopicStatus {
  active = 0,
  inactive = 1,
  full = 2
}

export interface CreateTopicRequest {
  subforum_id: number;
  title: string;
  content: string;
  use_character_profile: boolean;
  character_profile_id: number | null;
  is_sticky_first_post?: boolean;
}
