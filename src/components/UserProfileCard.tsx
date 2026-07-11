import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Calendar, Trophy, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useMessages } from "@/contexts/MessagesContext";

interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  points: number;
}

interface UserProfileCardProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LEVELS = [
  { level: 1, threshold: 0, name: "Newcomer", color: "bg-gray-200 text-gray-700" },
  { level: 2, threshold: 100, name: "Contributor", color: "bg-blue-200 text-blue-700" },
  { level: 3, threshold: 500, name: "Active Member", color: "bg-green-200 text-green-700" },
  { level: 4, threshold: 1000, name: "Champion", color: "bg-purple-200 text-purple-700" },
  { level: 5, threshold: 2000, name: "Legend", color: "bg-amber-300 text-amber-800" },
];

function calculateLevel(points: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].threshold) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

export function UserProfileCard({ userId, open, onOpenChange }: UserProfileCardProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { createDirectConversation } = useMessages();

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (!open || !userId) return;
    
    let cancelled = false;
    
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, created_at, points")
          .eq("id", userId)
          .single();

        if (!cancelled) {
          if (error) throw error;
          setProfile(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch profile", err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    
    fetchProfile();
    return () => { cancelled = true; };
  }, [open, userId]);

  const handleSendMessage = async () => {
    if (!user || isOwnProfile) return;
    
    setIsStartingChat(true);
    try {
      // createDirectConversation automatically sets currentConversationId in context
      const conversation = await createDirectConversation(user.id, userId);
      if (conversation) {
        onOpenChange(false);
        navigate("/messages");
      }
    } catch (err) {
      console.error("Failed to start conversation", err);
    } finally {
      setIsStartingChat(false);
    }
  };

  const levelInfo = profile ? calculateLevel(profile.points) : LEVELS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : profile ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>User Profile</DialogTitle>
            </DialogHeader>
            
            <div className="flex flex-col items-center text-center pt-4">
              {/* Avatar */}
              <Avatar className="h-24 w-24 mb-4 ring-4 ring-primary/20">
                <AvatarImage src={profile.avatar_url || ""} />
                <AvatarFallback className="text-2xl bg-primary/10">
                  {profile.full_name?.charAt(0) || profile.username?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>

              {/* Name and Username */}
              <h2 className="text-xl font-bold text-foreground">
                {profile.full_name || profile.username || "Unknown User"}
              </h2>
              {profile.username && profile.username !== profile.full_name && (
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              )}

              {/* Level Badge */}
              <Badge className={`mt-3 ${levelInfo.color}`}>
                <Trophy className="h-3 w-3 mr-1" />
                {levelInfo.name} • Level {levelInfo.level}
              </Badge>

              {/* Bio */}
              {profile.bio && (
                <p className="mt-4 text-sm text-muted-foreground max-w-xs">
                  {profile.bio}
                </p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mt-6 w-full max-w-xs">
                <Card className="border">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{profile.points}</div>
                    <div className="text-xs text-muted-foreground">Points</div>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Member since {format(new Date(profile.created_at), "MMM yyyy")}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Actions */}
              {!isOwnProfile && user && (
                <Button 
                  className="mt-6 w-full max-w-xs gap-2" 
                  onClick={handleSendMessage}
                  disabled={isStartingChat}
                >
                  {isStartingChat ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                  Send Message
                </Button>
              )}

              {isOwnProfile && (
                <Button 
                  variant="outline"
                  className="mt-6 w-full max-w-xs" 
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/profile");
                  }}
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">User not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
