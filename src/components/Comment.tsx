import React, { useState, useMemo } from "react";
import { PostComment } from "@/types/posts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Reply, MoreVertical, Edit, Trash2, X, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { deleteComment, updateComment } from "@/lib/posts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { UserProfileCard } from "@/components/UserProfileCard";

interface CommentProps {
  comment: PostComment;
  onReply: (parentId: string, content: string) => Promise<void>;
  onRefresh: () => void;
  depth?: number;
}

export const Comment = React.memo(function Comment({ comment, onReply, onRefresh, depth = 0 }: CommentProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const isOwner = user?.id === comment.user_id;

  const formattedDate = useMemo(
    () => formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }),
    [comment.created_at]
  );

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onReply(comment.id, replyContent);
      setReplyContent("");
      setIsReplying(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    try {
      await updateComment(comment.id, editContent);
      setIsEditing(false);
      onRefresh();
      toast({ title: "Comment updated" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: error.message || "Failed to update comment. Please try again.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      try {
        await deleteComment(comment.id);
        onRefresh();
        toast({ title: "Comment deleted" });
      } catch (error) {
        console.error(error);
        toast({ title: "Failed to delete comment", variant: "destructive" });
      }
    }
  };

  return (
    <div className={`flex gap-3 ${depth > 0 ? "ml-8 border-l-2 pl-4 border-muted" : ""}`}>
      <div 
        className="cursor-pointer"
        onClick={() => setIsProfileOpen(true)}
      >
        <Avatar className="h-8 w-8 hover:ring-2 hover:ring-primary/50 transition-all">
          <AvatarImage src={comment.user?.avatar_url || ""} />
          <AvatarFallback>{comment.user?.full_name?.charAt(0) || "U"}</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-1">
        <div className="bg-muted/50 p-3 rounded-lg group relative">
          <div className="flex items-center justify-between mb-1">
            <span 
              className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsProfileOpen(true)}
            >
              {comment.user?.full_name || "Unknown User"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formattedDate}
                {comment.created_at !== comment.updated_at && (
                  <span className="ml-1 italic">(edited)</span>
                )}
              </span>
              {isOwner && !isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit className="mr-2 h-3 w-3" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                      <Trash2 className="mr-2 h-3 w-3" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          {isEditing ? (
            <div className="space-y-2">
              <Textarea 
                value={editContent} 
                onChange={(e) => setEditContent(e.target.value)} 
                className="min-h-[60px] bg-background"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleUpdate}>
                  <Check className="h-3 w-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2 mt-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsReplying(!isReplying)}
          >
            <Reply className="h-3 w-3 mr-1" /> Reply
          </Button>
        </div>

        {isReplying && (
          <div className="mt-2 space-y-2">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="min-h-[60px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsReplying(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmitReply} disabled={isSubmitting}>Reply</Button>
            </div>
          </div>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-4">
            {comment.replies.map((reply) => (
              <Comment key={reply.id} comment={reply} onReply={onReply} onRefresh={onRefresh} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>

      {/* User Profile Card Modal */}
      <UserProfileCard
        userId={comment.user_id}
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
      />
    </div>
  );
});
