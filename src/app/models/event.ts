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
}

export interface NotificationData {
  id: number;
  user_id: number;
  type: 'system' | 'game' | 'mention' | 'direct_message' | 'account_update';
  title: string;
  message: string;
  date_created: string;
  is_read: boolean;
  mention: NotificationMention | null;
  game: NotificationGame | null;
  direct_message: NotificationDirectMessage | null;
  account_update: NotificationAccountUpdate | null;
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

export interface ActiveUsersUpdateEvent {
  type: 'active_users_update';
  msg_id?: number;
  data: UserShort[];
}

export interface PanelReloadEvent {
  type: 'panel_reload';
  msg_id?: number;
  panel_name: string;
}

export type WebSocketEvent = TopicCreatedEvent | PostCreatedEvent | PostUpdatedEvent | NotificationEvent | TopicViewersUpdateEvent | DirectMessageCreatedEvent | ActiveUsersUpdateEvent | PanelReloadEvent;
