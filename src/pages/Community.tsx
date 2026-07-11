import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeletonList } from "@/components/PostCardSkeleton";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { fetchPosts, toggleLikePost } from "@/lib/posts";
import { Post } from "@/types/posts";
import { MessageSquareText, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Community = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "We couldn't load the community feed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleLike = useCallback(async (postId: string, hasLiked: boolean) => {
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          has_liked: !hasLiked,
          likes_count: (p.likes_count || 0) + (hasLiked ? -1 : 1)
        };
      }
      return p;
    }));

    try {
      await toggleLikePost(postId, hasLiked);
    } catch (error) {
      console.error(error);
      // Revert on error
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            has_liked: hasLiked,
            likes_count: (p.likes_count || 0) + (hasLiked ? 1 : -1)
          };
        }
        return p;
      }));
      toast({
        title: "Error",
        description: "We couldn't update your like. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary">Community Feed</h1>
            <p className="text-muted-foreground">Join the conversation</p>
          </div>
          <CreatePostDialog onPostCreated={loadPosts} />
        </div>

        {isLoading ? (
          <PostCardSkeletonList count={3} />
        ) : posts.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <MessageSquareText className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Be the first to share something with the community! Start a discussion, ask a question, or create a poll.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span>Earn 10 points for each post you create</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onLike={handleLike} onUpdate={loadPosts} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Community;
