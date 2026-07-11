import { useEffect, useState } from "react";
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

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, [id]);

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
        description: error.message || "We couldn't post your comment. Please try again.",
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
        <main className="gpe-page-main flex min-h-[70vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <Button variant="outline" className="mb-6 gap-2" onClick={() => navigate("/community")}>
          <ArrowLeft className="h-4 w-4" /> Back to Community
        </Button>

        <PostCard 
          post={post} 
          onLike={handleLike} 
          onUpdate={loadData}
          onDelete={() => navigate("/community")}
        />

        <div className="mt-8">
          <h3 className="gpe-heading mb-4 text-3xl">Comments ({post.comments_count})</h3>
          
          <div className="gpe-card p-4 mb-6">
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
            {comments.map((comment) => (
              <Comment key={comment.id} comment={comment} onReply={handleReply} onRefresh={loadData} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PostDetail;
