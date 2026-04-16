import {UserProfile} from './User';
import {CharacterProfile} from './Character';

export interface ReactionUser {
  id: number;
  name: string;
}

export interface PostReaction {
  reaction_id: number;
  url: string;
  number: number;
  users: ReactionUser[];
}

export interface Post {
  id: number;
  topic_id: number;
  user_profile: UserProfile|null;
  use_character_profile: boolean;
  character_profile: CharacterProfile|null;
  content: string;
  content_html: string;
  date_created: string;
  date_created_localized: string;
  can_edit?: boolean;
  author_user_id: number;
  author_user_name: string;
  reactions?: PostReaction[];
}
