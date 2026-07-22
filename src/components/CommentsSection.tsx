import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchCommentsByListingId,
  addComment,
  type Comment,
} from "@/lib/comments";
import { CampButton, EmptyState, LoadingCampCard } from "@/components/camp/CampDesign";

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
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "We couldn't post your comment. Please try again.",
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
    <Card className="gpe-paper mt-6">
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
            <CampButton
              type="submit"
              disabled={mutation.isPending || !newComment.trim()}
            >
              {mutation.isPending ? "Posting..." : "Post Comment"}
            </CampButton>
          </div>
        </form>

        <div className="space-y-3 border-t-[3px] border-black pt-4">
          {isLoading && (
            <LoadingCampCard label="Loading comments" />
          )}

          {isError && (
            <EmptyState
              illustration="clipboard"
              title="Comments paused"
              description="We could not load the discussion right now. Please try again later."
            />
          )}

          {!isLoading && comments.length === 0 && !isError && (
            <EmptyState
              illustration="megaphone"
              title="No comments yet"
              description="Be the first to start a helpful conversation about this listing."
            />
          )}

          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 rounded-[1.25rem] border-[3px] border-black bg-white p-3">
              <Avatar className="h-9 w-9 border-[2px] border-black">
                <AvatarFallback className="bg-gpe-cyan text-xs font-black text-black">
                  U
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black">Community member</p>
                  <p className="text-xs font-bold text-black/50">
                    {new Date(comment.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-black/65">
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
