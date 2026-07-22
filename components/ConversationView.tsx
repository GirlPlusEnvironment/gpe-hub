import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ArrowLeft, Send, Users, User, Edit2, Check, X, MoreVertical, UserPlus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import type { Conversation, Profile } from "@/types/messages";
import type { Listing } from "@/types/listings";
import MessageInput from "./MessageInput";
import UserSearch from "./UserSearch";
import ListingMessageCard from "./ListingMessageCard";
import PostMessageCard from "./PostMessageCard";
import { fetchListingById } from "@/lib/listings";
import { formatDistanceToNow, format } from "date-fns";

interface ConversationViewProps {
  conversation: Conversation;
  onBack: () => void;
}

const ConversationView = ({ conversation, onBack }: ConversationViewProps) => {
  const { profile } = useAuth();
  const { 
    messages, 
    isLoadingMessages, 
    sendMessage, 
    fetchProfileById, 
    updateConversationName,
    updateMessage,
    addParticipantToGroup,
    removeParticipantFromGroup,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMoreMessages,
  } = useMessages();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(conversation.name || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState("");
  const [otherParticipantProfile, setOtherParticipantProfile] = useState<Profile | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<Map<string, Profile>>(new Map());
  const [listingCache, setListingCache] = useState<Map<string, Listing>>(new Map());
  const fetchedProfilesRef = useRef<Set<string>>(new Set());
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const previousMessagesLengthRef = useRef<number>(0);
  const isLoadingMoreRef = useRef<boolean>(false);

  // Reverse messages to show oldest at top, newest at bottom
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const reversedMessageIds = useMemo(() => reversedMessages.map((message) => message.id).join(","), [reversedMessages]);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Reset scroll state when conversation changes
  useEffect(() => {
    setHasScrolledToBottom(false);
    previousMessagesLengthRef.current = 0;
    isLoadingMoreRef.current = false;
  }, [conversation.id]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!isLoadingMessages && messages.length > 0 && !hasScrolledToBottom) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom("auto");
        setHasScrolledToBottom(true);
      }, 100);
    }
  }, [isLoadingMessages, messages.length, hasScrolledToBottom, conversation.id]);

  // Scroll to bottom when new messages arrive (but only if user is already at bottom)
  useEffect(() => {
    if (messages.length > previousMessagesLengthRef.current && hasScrolledToBottom) {
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
          setTimeout(() => {
            scrollToBottom("smooth");
          }, 100);
        }
      }
    }
    previousMessagesLengthRef.current = messages.length;
  }, [messages.length, hasScrolledToBottom]);

  // Handle infinite scroll - load more messages when scrolling near top
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingMoreMessages || isLoadingMoreRef.current || !hasMoreMessages) return;

    // If scrolled within 200px of top, load more messages
    if (container.scrollTop < 200) {
      isLoadingMoreRef.current = true;
      const scrollHeightBefore = container.scrollHeight;
      const scrollTopBefore = container.scrollTop;
      
      loadMoreMessages(conversation.id).then(() => {
        // Preserve scroll position after loading older messages
        requestAnimationFrame(() => {
          if (container) {
            const scrollHeightAfter = container.scrollHeight;
            const scrollDifference = scrollHeightAfter - scrollHeightBefore;
            container.scrollTop = scrollTopBefore + scrollDifference;
          }
          isLoadingMoreRef.current = false;
        });
      }).catch(() => {
        isLoadingMoreRef.current = false;
      });
    }
  }, [isLoadingMoreMessages, hasMoreMessages, conversation.id, loadMoreMessages]);

  // Update edited name when conversation changes
  useEffect(() => {
    setEditedName(conversation.name || "");
  }, [conversation.name]);

  // Fetch profile for other participant in direct conversations
  useEffect(() => {
    if (!conversation.is_group_chat && profile?.id) {
      const otherParticipant = conversation.participants.find(
        (p) => p.profile_id !== profile.id
      );
      if (otherParticipant) {
        fetchProfileById(otherParticipant.profile_id).then((profile) => {
          if (profile) {
            setOtherParticipantProfile(profile);
          }
        });
      }
    }
  }, [conversation, profile?.id, fetchProfileById]);

  // Fetch profiles for all participants in group chats
  useEffect(() => {
    if (conversation.is_group_chat && conversation.participants.length > 0) {
      const participantIds = conversation.participants.map((p) => p.profile_id);
      Promise.all(participantIds.map((id) => fetchProfileById(id))).then((profiles) => {
        const profilesMap = new Map<string, Profile>();
        profiles.forEach((p, index) => {
          if (p) {
            profilesMap.set(participantIds[index], p);
          }
        });
        setParticipantProfiles((prev) => {
          const newMap = new Map(prev);
          profilesMap.forEach((p, id) => newMap.set(id, p));
          return newMap;
        });
      });
    }
  }, [conversation.participants, conversation.is_group_chat, fetchProfileById]);

  // Fetch listings for messages that have listing_id
  useEffect(() => {
    const listingIds = new Set<string>();
    reversedMessages.forEach((message) => {
      if (message.listing_id && !listingCache.has(message.listing_id)) {
        listingIds.add(message.listing_id);
      }
    });

    if (listingIds.size > 0) {
      Promise.all(Array.from(listingIds).map((id) => fetchListingById(id))).then((listings) => {
        setListingCache((prev) => {
          const newMap = new Map(prev);
          listings.forEach((listing, index) => {
            if (listing) {
              newMap.set(Array.from(listingIds)[index], listing);
            }
          });
          return newMap;
        });
      });
    }
  }, [reversedMessages, reversedMessageIds, listingCache]);

  // Fetch profiles for all message senders
  useEffect(() => {
    if (reversedMessages.length === 0) return;

    const senderIds = Array.from(new Set(reversedMessages.map((m) => m.sender_id)));
    const profilesToFetch: string[] = [];

    // Check which profiles we need to fetch
    senderIds.forEach((senderId) => {
      if (senderId !== profile?.id && !fetchedProfilesRef.current.has(senderId)) {
        profilesToFetch.push(senderId);
        fetchedProfilesRef.current.add(senderId);
      }
    });

    // Fetch missing profiles
    if (profilesToFetch.length > 0) {
      Promise.all(profilesToFetch.map((id) => fetchProfileById(id))).then((profiles) => {
        setParticipantProfiles((prev) => {
          const newMap = new Map(prev);
          profiles.forEach((p, index) => {
            if (p) {
              newMap.set(profilesToFetch[index], p);
            }
          });
          return newMap;
        });
      });
    }
  }, [reversedMessages, reversedMessageIds, profile?.id, fetchProfileById]);

  const getConversationName = () => {
    if (conversation.is_group_chat) {
      return conversation.name || "Group Chat";
    } else {
      if (otherParticipantProfile) {
        return otherParticipantProfile.full_name || otherParticipantProfile.username || "Direct Message";
      }
      return "Direct Message";
    }
  };

  const getConversationAvatar = () => {
    if (conversation.is_group_chat) {
      return null;
    } else {
      return otherParticipantProfile?.avatar_url || null;
    }
  };

  const getSenderProfile = (senderId: string): Profile | null => {
    if (senderId === profile?.id) {
      return profile ? {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      } : null;
    }
    return participantProfiles.get(senderId) || null;
  };

  const handleStartEditName = () => {
    setIsEditingName(true);
    setEditedName(conversation.name || "");
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName(conversation.name || "");
  };

  const handleSaveName = async () => {
    if (!conversation.is_group_chat) return;
    
    const trimmedName = editedName.trim();
    if (!trimmedName) {
      // Don't allow empty names
      setEditedName(conversation.name || "");
      setIsEditingName(false);
      return;
    }

    if (trimmedName === conversation.name) {
      // No change
      setIsEditingName(false);
      return;
    }

    setIsUpdatingName(true);
    try {
      await updateConversationName(conversation.id, trimmedName);
      setIsEditingName(false);
    } catch (error) {
      console.error("Failed to update group name", error);
      // Reset on error
      setEditedName(conversation.name || "");
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleAddMember = async (profileId: string) => {
    try {
      await addParticipantToGroup(conversation.id, profileId);
      setShowAddMember(false);
    } catch (error) {
      console.error("Failed to add member", error);
    }
  };

  const handleLeaveGroup = async () => {
    if (!profile?.id) return;
    if (window.confirm("Are you sure you want to leave this group chat?")) {
      try {
        await removeParticipantFromGroup(conversation.id, profile.id);
        onBack(); // Navigate back after leaving
      } catch (error) {
        console.error("Failed to leave group", error);
      }
    }
  };

  const handleSendMessage = async (content: string, listingId?: string) => {
    if (!content.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(conversation.id, content, listingId);
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return format(date, "h:mm a");
    } else if (diffInHours < 48) {
      return "Yesterday";
    } else {
      return format(date, "MMM d, h:mm a");
    }
  };

  const formatMessageDate = (timestamp: string, prevTimestamp?: string) => {
    if (!prevTimestamp) return format(new Date(timestamp), "EEEE, MMMM d, yyyy");

    const date = new Date(timestamp);
    const prevDate = new Date(prevTimestamp);

    if (
      date.getDate() !== prevDate.getDate() ||
      date.getMonth() !== prevDate.getMonth() ||
      date.getFullYear() !== prevDate.getFullYear()
    ) {
      return format(date, "EEEE, MMMM d, yyyy");
    }

    return null;
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex min-w-0 flex-shrink-0 items-center gap-3 border-b border-border p-3 sm:gap-4 sm:p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-10 w-10">
          {conversation.is_group_chat ? (
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Users className="h-5 w-5" />
            </AvatarFallback>
          ) : (
            <>
              <AvatarImage src={getConversationAvatar() || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {otherParticipantProfile ? (
                  otherParticipantProfile.full_name?.charAt(0).toUpperCase() ||
                  otherParticipantProfile.username?.charAt(0).toUpperCase() ||
                  "U"
                ) : (
                  <User className="h-5 w-5" />
                )}
              </AvatarFallback>
            </>
          )}
        </Avatar>
        <div className="flex-1 min-w-0">
          {conversation.is_group_chat && isEditingName ? (
            <div className="flex min-w-0 items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveName();
                  } else if (e.key === "Escape") {
                    handleCancelEditName();
                  }
                }}
                disabled={isUpdatingName}
                className="min-w-0 flex-1"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSaveName}
                disabled={isUpdatingName || !editedName.trim()}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancelEditName}
                disabled={isUpdatingName}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="min-w-0 truncate font-semibold">{getConversationName()}</h2>
              {conversation.is_group_chat && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleStartEditName}
                  className="h-6 w-6 flex-shrink-0"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
          {conversation.is_group_chat && (
            <p className="text-sm text-muted-foreground">
              {conversation.participants.length} participants
            </p>
          )}
        </div>
        {conversation.is_group_chat && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(calc(100vw-2rem),16rem)]">
              <DropdownMenuLabel>Group Members</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-[300px] overflow-y-auto">
                {conversation.participants.map((participant) => {
                  const participantProfile = participantProfiles.get(participant.profile_id);
                  const isCurrentUser = participant.profile_id === profile?.id;
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center gap-3 px-2 py-2 hover:bg-muted rounded-sm"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participantProfile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {participantProfile?.full_name?.charAt(0).toUpperCase() ||
                            participantProfile?.username?.charAt(0).toUpperCase() ||
                            "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {participantProfile?.full_name || participantProfile?.username || "Unknown"}
                          {isCurrentUser && " (You)"}
                        </p>
                        {participantProfile?.username && participantProfile?.full_name && (
                          <p className="text-xs text-muted-foreground truncate">
                            @{participantProfile.username}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowAddMember(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLeaveGroup} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Leave Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Add Member Dialog */}
      {showAddMember && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-h-[80vh] w-full max-w-md min-w-0 overflow-y-auto rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Member to Group</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAddMember(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <UserSearch
              onSelectUsers={(profileIds) => {
                if (profileIds.length > 0) {
                  handleAddMember(profileIds[0]);
                }
              }}
              onCancel={() => setShowAddMember(false)}
              excludeIds={conversation.participants.map((p) => p.profile_id)}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-4"
        onScroll={handleScroll}
      >
        {isLoadingMoreMessages && (
          <div className="flex items-center justify-center py-4">
            <div className="text-sm text-muted-foreground">Loading older messages...</div>
          </div>
        )}
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">No messages yet</p>
              <p className="text-sm text-muted-foreground">
                Start the conversation by sending a message
              </p>
            </div>
          </div>
        ) : (
          reversedMessages.map((message, index) => {
            const isOwnMessage = message.sender_id === profile?.id;
            const prevMessage = index > 0 ? reversedMessages[index - 1] : null;
            const dateHeader = formatMessageDate(
              message.created_at,
              prevMessage?.created_at
            );
            const senderProfile = getSenderProfile(message.sender_id);
            const senderInitial = senderProfile?.full_name?.charAt(0).toUpperCase() || 
                                 senderProfile?.username?.charAt(0).toUpperCase() || 
                                 "U";

            return (
              <div key={message.id}>
                {dateHeader && (
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                      {dateHeader}
                    </div>
                  </div>
                )}
                <div
                  className={`flex gap-3 ${
                    isOwnMessage ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={senderProfile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {senderInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`flex min-w-0 max-w-[82%] flex-col gap-1 sm:max-w-[70%] ${
                      isOwnMessage ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`group relative min-w-0 max-w-full rounded-lg px-3 py-2 sm:px-4 ${
                        isOwnMessage
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {isOwnMessage && !editingMessageId && (
                        <div className="absolute top-0 right-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditingMessageId(message.id);
                              setEditMessageContent(message.content || "");
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      
                      {editingMessageId === message.id ? (
                        <div className="flex w-full min-w-0 flex-col gap-2 sm:min-w-[200px]">
                          <Input
                            value={editMessageContent}
                            onChange={(e) => setEditMessageContent(e.target.value)}
                            className="bg-background text-foreground h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateMessage(message.id, editMessageContent);
                                setEditingMessageId(null);
                              } else if (e.key === "Escape") {
                                setEditingMessageId(null);
                              }
                            }}
                          />
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => setEditingMessageId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                updateMessage(message.id, editMessageContent);
                                setEditingMessageId(null);
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {message.content && (
                            <p className={`text-sm whitespace-pre-wrap break-words ${message.listing_id || message.post_id ? 'mb-2' : ''}`}>
                              {message.content}
                              {message.created_at !== message.updated_at && (
                                <span className="text-[10px] opacity-70 ml-1 italic">(edited)</span>
                              )}
                            </p>
                          )}
                        </>
                      )}
                      {message.listing_id && listingCache.has(message.listing_id) && (
                        <div className={message.content ? "mt-2" : ""}>
                          <ListingMessageCard listing={listingCache.get(message.listing_id)!} />
                        </div>
                      )}
                      {message.post_id && (
                        <div className={message.content ? "mt-2" : ""}>
                          <PostMessageCard postId={message.post_id} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground px-1">
                      {formatMessageTime(message.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-border p-4 flex-shrink-0">
        <MessageInput
          onSend={handleSendMessage}
          disabled={isSending}
          placeholder="Type a message..."
        />
      </div>
    </div>
  );
};

export default ConversationView;
