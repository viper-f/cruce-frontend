export interface PostTop {
  id: number;
  name: string;
  user_count: number;
  days: number | null;
  is_monthly: boolean;
  is_open: boolean;
  start_date: string | null;
}

export interface PostTopCreateRequest {
  name: string;
  user_count: number;
  days: number | null;
  is_monthly: boolean;
  is_open: boolean;
  start_date: string | null;
}

export interface PostTopEntry {
  user_id: number;
  username: string;
  avatar: string | null;
  post_count: number;
  character_count: number;
}

export interface PostTopResult {
  name: string;
  days: number | null;
  is_monthly: boolean;
  items: PostTopEntry[];
  start_date: string;
  end_date: string;
}

export interface PostTopUpdateRequest {
  name?: string;
  user_count?: number;
  days?: number | null;
  is_monthly?: boolean;
  is_open?: boolean;
  start_date?: string | null;
}
