export type Conversation = {
  id: string;
  is_group_chat: boolean;
  name: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  participants: ConversationParticipant[];
  last_message_id: string | null;
};

export type ConversationParticipant = {
  id: string;
  profile_id: string;
  conversation_id: string;
  joined_at: string;
  last_read_at: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  listing_id: string | null;
  post_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}; 