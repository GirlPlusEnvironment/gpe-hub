import { createContext } from "react";
import type { Conversation, ConversationParticipant, Message, Profile } from "@/types/messages";

export type MessagesContextType = {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  unreadCount: number;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isLoadingUnread: boolean;
  setCurrentConversationId: (conversationId: string | null) => void;
  setIsMessagesPageActive: (isActive: boolean) => void;
  sendMessage: (conversationId: string, content: string, listingId?: string, postId?: string) => Promise<void>;
  createDirectConversation: (profileId1: string, profileId2: string) => Promise<Conversation>;
  createGroupConversation: (name: string, participantIds: string[]) => Promise<Conversation>;
  updateConversationName: (conversationId: string, name: string) => Promise<Conversation>;
  updateMessage: (messageId: string, content: string) => Promise<void>;
  addParticipantToGroup: (conversationId: string, profileId: string) => Promise<ConversationParticipant>;
  removeParticipantFromGroup: (conversationId: string, profileId: string) => Promise<ConversationParticipant>;
  markAsRead: (conversationId: string) => Promise<void>;
  searchUsers: (query: string, excludeIds?: string[]) => Promise<Profile[]>;
  fetchProfileById: (profileId: string) => Promise<Profile | null>;
  fetchProfilesByIds: (profileIds: string[]) => Promise<Profile[]>;
  loadMoreMessages: (conversationId: string) => Promise<void>;
  hasMoreMessages: boolean;
  isLoadingMoreMessages: boolean;
  refreshConversations: () => Promise<void>;
  refreshMessages: () => Promise<void>;
};

export const MessagesContext = createContext<MessagesContextType | undefined>(undefined);
