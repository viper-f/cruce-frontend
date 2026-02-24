import { Faction } from './Faction';

export interface User {
  id: number;
  username: string;
  avatar: string;
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
