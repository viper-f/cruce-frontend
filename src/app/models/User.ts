import { Faction } from './Faction';
import { CharacterShort } from './Character';

export interface UserNotificationSetting {
  notification_type: string;
  disable_toast: boolean;
  disable_sound: boolean;
  disable_all: boolean;
}

export interface User {
  id: number;
  username: string;
  avatar: string;
  interface_language: string;
  interface_timezone: string;
  interface_font_size: number;
  disable_sound?: boolean;
  interface_design?: string | null;
  roles: Role[];
  notification_settings?: UserNotificationSetting[];
  currency_amount?: number;
}
export interface Role {
  id: number;
  name: string;
}

export interface UserProfile {
  user_id: number;
  user_name: string;
  avatar: string;
  total_posts: number;
  total_general_posts: number;
  currency_amount?: number;
}

export interface UserProfileResponse {
  user_id: number;
  username: string;
  registration_date: string;
  avatar: string;
  characters: CharacterProfileListItem[];
  total_posts: number;
  total_general_posts: number;
  currency_amount?: number;
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
  interface_font_size?: number;
  disable_sound?: boolean;
  interface_design?: string | null;
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
