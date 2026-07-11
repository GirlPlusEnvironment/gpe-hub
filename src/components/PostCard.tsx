import React, { useMemo } from "react";
import { Post } from "@/types/posts";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquare, Heart, MoreVertical, Edit, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ShareDialog } from "@/components/ShareDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { deletePost } from "@/lib/posts";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { EditPostDialog } from "./EditPostDialog";
import { UserProfileCard } from "./UserProfileCard";

import { PollView } from "./PollView";

interface PostCardProps {
  post: Post;
  onLike: (postId: string, hasLiked: boolean) => void;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export const PostCard = React.memo(function PostCard({ post, onLike, onUpdate, onDelete }: PostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = user?.id === post.user_id;

  const formattedDate = useMemo(
    () => formatDistanceToNow(new Date(post.created_at), { addSuffix: true }),
    [post.created_at]
  );

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePost(post.id);
      toast({
        title: "Post deleted",
        description: "Your post has been successfully deleted.",
      });
      setIsDeleteDialogOpen(false);
      if (onDelete) {
        onDelete();
      } else {
        onUpdate?.();
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "We couldn't delete your post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TooltipProvider>
      <Card className="w-full mb-4 hover:shadow-lg transition-all duration-200 cursor-pointer group" onClick={() => navigate(`/community/post/${post.id}`)}>
        <CardHeader className="flex flex-row items-center gap-4 pb-2 relative">
          <div 
            onClick={(e) => {
              e.stopPropagation();
              setIsProfileOpen(true);
            }}
            className="cursor-pointer"
          >
            <Avatar className="hover:ring-2 hover:ring-primary/50 transition-all">
              <AvatarImage src={post.user?.avatar_url || ""} />
              <AvatarFallback>{post.user?.full_name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex flex-col flex-1">
            <span 
              className="font-semibold text-sm hover:text-primary cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsProfileOpen(true);
              }}
            >
              {post.user?.full_name || "Unknown User"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formattedDate}
              {post.created_at !== post.updated_at && (
                <span className="ml-1 italic">(edited)</span>
              )}
            </span>
          </div>
          {isOwner && (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-red-600 focus:text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </CardHeader>
        <CardContent className="pb-2">
        <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{post.title}</h3>
        <p className="text-muted-foreground line-clamp-3">{post.description}</p>
        {post.type === 'poll' && (
          <div onClick={(e) => e.stopPropagation()}>
            <PollView post={post} onVote={() => onUpdate?.()} />
          </div>
        )}
        {post.image_url && (
          <div className="mt-4 rounded-lg overflow-hidden max-h-96 ring-1 ring-border">
            <img src={post.image_url} alt={post.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2 flex justify-between text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`gap-2 transition-all ${post.has_liked ? "text-red-500 hover:text-red-600" : "hover:text-red-500"}`}
              onClick={(e) => {
                e.stopPropagation();
                onLike(post.id, !!post.has_liked);
              }}
            >
              <Heart className={`h-4 w-4 transition-transform ${post.has_liked ? "fill-current scale-110" : "hover:scale-110"}`} />
              {post.likes_count}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{post.has_liked ? "Unlike" : "Like"}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 hover:text-primary transition-colors">
              <MessageSquare className="h-4 w-4" />
              {post.comments_count}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{post.comments_count === 1 ? "1 Comment" : `${post.comments_count} Comments`}</p>
          </TooltipContent>
        </Tooltip>
        <div onClick={(e) => e.stopPropagation()}>
          <ShareDialog postId={post.id} />
        </div>
      </CardFooter>
    </Card>
    <EditPostDialog 
      post={post} 
      open={isEditOpen} 
      onOpenChange={setIsEditOpen} 
      onPostUpdated={() => onUpdate?.()} 
    />
    <UserProfileCard
      userId={post.user_id}
      open={isProfileOpen}
      onOpenChange={setIsProfileOpen}
    />
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your post and remove all associated comments and likes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </TooltipProvider>
  );
});
