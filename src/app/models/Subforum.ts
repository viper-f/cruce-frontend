export interface Subforum {
  id: number;
  name: string;
  description: string;
  description_html?: string;
  category_id: number;
  position: number;
  topic_number: number;
  post_number: number;
  last_post_topic_id: number | null;
  last_post_topic_name: string | null;
  last_post_id: number | null;
  date_last_post: string | null;
  date_last_post_localized: string | null;
  last_post_author_name: string | null;
  permissions: SubforumPermissions|null;

  show_last_topic?: boolean;

  // Optional fields that might be present or used internally
  can_read_roles?: string[];
  can_wrote_roles?: string[];
  is_game_subforum?: boolean;
}

export interface SubforumShort {
  id: number;
  name: string;
}

export interface SubforumPermissions {
  subforum_create_general_topic: boolean;
  subforum_create_episode_topic: boolean;
  subforum_create_character_topic: boolean;
  subforum_create_wanted_character_topic?: boolean;
  subforum_create_lore_topic?: boolean;
  subforum_post: boolean;
  subforum_delete_topic: boolean;
  subforum_delete_others_topic: boolean;
  subforum_edit_others_post: boolean;
  subforum_edit_own_post: boolean;
}
