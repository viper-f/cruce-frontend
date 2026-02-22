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

export interface NotificationEvent {
  type: 'notification';
  user_id: number;
  message_type: string;
  message: string;
  data?: any;
}

export interface TopicViewersUpdateEvent {
  type: 'topic_viewers_update';
  data: UserShort[];
}

export type WebSocketEvent = TopicCreatedEvent | PostCreatedEvent | NotificationEvent | TopicViewersUpdateEvent;
