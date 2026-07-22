import { useEffect, useState, useRef, ReactNode, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchConversations,
  fetchConversationById,
  fetchMessages,
  sendMessage,
  createDirectConversation,
  createGroupConversation,
  updateConversationName,
  updateMessage,
  addParticipantToGroup,
  removeParticipantFromGroup,
  markAsRead,
  getUnreadCount,
  searchUsers,
  fetchProfileById,
  fetchProfilesByIds,
  decryptMessage,
} from "@/lib/messages";
import type { Conversation, Profile } from "@/types/messages";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { MessagesContext, type MessagesContextType } from "@/contexts/messages-context";

interface MessagesProviderProps {
  children: ReactNode;
}

export const MessagesProvider = ({ children }: MessagesProviderProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [isMessagesPageActive, setIsMessagesPageActive] = useState(false);
  
  // Store subscription channels for cleanup
  const messagesChannelRef = useRef<RealtimeChannel | null>(null);
  const conversationsChannelRef = useRef<RealtimeChannel | null>(null);
  const participantsChannelRef = useRef<RealtimeChannel | null>(null);

  // Fetch conversations
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    refetch: refetchConversations,
  } = useQuery({
    queryKey: ["conversations", profile?.id],
    queryFn: () => fetchConversations(profile!.id),
    enabled: Boolean(profile?.id),
    staleTime: 1000 * 30, // 30 seconds
    // Removed refetchInterval - realtime handles updates
  });

  // Fetch current conversation details
  const { data: currentConversation = null } = useQuery({
    queryKey: ["conversation", currentConversationId, profile?.id],
    queryFn: () => fetchConversationById(currentConversationId!, profile!.id),
    enabled: Boolean(currentConversationId && profile?.id),
    staleTime: 1000 * 30,
  });

  // Fetch messages for current conversation
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["messages", currentConversationId],
    queryFn: () => fetchMessages(currentConversationId!, 20),
    enabled: Boolean(currentConversationId),
    staleTime: 1000 * 10, // 10 seconds
    // Removed refetchInterval - realtime handles updates
  });

  // Update hasMoreMessages when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // If we got 20 messages, there might be more
      setHasMoreMessages(messages.length >= 20);
    } else {
      setHasMoreMessages(false);
    }
  }, [messages.length]);

  // Fetch unread count
  const {
    data: unreadCount = 0,
    isLoading: isLoadingUnread,
  } = useQuery({
    queryKey: ["unread-count", profile?.id],
    queryFn: () => getUnreadCount(profile!.id),
    enabled: Boolean(profile?.id),
    staleTime: 1000 * 30,
    // Removed refetchInterval - realtime handles updates
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ conversationId, content, listingId, postId }: { conversationId: string; content: string; listingId?: string; postId?: string }) =>
      sendMessage(conversationId, profile!.id, content, listingId, postId),
    onMutate: async ({ conversationId, content, listingId, postId }) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ["messages", conversationId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<Message[]>(["messages", conversationId]);

      // Optimistically update the messages cache
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: profile!.id,
        content: content,
        listing_id: listingId || null,
        post_id: postId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Message[]>(["messages", conversationId], (old = []) => {
        // Messages are stored newest first, so add optimistic message at the beginning
        return [optimisticMessage, ...old];
      });

      return { previousMessages };
    },
    onSuccess: async (newMessage, { conversationId }) => {
      // Decrypt the message before adding to cache
      if (newMessage.content && newMessage.content.startsWith("ENC:")) {
        try {
          newMessage.content = await decryptMessage(newMessage.content, conversationId);
        } catch (error) {
          console.error("Failed to decrypt message in onSuccess", error);
          newMessage.content = "[Encrypted message - unable to decrypt]";
        }
      }
      
      // Replace the optimistic message with the real one from the server
      queryClient.setQueryData<Message[]>(["messages", conversationId], (old = []) => {
        if (!old) return [newMessage];
        // Check if the real message already exists (from realtime subscription)
        const alreadyExists = old.some(m => m.id === newMessage.id);
        if (alreadyExists) {
          // Message already added by realtime, just remove any temp messages
          return old.filter(m => !m.id.startsWith('temp-'));
        }
        // Remove the temporary message and add the real one at the beginning (newest first)
        const filtered = old.filter(m => !m.id.startsWith('temp-'));
        return [newMessage, ...filtered];
      });
      
      // Invalidate and refetch other queries
      queryClient.invalidateQueries({ queryKey: ["conversations", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["unread-count", profile?.id] });
    },
    onError: (error, { conversationId }, context) => {
      // Rollback to the previous messages on error
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", conversationId], context.previousMessages);
      }
      console.error("Failed to send message", error);
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Create direct conversation mutation
  const createDirectConversationMutation = useMutation({
    mutationFn: ({ profileId1, profileId2 }: { profileId1: string; profileId2: string }) =>
      createDirectConversation(profile!.id, profileId2),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", profile?.id] });
      setCurrentConversationId(conversation.id);
      toast({
        title: "Conversation started",
        description: "You can now send messages",
      });
    },
    onError: (error) => {
      console.error("Failed to create conversation", error);
      toast({
        title: "Failed to start conversation",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Create group conversation mutation
  const createGroupConversationMutation = useMutation({
    mutationFn: ({ name, participantIds }: { name: string; participantIds: string[] }) =>
      createGroupConversation(name, profile!.id, participantIds),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", profile?.id] });
      setCurrentConversationId(conversation.id);
      toast({
        title: "Group created",
        description: "You can now send messages",
      });
    },
    onError: (error) => {
      console.error("Failed to create group", error);
      toast({
        title: "Failed to create group",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Update conversation name mutation
  const updateConversationNameMutation = useMutation({
    mutationFn: ({ conversationId, name }: { conversationId: string; name: string }) =>
      updateConversationName(conversationId, name),
    onSuccess: (updatedConversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", profile?.id] });
      queryClient.setQueryData(["conversation", updatedConversation.id, profile?.id], updatedConversation);
      toast({
        title: "Group name updated",
        description: "The group name has been changed",
      });
    },
    onError: (error) => {
      console.error("Failed to update conversation name", error);
      toast({
        title: "Failed to update group name",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Add participant to group mutation
  const addParticipantMutation = useMutation({
    mutationFn: ({ conversationId, profileId }: { conversationId: string; profileId: string }) =>
      addParticipantToGroup(conversationId, profileId),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId, profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations", profile?.id] });
      toast({
        title: "Member added",
        description: "The user has been added to the group",
      });
    },
    onError: (error) => {
      console.error("Failed to add participant", error);
      toast({
        title: "Failed to add member",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Remove participant from group mutation
  const removeParticipantMutation = useMutation({
    mutationFn: ({ conversationId, profileId }: { conversationId: string; profileId: string }) =>
      removeParticipantFromGroup(conversationId, profileId),
    onSuccess: (_, { conversationId, profileId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId, profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations", profile?.id] });
      
      // If user left the conversation, navigate away
      if (profileId === profile?.id) {
        setCurrentConversationId(null);
        toast({
          title: "Left group",
          description: "You have left the group chat",
        });
      } else {
        toast({
          title: "Member removed",
          description: "The user has been removed from the group",
        });
      }
    },
    onError: (error) => {
      console.error("Failed to remove participant", error);
      toast({
        title: "Failed to remove member",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (conversationId: string) => markAsRead(conversationId, profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["unread-count", profile?.id] });
    },
  });

  // Mark conversation as read when viewing it
  useEffect(() => {
    if (currentConversationId && profile?.id) {
      markAsReadMutation.mutate(currentConversationId);
    }
  }, [currentConversationId, profile?.id, markAsReadMutation]);

  // Mark current conversation as read when Messages page becomes active
  useEffect(() => {
    if (isMessagesPageActive && currentConversationId && profile?.id) {
      markAsRead(currentConversationId, profile.id);
    }
  }, [isMessagesPageActive, currentConversationId, profile?.id]);

  // Refetch messages when page becomes visible (handles subscription disconnection after inactivity)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentConversationId) {
        // Refetch messages to ensure sync after being away
        queryClient.invalidateQueries({ queryKey: ["messages", currentConversationId] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentConversationId, queryClient]);
  

  // Reset hasMoreMessages when conversation changes
  useEffect(() => {
    setHasMoreMessages(false);
  }, [currentConversationId]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!profile?.id) return;

    // Get conversation IDs the user is part of
    const conversationIds = conversations.map(c => c.id);

    // Subscribe to messages changes
    const messagesChannel = supabase
      .channel(`messages-changes-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const message = payload.new as Message;
          const conversationId = message.conversation_id;

          // Decrypt message content if encrypted
          if (message.content && message.content.startsWith("ENC:")) {
            try {
              message.content = await decryptMessage(message.content, conversationId);
            } catch (error) {
              console.error("Failed to decrypt real-time message", error);
              message.content = "[Encrypted message - unable to decrypt]";
            }
          }

          if (payload.eventType === 'UPDATE') {
            queryClient.setQueryData<Message[]>(["messages", conversationId], (old = []) => {
              return old.map(m => m.id === message.id ? message : m);
            });
            return;
          }

          // Only process if user is part of this conversation
          if (!conversationIds.includes(conversationId)) {
            // Check if this is a new conversation we should know about
            queryClient.invalidateQueries({ queryKey: ["conversations", profile.id] });
            return;
          }

          // Skip if this is an optimistic message we already added
          if (message.id.startsWith('temp-')) {
            return;
          }

          // Skip messages sent by the current user - we handle those optimistically
          // The onSuccess handler in sendMessageMutation already adds the real message
          if (message.sender_id === profile.id) {
            // Just ensure the real message replaces any temp message if it hasn't already
            queryClient.setQueryData<Message[]>(["messages", conversationId], (old = []) => {
              if (!old) return [message];
              // Check if message already exists
              const exists = old.some(m => m.id === message.id);
              if (exists) {
                return old;
              }
              // Remove any temp messages and add the real one
              const filtered = old.filter(m => !m.id.startsWith('temp-'));
              return [message, ...filtered];
            });
            return;
          }

          // Update messages cache for the affected conversation (messages from other users)
          queryClient.setQueryData<Message[]>(["messages", conversationId], (old = []) => {
            // Check if message already exists (avoid duplicates)
            const exists = old.some(m => m.id === message.id);
            if (exists) {
              return old;
            }
            // Add new message at the beginning (newest first)
            return [message, ...old];
          });

          // Invalidate conversations to update last message info and updated_at
          queryClient.invalidateQueries({ queryKey: ["conversations", profile.id] });
          
          // Invalidate unread count
          queryClient.invalidateQueries({ queryKey: ["unread-count", profile.id] });

          // If this is the current conversation, message is not from current user, and messages page is active, mark as read
          if (
            isMessagesPageActive &&
            conversationId === currentConversationId &&
            message.sender_id !== profile.id
          ) {
            // Mark as read using the mutation
            markAsRead(conversationId, profile.id)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ["conversations", profile.id] });
                queryClient.invalidateQueries({ queryKey: ["unread-count", profile.id] });
              })
              .catch(console.error);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to messages changes');
          // Refetch messages if subscription fails
          if (currentConversationId) {
            queryClient.invalidateQueries({ queryKey: ["messages", currentConversationId] });
          }
        } else if (status === 'SUBSCRIBED') {
          // Subscription is active
        } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
          // Subscription closed or timed out, refetch messages
          if (currentConversationId) {
            queryClient.invalidateQueries({ queryKey: ["messages", currentConversationId] });
          }
        }
      });

    messagesChannelRef.current = messagesChannel;

    // Subscribe to conversations changes
    const conversationsChannel = supabase
      .channel(`conversations-changes-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          // Invalidate conversations list to refresh
          queryClient.invalidateQueries({ queryKey: ["conversations", profile.id] });
          
          // If current conversation was updated, refresh it
          if (payload.new && (payload.new as Conversation).id === currentConversationId) {
            queryClient.invalidateQueries({ 
              queryKey: ["conversation", currentConversationId, profile.id] 
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to conversations changes');
        }
      });

    conversationsChannelRef.current = conversationsChannel;

    // Subscribe to conversation_participants changes
    const participantsChannel = supabase
      .channel(`participants-changes-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `profile_id=eq.${profile.id}`, // Only changes affecting current user
        },
        (payload) => {
          const participant = payload.new as ConversationParticipant;
          const oldParticipant = payload.old as ConversationParticipant;
          const conversationId = participant?.conversation_id || oldParticipant?.conversation_id;

          if (!conversationId) return;

          // If participant was removed and it's the current user, navigate away
          if (payload.eventType === 'DELETE' && oldParticipant?.profile_id === profile.id) {
            if (conversationId === currentConversationId) {
              setCurrentConversationId(null);
              toast({
                title: "Removed from conversation",
                description: "You have been removed from this conversation",
              });
            }
          }

          // Refresh conversations list
          queryClient.invalidateQueries({ queryKey: ["conversations", profile.id] });
          
          // Refresh current conversation if it's the one that changed
          if (conversationId === currentConversationId) {
            queryClient.invalidateQueries({ 
              queryKey: ["conversation", currentConversationId, profile.id] 
            });
          }

          // Invalidate unread count when participant changes
          queryClient.invalidateQueries({ queryKey: ["unread-count", profile.id] });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to participants changes');
        }
      });

    participantsChannelRef.current = participantsChannel;

    // Cleanup subscriptions on unmount or when dependencies change
    return () => {
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current);
        messagesChannelRef.current = null;
      }
      if (conversationsChannelRef.current) {
        supabase.removeChannel(conversationsChannelRef.current);
        conversationsChannelRef.current = null;
      }
      if (participantsChannelRef.current) {
        supabase.removeChannel(participantsChannelRef.current);
        participantsChannelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, conversations.map(c => c.id).join(','), currentConversationId, isMessagesPageActive]);

  const handleSendMessage = useCallback(
    async (conversationId: string, content: string, listingId?: string, postId?: string) => {
      if (!profile?.id) {
        toast({
          title: "Sign in required",
          description: "Please log in to send messages",
        });
        return;
      }

      if (!content.trim()) {
        return;
      }

      await sendMessageMutation.mutateAsync({ conversationId, content, listingId, postId });
    },
    [profile?.id, sendMessageMutation, toast]
  );

  const updateMessageMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      updateMessage(messageId, content),
    onSuccess: async (updatedMessage) => {
      // Decrypt the message before updating the cache
      if (updatedMessage.content && updatedMessage.content.startsWith("ENC:")) {
        try {
          updatedMessage.content = await decryptMessage(updatedMessage.content, updatedMessage.conversation_id);
        } catch (error) {
          console.error("Failed to decrypt updated message", error);
          updatedMessage.content = "[Encrypted message - unable to decrypt]";
        }
      }
      
      queryClient.setQueryData<Message[]>(["messages", updatedMessage.conversation_id], (old = []) => {
        return old.map(m => m.id === updatedMessage.id ? updatedMessage : m);
      });
    },
    onError: (error) => {
      console.error("Failed to update message:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!profile?.id) return;
      await updateMessageMutation.mutateAsync({ messageId, content });
    },
    [profile?.id, updateMessageMutation]
  );

  const handleCreateDirectConversation = useCallback(
    async (profileId1: string, profileId2: string) => {
      if (!profile?.id) {
        toast({
          title: "Sign in required",
          description: "Please log in to start conversations",
        });
        return;
      }

      return await createDirectConversationMutation.mutateAsync({ profileId1, profileId2 });
    },
    [profile?.id, createDirectConversationMutation, toast]
  );

  const handleCreateGroupConversation = useCallback(
    async (name: string, participantIds: string[]) => {
      if (!profile?.id) {
        toast({
          title: "Sign in required",
          description: "Please log in to create groups",
        });
        return;
      }

      return await createGroupConversationMutation.mutateAsync({ name, participantIds });
    },
    [profile?.id, createGroupConversationMutation, toast]
  );

  const handleUpdateConversationName = useCallback(
    async (conversationId: string, name: string) => {
      if (!profile?.id) {
        toast({
          title: "Sign in required",
          description: "Please log in to update group names",
        });
        return;
      }

      return await updateConversationNameMutation.mutateAsync({ conversationId, name });
    },
    [profile?.id, updateConversationNameMutation, toast]
  );

  const handleAddParticipantToGroup = useCallback(
    async (conversationId: string, profileId: string) => {
      if (!profile?.id) {
        toast({
          title: "Sign in required",
          description: "Please log in to add members",
        });
        return;
      }

      return await addParticipantMutation.mutateAsync({ conversationId, profileId });
    },
    [profile?.id, addParticipantMutation, toast]
  );

  const handleRemoveParticipant = useCallback(
    async (conversationId: string, profileId: string) => {
      if (!profile?.id) {
        toast({
          title: "Sign in required",
          description: "Please log in to remove members",
        });
        return;
      }

      return await removeParticipantMutation.mutateAsync({ conversationId, profileId });
    },
    [profile?.id, removeParticipantMutation, toast]
  );

  const handleMarkAsRead = useCallback(
    async (conversationId: string) => {
      if (!profile?.id) return;
      await markAsReadMutation.mutateAsync(conversationId);
    },
    [profile?.id, markAsReadMutation]
  );

  const handleSearchUsers = useCallback(
    async (query: string, excludeIds?: string[]) => {
      if (!query.trim()) return [];
      return await searchUsers(query, excludeIds);
    },
    []
  );

  const handleFetchProfileById = useCallback(
    async (profileId: string) => {
      return await fetchProfileById(profileId);
    },
    []
  );

  const handleFetchProfilesByIds = useCallback(
    async (profileIds: string[]) => {
      return await fetchProfilesByIds(profileIds);
    },
    []
  );

  const handleRefreshConversations = useCallback(async () => {
    await refetchConversations();
  }, [refetchConversations]);

  const handleRefreshMessages = useCallback(async () => {
    await refetchMessages();
  }, [refetchMessages]);

  const handleLoadMoreMessages = useCallback(async (conversationId: string) => {
    if (isLoadingMoreMessages || !hasMoreMessages || conversationId !== currentConversationId) {
      return;
    }

    setIsLoadingMoreMessages(true);
    try {
      const currentMessages = queryClient.getQueryData<Message[]>(["messages", conversationId]) || [];
      if (currentMessages.length === 0) {
        setIsLoadingMoreMessages(false);
        return;
      }

      // Get the oldest message (last in array since messages are newest first)
      const oldestMessage = currentMessages[currentMessages.length - 1];
      
      // Fetch older messages
      const olderMessages = await fetchMessages(conversationId, 20, oldestMessage.id);
      
      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
      } else {
        // Append older messages to the end (they're already in newest-first order)
        queryClient.setQueryData<Message[]>(["messages", conversationId], (old = []) => {
          // Check for duplicates
          const existingIds = new Set(old.map(m => m.id));
          const newMessages = olderMessages.filter(m => !existingIds.has(m.id));
          return [...old, ...newMessages];
        });
        
        // If we got less than 20, there are no more messages
        setHasMoreMessages(olderMessages.length >= 20);
      }
    } catch (error) {
      console.error("Failed to load more messages", error);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  }, [isLoadingMoreMessages, hasMoreMessages, currentConversationId, queryClient]);

  const value: MessagesContextType = {
    conversations,
    currentConversation,
    messages,
    unreadCount,
    isLoadingConversations,
    isLoadingMessages,
    isLoadingUnread,
    setCurrentConversationId,
    setIsMessagesPageActive,
    sendMessage: handleSendMessage,
    createDirectConversation: handleCreateDirectConversation,
    createGroupConversation: handleCreateGroupConversation,
    updateConversationName: handleUpdateConversationName,
    updateMessage: handleUpdateMessage,
    addParticipantToGroup: handleAddParticipantToGroup,
    removeParticipantFromGroup: handleRemoveParticipant,
    markAsRead: handleMarkAsRead,
    searchUsers: handleSearchUsers,
    fetchProfileById: handleFetchProfileById,
    fetchProfilesByIds: handleFetchProfilesByIds,
    loadMoreMessages: handleLoadMoreMessages,
    hasMoreMessages,
    isLoadingMoreMessages,
    refreshConversations: handleRefreshConversations,
    refreshMessages: handleRefreshMessages,
  };

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
};
