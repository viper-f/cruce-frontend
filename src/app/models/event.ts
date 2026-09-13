import { Post } from './Post';
import { UserShort } from './UserShort';
import { DirectMessageRaw } from './DirectChat';

export interface TopicCreatedEvent {
  type: 'topic_created';
  msg_id?: number;
  TopicID: number;
  SubforumID: number;
  Title: string;
  PostID: number;
  UserID: number;
  Username: string;
}

export interface PostCreatedEvent {
  type: 'post_created';
  msg_id?: number;
  total_posts: number;
  data: Post;
}

export interface PostUpdatedEvent {
  type: 'post_updated';
  msg_id?: number;
  data: Post;
}

export interface NotificationDirectMessage {
  chat_id: number;
  sender_username: string;
}

export interface NotificationMention {
  user_id: number;
  user_name: string;
  character_id: number | null;
  character_name: string | null;
  post_id: number;
  topic_id: number;
  topic_name: string;
}

export interface NotificationGame {
  topic_id: number;
  topic_name: string;
  type: string;
  user_character_id: number;
  user_character_name: string;
  character_id: number;
  character_name: string;
}

export interface NotificationAccountUpdate {
  income_type_key: string;
  amount: number;
  total_amount: number;
  post_id: number;
  topic_id: number;
  comment?: string;
}


export interface NotificationReaction {
  post_id: number;
  topic_id: number;
  topic_name: string;
  reaction_id: number;
  url: string;
  user_id: number;
  user_name: string;
}

export interface NotificationAutoArchiving {
  character_id: number;
  character_name: string;
  days_left?: number;
}

export interface NotificationEpisodeStatusChange {
  episode_id: number;
  episode_name: string;
  new_status: number;
  initiator_id: number;
  initiator_name: string;
}

export interface NotificationData {
  id: number;
  user_id: number;
  type: 'system' | 'game' | 'mention' | 'direct_message' | 'account_update' | 'reaction' | 'auto_archiving' | 'episode_status_change';
  title: string;
  message: string;
  date_created: string;
  is_read: boolean;
  mention: NotificationMention | null;
  game: NotificationGame | null;
  direct_message: NotificationDirectMessage | null;
  data: NotificationMention | NotificationGame | NotificationDirectMessage | NotificationAccountUpdate | NotificationReaction | NotificationAutoArchiving | NotificationEpisodeStatusChange | null;
}

export interface NotificationEvent {
  type: 'notification';
  msg_id?: number;
  data: NotificationData;
}

export interface UnreadNotificationsResponse {
  system: NotificationData[];
  game: NotificationData[];
  mention: NotificationData[];
  direct_message: NotificationData[];
  reaction: NotificationData[];
  auto_archiving: NotificationData[];
  account_update: NotificationData[];
  episode_status_change: NotificationData[];
}

export interface TopicViewersUpdateEvent {
  type: 'topic_viewers_update';
  msg_id?: number;
  data: UserShort[];
}

export interface DirectMessageCreatedEvent {
  type: 'direct_message_created';
  msg_id?: number;
  data: DirectMessageRaw;
}

export interface ActiveUserInfo {
  user_id: number;
  username: string;
  is_guest?: boolean;
  current_page_type: string;
  current_page_id: string | null;
  current_page_name: string | null;
  last_active: string;
}

export interface ActiveUsersUpdateEvent {
  type: 'active_users_update';
  msg_id?: number;
  data: UserShort[];
}

export interface ActiveUsersActivityUpdateEvent {
  type: 'active_users_activity_update';
  msg_id?: number;
  data: ActiveUserInfo[];
}

export interface PanelReloadEvent {
  type: 'panel_reload';
  msg_id?: number;
  panel_name: string;
}

export interface ReactionCreatedEvent {
  type: 'reaction_created';
  msg_id?: number;
  data: {
    topic_id: number;
    post_id: number;
    reaction_id: number;
    url: string;
    user_id: number;
    user_name: string;
  };
}

export interface HealthUpdateEvent {
  type: 'health_update';
  msg_id?: number;
  data: {
    ram: Record<string, { total: number; used: number; available: number }>;
    cpu: Record<string, { pct: number }>;
    http: Record<string, { requests: number; latency_buckets: Record<string, number> }>;
    ws: Record<string, { active: number }>;
  };
}

export interface UserRefreshRequiredEvent {
  type: 'user_refresh_required';
  msg_id?: number;
}

export interface DraftUpdatedEvent {
  type: 'draft_updated';
  msg_id?: number;
  draft_id: string;
}

export interface AiSource {
  post_id?: number;
  topic_id?: number;
  topic_name?: string;
  topic_type?: number;
}

export interface AiMessageData {
  id: number;
  user_id: number;
  role: string;
  content: string;
  sources?: AiSource[];
  date_created: string;
}

export interface AiMessageEvent {
  type: 'ai_message';
  msg_id?: number;
  data: AiMessageData;
}

export interface AiTaskDoneEvent {
  type: 'ai_task_done';
  msg_id?: number;
  data: AiMessageData;
}

export interface AiQueuePositionEvent {
  type: 'ai_queue_position';
  msg_id?: number;
  data: { position: number };
}

export interface AiErrorEvent {
  type: 'ai_error';
  msg_id?: number;
  data: { error: string };
}

export interface PageChangedEvent {
  type: 'page_changed';
  msg_id?: number;
  data: {
    page_type: string;
    id?: string;
  };
}

export interface PongEvent {
  type: 'pong';
  msg_id?: number;
}

export type WebSocketEvent = TopicCreatedEvent | PostCreatedEvent | PostUpdatedEvent | NotificationEvent | TopicViewersUpdateEvent | DirectMessageCreatedEvent | ActiveUsersUpdateEvent | ActiveUsersActivityUpdateEvent | PanelReloadEvent | ReactionCreatedEvent | HealthUpdateEvent | UserRefreshRequiredEvent | DraftUpdatedEvent | AiMessageEvent | AiTaskDoneEvent | AiQueuePositionEvent | AiErrorEvent | PageChangedEvent | PongEvent;
