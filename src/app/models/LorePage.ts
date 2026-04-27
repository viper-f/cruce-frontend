export interface LorePage {
  post_id: number;
  name: string;
  is_hidden: boolean;
  order: number;
}

export interface LorePageInfo {
  post_id: number;
  name: string;
  is_hidden: boolean;
  order: number;
}

export interface LoreTopicPostRow {
  id: number;
  date_created: string;
  lore_page: LorePageInfo | null;
}
