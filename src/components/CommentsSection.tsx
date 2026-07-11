import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchCommentsByListingId,
  addComment,
  type Comment,
} from "@/lib/comments";

type CommentsSectionProps = {
  listingId: string;
};

export const CommentsSection = ({ listingId }: CommentsSectionProps) => {
  const [newComment, setNewComment] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: comments = [],
    isLoading,
    isError,
  } = useQuery<Comment[]>({
    queryKey: ["comments", listingId],
    queryFn: () => fetchCommentsByListingId(listingId),
  });

  const mutation = useMutation({
    mutationFn: (content: string) => addComment(listingId, content),
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["comments", listingId] });
      toast({
        title: "Comment posted",
        description: "Your comment has been added.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "We couldn't post your comment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    mutation.mutate(newComment.trim());
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <CardTitle>Discussion</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            placeholder="Share your thoughts, questions, or tips about this listing..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={mutation.isPending || !newComment.trim()}
            >
              {mutation.isPending ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </form>

        <div className="border-t pt-4 space-y-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground">
              Loading comments...
            </p>
          )}

          {isError && (
            <p className="text-sm text-red-500">
              We couldn&apos;t load the comments. Please try again later.
            </p>
          )}

          {!isLoading && comments.length === 0 && !isError && (
            <p className="text-sm text-muted-foreground">
              No comments yet. Be the first to start a conversation!
            </p>
          )}

          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  U
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Community member</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
