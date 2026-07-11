import { useState, useEffect } from "react";
import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMessages } from "@/contexts/MessagesContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Listing } from "@/types/listings";
import type { Profile } from "@/types/messages";
import { Users, User } from "lucide-react";

interface ShareListingModalProps {
  listing: Listing;
  onClose: () => void;
}

const ShareListingModal = ({ listing, onClose }: ShareListingModalProps) => {
  const { conversations, sendMessage, fetchProfilesByIds } = useMessages();
  const { profile } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [participantProfiles, setParticipantProfiles] = useState<Map<string, Profile>>(new Map());

  // Fetch profiles for all participants
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

  const handleSend = async () => {
    if (!selectedConversationId) return;

    setIsSending(true);
    try {
      await sendMessage(selectedConversationId, messageText.trim() || "Check out this listing!", listing.id);
      onClose();
    } catch (error) {
      console.error("Failed to share listing", error);
    } finally {
      setIsSending(false);
    }
  };

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
      return null;
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

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle>Share Listing</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>Select a conversation to share this listing</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {/* Listing Preview */}
          <div className="border border-border rounded-lg p-4 bg-muted/50">
            <div className="flex gap-4">
              <img
                src={listing.image}
                alt={listing.title}
                className="h-24 w-24 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold line-clamp-2">{listing.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {listing.summary || listing.description}
                </p>
                <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-muted-foreground mt-2">
                  {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Message Text */}
          <div className="space-y-2">
            <Label htmlFor="message-text">Add a message (optional)</Label>
            <Textarea
              id="message-text"
              placeholder="Add a message to go with this listing..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="min-h-[80px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {messageText.length}/500
            </p>
          </div>

          {/* Conversation List */}
          <div className="space-y-2">
            <Label>Select a conversation</Label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No conversations yet. Start a conversation to share listings.
                </p>
              ) : (
                conversations.map((conversation) => {
                  const isSelected = selectedConversationId === conversation.id;
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-primary"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 flex-shrink-0">
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
                          <p className="font-medium text-sm truncate">
                            {getConversationName(conversation)}
                          </p>
                          {conversation.is_group_chat && (
                            <p className="text-xs text-muted-foreground">
                              {conversation.participants.length} participants
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
        <div className="border-t border-border p-4 flex-shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedConversationId || isSending}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ShareListingModal;

