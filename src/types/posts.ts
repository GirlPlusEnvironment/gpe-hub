export type PollOption = {
  id: string;
  post_id: string;
  option_text: string;
  created_at: string;
  votes_count?: number; // Computed
};

export type Post = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string | null;
  type: 'text' | 'poll';
  created_at: string;
  updated_at: string;
  likes_count?: number; // Computed or joined
  comments_count?: number; // Computed or joined
  user?: { // Joined profile
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  has_liked?: boolean; // For current user
  poll_options?: PollOption[];
  user_vote_option_id?: string | null; // The option ID the current user voted for
};

export type PostComment = {
  id: string;
  user_id: string;
  post_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  replies?: PostComment[]; // For nested display
};
