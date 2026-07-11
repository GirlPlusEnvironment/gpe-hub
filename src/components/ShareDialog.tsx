import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Share2, ArrowLeft } from "lucide-react";
import UserSearch from "@/components/UserSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/contexts/MessagesContext";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from "@/types/messages";

interface ShareDialogProps {
  postId?: string;
  listingId?: string;
  children?: React.ReactNode;
}

export function ShareDialog({ postId, listingId, children }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'search' | 'compose'>('search');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [recentUsers, setRecentUsers] = useState<Profile[]>([]);
  
  const { createDirectConversation, sendMessage, conversations, fetchProfilesByIds } = useMessages();
  const { profile } = useAuth();
  const { toast } = useToast();

  // Fetch recent users from conversations
  useEffect(() => {
    if (open && conversations.length > 0 && profile?.id) {
      const fetchRecentUsers = async () => {
        // Get unique profile IDs from recent conversations
        const recentProfileIds = new Set<string>();
        
        // Sort conversations by updated_at (most recent first)
        const sortedConversations = [...conversations].sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        for (const conv of sortedConversations) {
          // For direct chats, add the other person
          if (!conv.is_group_chat) {
            const otherParticipant = conv.participants.find(p => p.profile_id !== profile.id);
            if (otherParticipant) {
              recentProfileIds.add(otherParticipant.profile_id);
            }
          }
          // Limit to 5 recent users
          if (recentProfileIds.size >= 5) break;
        }

        if (recentProfileIds.size > 0) {
          try {
            const profiles = await fetchProfilesByIds(Array.from(recentProfileIds));
            setRecentUsers(profiles);
          } catch (error) {
            console.error("Failed to fetch recent users", error);
          }
        }
      };

      fetchRecentUsers();
    }
  }, [open, conversations, profile?.id, fetchProfilesByIds]);

  const handleSelectUsers = (profileIds: string[]) => {
    setSelectedRecipientIds(profileIds);
    setStep('compose');
  };

  const handleSend = async () => {
    if (selectedRecipientIds.length === 0) return;
    if (!profile) return;
    
    setIsSending(true);
    try {
      // For now, just handle sharing to the first selected user (Direct Message)
      const recipientId = selectedRecipientIds[0];
      const conversation = await createDirectConversation(profile.id, recipientId);
      
      const content = message.trim() || (postId ? "Shared a community post" : "Shared a listing");

      await sendMessage(conversation.id, content, listingId, postId);

      toast({
        title: "Shared successfully",
        description: "Message sent.",
      });
      setOpen(false);
      // Reset state
      setStep('search');
      setMessage("");
      setSelectedRecipientIds([]);
    } catch (error) {
      console.error("Failed to share", error);
      toast({
        title: "Error",
        description: "We couldn't share this content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setTimeout(() => {
        setStep('search');
        setMessage("");
        setSelectedRecipientIds([]);
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'search' ? "Share via Message" : "Add a Message"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {step === 'search' ? (
            <UserSearch 
              onSelectUsers={handleSelectUsers} 
              onCancel={() => setOpen(false)}
              actionLabel="Next"
              suggestedUsers={recentUsers}
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message">Message (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Write a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setStep('search')}
                  disabled={isSending}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleSend} disabled={isSending}>
                  {isSending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
