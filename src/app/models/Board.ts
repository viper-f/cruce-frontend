import {UserShort} from './UserShort';
export interface Board {
  site_name: string;
  domain: string;
  total_user_number: number;
  total_character_number: number;
  total_topic_number: number;
  total_post_number: number;
  total_episode_number: number;
  total_episode_post_number: number;
  last_registered_user: UserShort | null;
  posts_per_page: number;
  visual_navlinks_after_header_panel: string;
}
