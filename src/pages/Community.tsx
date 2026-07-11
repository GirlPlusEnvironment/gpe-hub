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
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="gpe-heading text-5xl md:text-7xl">GPE Community</h1>
            <p className="mt-3 text-lg font-bold text-black/70">Join the real conversation.</p>
          </div>
          <CreatePostDialog onPostCreated={loadPosts} />
        </div>

        {isLoading ? (
          <PostCardSkeletonList count={3} />
        ) : posts.length === 0 ? (
          <div className="gpe-card px-4 py-16 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-black bg-white">
              <MessageSquareText className="h-8 w-8 text-black" />
            </div>
            <h3 className="gpe-heading text-3xl">No posts yet</h3>
            <p className="mx-auto mb-6 mt-3 max-w-sm font-bold text-black/70">
              Be the first to share something with the community! Start a discussion, ask a question, or create a poll.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase text-black/60">
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
