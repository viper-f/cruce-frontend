export interface DirectChatParticipant {
  id: number;
  username: string;
  avatar: string | null;
  public_key: string | null;
}

export interface DirectChatResponse {
  chat_id: number;
  participants: DirectChatParticipant[];
  last_read_message_id: number | null;
}

export interface DirectChat {
  id: number;
  userName: string;
  lastMessage: string;
}

export interface DirectChatListItem {
  chat_id: number;
  user_id: number;
  username: string;
  unread_count: number;
}
