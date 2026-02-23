import { Post } from './Post';
import { UserShort } from './UserShort';

export interface TopicCreatedEvent {
  type: 'topic_created';
  TopicID: number;
  SubforumID: number;
  Title: string;
  PostID: number;
  UserID: number;
  Username: string;
}

export interface PostCreatedEvent {
  type: 'post_created';
  data: Post;
}

export interface NotificationMention {
  user_id: number;
  user_name: string;
  character_id: number | null;
  character_name: string | null;
  post_id: number;
  topic_id: number;
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

export interface NotificationEvent {
  type: 'notification'; // WebSocket event type
  id: number;
  user_id: number;
  notification_type: 'system' | 'game' | 'mention'; // Backend 'Type' field
  title: string;
  message: string;
  date_created: string;
  is_read: boolean;
  mention: NotificationMention | null;
  game: NotificationGame | null;
}

export interface TopicViewersUpdateEvent {
  type: 'topic_viewers_update';
  data: UserShort[];
}

export type WebSocketEvent = TopicCreatedEvent | PostCreatedEvent | NotificationEvent | TopicViewersUpdateEvent;
