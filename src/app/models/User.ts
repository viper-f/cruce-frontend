import { Faction } from './Faction';
import { CharacterShort } from './Character';

export interface User {
  id: number;
  username: string;
  avatar: string;
  interface_language: string;
  interface_timezone: string;
  roles: Role[];
}
export interface Role {
  id: number;
  name: string;
}

export interface UserProfile {
  user_id: number;
  user_name: string;
  avatar: string;
}

export interface UserProfileResponse {
  user_id: number;
  username: string;
  registration_date: string;
  avatar: string;
  characters: CharacterProfileListItem[];
}

export interface CharacterProfileListItem {
  id: number;
  name: string;
  total_episodes: number;
  total_posts: number;
  last_post_date: string | null;
  factions: Faction[];
}

export interface UpdateSettingsRequest {
  avatar?: string;
  interface_timezone?: string;
  interface_language?: string;
  password?: string;
}

export interface UpdateSettingsResponse {
  message: string;
  user: User;
}

export interface UserListItem {
  id: number;
  username: string;
  characters: CharacterShort[];
}
