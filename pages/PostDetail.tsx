import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PostCard } from "@/components/PostCard";
import { Comment } from "@/components/Comment";
import { fetchPostById, fetchComments, addComment, toggleLikePost } from "@/lib/posts";
import { Post, PostComment } from "@/types/posts";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader } from "@/components/camp/CampDesign";

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [postData, commentsData] = await Promise.all([
        fetchPostById(id),
        fetchComments(id)
      ]);
      setPost(postData);
      setComments(commentsData);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "We couldn't load this post. It might have been deleted.",
        variant: "destructive",
      });
      navigate("/community");
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLike = async (postId: string, hasLiked: boolean) => {
    if (!post) return;
    
    // Optimistic update
    setPost({
      ...post,
      has_liked: !hasLiked,
      likes_count: (post.likes_count || 0) + (hasLiked ? -1 : 1)
    });

    try {
      await toggleLikePost(postId, hasLiked);
    } catch (error) {
      console.error(error);
      // Revert
      setPost({
        ...post,
        has_liked: hasLiked,
        likes_count: (post.likes_count || 0) + (hasLiked ? 1 : -1)
      });
    }
  };

  const handleAddComment = async () => {
    if (!id || !newComment.trim()) return;
    setIsSubmitting(true);
    try {
      await addComment(id, newComment);
      setNewComment("");
      // Reload comments to get the new one in the right place (or append optimistically)
      const commentsData = await fetchComments(id);
      setComments(commentsData);
      
      // Update comment count
      if (post) {
        setPost({ ...post, comments_count: (post.comments_count || 0) + 1 });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "We couldn't post your comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    if (!id) return;
    try {
      await addComment(id, content, parentId);
      const commentsData = await fetchComments(id);
      setComments(commentsData);
      
      if (post) {
        setPost({ ...post, comments_count: (post.comments_count || 0) + 1 });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "We couldn't post your reply. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main max-w-5xl">
          <LoadingCampCard />
          <LoadingCampCard className="mt-6" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main max-w-5xl">
        <div className="mb-8">
          <CampButton variant="outline" onClick={() => navigate("/community")}>
            <ArrowLeft className="h-4 w-4" /> Back to Community
          </CampButton>
        </div>

        <PostCard 
          post={post} 
          onLike={handleLike} 
          onUpdate={loadData}
          onDelete={() => navigate("/community")}
        />

        <div className="mt-8">
          <SectionHeader
            kicker="Community thread"
            title={`Comments (${post.comments_count})`}
          />
          
          <div className="gpe-card gpe-paper mb-6 p-5">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="mb-4"
            />
            <div className="flex justify-end">
              <Button onClick={handleAddComment} disabled={isSubmitting || !newComment.trim()}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post Comment
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {comments.length === 0 ? (
              <EmptyState
                illustration="clipboard"
                title="No comments yet"
                description="Start the conversation with a note, question, or resource."
              />
            ) : (
              comments.map((comment) => (
                <Comment key={comment.id} comment={comment} onReply={handleReply} onRefresh={loadData} />
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PostDetail;
