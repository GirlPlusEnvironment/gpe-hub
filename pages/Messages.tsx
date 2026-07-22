import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus, Search, Users, User } from "lucide-react";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import ConversationView from "@/components/ConversationView";
import UserSearch from "@/components/UserSearch";
import type { Profile } from "@/types/messages";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, Sticker, Tape } from "@/components/camp/CampDesign";

const Messages = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    conversations,
    currentConversation,
    unreadCount,
    isLoadingConversations,
    setCurrentConversationId,
    setIsMessagesPageActive,
    createDirectConversation,
    createGroupConversation,
    fetchProfilesByIds,
  } = useMessages();
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [participantProfiles, setParticipantProfiles] = useState<Map<string, Profile>>(new Map());

  // Notify context when Messages page is active
  useEffect(() => {
    setIsMessagesPageActive(true);
    return () => {
      setIsMessagesPageActive(false);
    };
  }, [setIsMessagesPageActive]);

  // Fetch profiles for all participants in conversations
  useEffect(() => {
    if (conversations.length === 0 || !profile?.id) return;

    const profileIds = new Set<string>();
    conversations.forEach((conv) => {
      conv.participants.forEach((p) => {
        if (p.profile_id !== profile.id) {
          profileIds.add(p.profile_id);
        }
      });
    });

    if (profileIds.size > 0) {
      fetchProfilesByIds(Array.from(profileIds)).then((profiles) => {
        const profilesMap = new Map<string, Profile>();
        profiles.forEach((p) => {
          profilesMap.set(p.id, p);
        });
        setParticipantProfiles(profilesMap);
      });
    }
  }, [conversations, profile?.id, fetchProfilesByIds]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      if (conv.is_group_chat) {
        // Search by group name
        const nameMatch = conv.name?.toLowerCase().includes(query);
        if (nameMatch) return true;
        
        // Also search by participant names
        const participantMatch = conv.participants.some((participant) => {
          // Skip current user
          if (participant.profile_id === profile?.id) return false;
          
          const participantProfile = participantProfiles.get(participant.profile_id);
          if (participantProfile) {
            const fullName = participantProfile.full_name?.toLowerCase() || "";
            const username = participantProfile.username?.toLowerCase() || "";
            return fullName.includes(query) || username.includes(query);
          }
          return false;
        });
        
        return participantMatch;
      } else {
        // For direct conversations, search by other participant's name
        const otherParticipant = conv.participants.find((p) => p.profile_id !== profile?.id);
        if (otherParticipant) {
          const otherProfile = participantProfiles.get(otherParticipant.profile_id);
          if (otherProfile) {
            // Search by full name or username
            const fullName = otherProfile.full_name?.toLowerCase() || "";
            const username = otherProfile.username?.toLowerCase() || "";
            return fullName.includes(query) || username.includes(query);
          }
        }
        return false;
      }
    });
  }, [conversations, searchQuery, profile?.id, participantProfiles]);

  const getConversationName = (conversation: typeof conversations[0]) => {
    if (conversation.is_group_chat) {
      return conversation.name || "Group Chat";
    } else {
      const otherParticipant = conversation.participants.find(
        (p) => p.profile_id !== profile?.id
      );
      if (otherParticipant) {
        const otherProfile = participantProfiles.get(otherParticipant.profile_id);
        if (otherProfile) {
          return otherProfile.full_name || otherProfile.username || "Direct Message";
        }
      }
      return "Direct Message";
    }
  };

  const getConversationAvatar = (conversation: typeof conversations[0]) => {
    if (conversation.is_group_chat) {
      return null; // Group icon
    } else {
      const otherParticipant = conversation.participants.find(
        (p) => p.profile_id !== profile?.id
      );
      if (otherParticipant) {
        const otherProfile = participantProfiles.get(otherParticipant.profile_id);
        return otherProfile?.avatar_url || null;
      }
      return null;
    }
  };

  const getConversationAvatarFallback = (conversation: typeof conversations[0]) => {
    if (conversation.is_group_chat) {
      return null;
    } else {
      const otherParticipant = conversation.participants.find(
        (p) => p.profile_id !== profile?.id
      );
      if (otherParticipant) {
        const otherProfile = participantProfiles.get(otherParticipant.profile_id);
        if (otherProfile) {
          return otherProfile.full_name?.charAt(0).toUpperCase() ||
                 otherProfile.username?.charAt(0).toUpperCase() ||
                 "U";
        }
      }
      return null;
    }
  };

  const handleConversationClick = (conversationId: string) => {
    setCurrentConversationId(conversationId);
  };

  const handleNewConversation = async (profileIds: string[], groupName?: string) => {
    try {
      let conversation;
      if (profileIds.length === 1) {
        // Direct conversation
        if (!profile?.id) return;
        conversation = await createDirectConversation(profile.id, profileIds[0]);
      } else {
        // Group conversation
        conversation = await createGroupConversation(
          groupName || `Group with ${profileIds.length} members`,
          profileIds
        );
      }
      setCurrentConversationId(conversation.id);
      setShowUserSearch(false);
    } catch (error) {
      console.error("Failed to create conversation", error);
    }
  };

  return (
    <div className="gpe-page min-h-screen">
      <Header />
      <main className="gpe-page-main flex min-h-screen max-w-7xl flex-col">
        <SectionHeader
          className="mb-6"
          eyebrow={<Sticker accent="pink"><MessageSquare className="mr-2 h-4 w-4" /> Inbox</Sticker>}
          title="Messages"
          description="Direct messages and group chats with the GPE community."
          action={
          <CampButton
            onClick={() => setShowUserSearch(true)}
            variant="secondary"
          >
            <Plus className="h-4 w-4" />
            New Message
          </CampButton>
          }
        />

        {showUserSearch && (
          <div className="mb-4 flex-shrink-0">
            <UserSearch
              onSelectUsers={handleNewConversation}
              onCancel={() => setShowUserSearch(false)}
            />
          </div>
        )}

        <div className="gpe-card flex min-h-[72vh] flex-1 flex-col gap-0 overflow-hidden p-0 md:flex-row">
          <div className="flex max-h-[42vh] w-full min-h-0 flex-col overflow-hidden border-b-[3px] border-black md:max-h-none md:w-1/3 md:border-b-0 md:border-r-[3px] lg:w-[340px]">
            <div className="border-b-[3px] border-black p-4">
              <div className="mb-4 flex items-center justify-between">
                <Tape>Conversations</Tape>
                <Badge className="border-[2px] border-black bg-[#d53f8c] text-white">{unreadCount}</Badge>
              </div>
              <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            </div>

            {isLoadingConversations ? (
              <div className="space-y-3 overflow-hidden p-3">
                <LoadingCampCard label="Loading conversations" />
                <LoadingCampCard label="Loading conversations" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <EmptyState
                illustration="megaphone"
                title={searchQuery ? "No Matches" : "No Conversations Yet"}
                description={searchQuery ? "Try another search." : "Start a conversation when you are ready to connect."}
                action={!searchQuery ? <CampButton variant="outline" onClick={() => setShowUserSearch(true)}>Start Conversation</CampButton> : null}
                className="m-3"
              />
            ) : (
              <div className="gpe-scrollbar flex-1 space-y-2 overflow-y-auto p-3 min-h-0">
                {filteredConversations.map((conversation) => {
                  // Check if conversation has unread messages
                  const currentUserParticipant = conversation.participants.find(
                    (p) => p.profile_id === profile?.id
                  );
                  const isUnread = currentUserParticipant
                    ? !currentUserParticipant.last_read_at ||
                      new Date(conversation.updated_at) > new Date(currentUserParticipant.last_read_at)
                    : false;
                  
                  const lastUpdated = formatDistanceToNow(new Date(conversation.updated_at), {
                    addSuffix: true,
                  });
                  const isActive = currentConversation?.id === conversation.id;

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => handleConversationClick(conversation.id)}
                      className={`gpe-hover-lift w-full rounded-[1.5rem] border-[3px] border-black p-3 text-left transition-colors ${
                        isActive
                          ? "bg-cyan-100"
                          : isUnread
                          ? "bg-pink-100"
                          : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12 flex-shrink-0 border-[3px] border-black">
                          {conversation.is_group_chat ? (
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              <Users className="h-5 w-5" />
                            </AvatarFallback>
                          ) : (
                            <>
                              <AvatarImage src={getConversationAvatar(conversation) || undefined} />
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {getConversationAvatarFallback(conversation) || (
                                  <User className="h-5 w-5" />
                                )}
                              </AvatarFallback>
                            </>
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-black text-sm truncate">
                              {getConversationName(conversation)}
                            </p>
                            {isUnread && (
                              <Badge variant="default" className="h-2 w-2 p-0 rounded-full" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {lastUpdated}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[#fdf2f8]">
            {currentConversation ? (
              <ConversationView
                conversation={currentConversation}
                onBack={() => setCurrentConversationId(null)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <EmptyState
                  illustration="megaphone"
                  title="Pick a Thread"
                  description="Choose a conversation from the list or start a new one."
                  action={<CampButton onClick={() => setShowUserSearch(true)}><Plus className="mr-2 h-4 w-4" />New Message</CampButton>}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;
