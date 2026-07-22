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
import { EmptyState, SectionHeader, Sticker } from "@/components/camp/CampDesign";

const Community = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadPosts = useCallback(async () => {
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
  }, [toast]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

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
        <SectionHeader
          className="mb-8"
          eyebrow={<Sticker accent="pink"><MessageSquareText className="mr-2 h-4 w-4" /> Community</Sticker>}
          title="GPE Community"
          description="Join the real conversation, share updates, ask questions, and earn Hub XP for thoughtful participation."
          action={<CreatePostDialog onPostCreated={loadPosts} />}
        />

        {isLoading ? (
          <PostCardSkeletonList count={3} />
        ) : posts.length === 0 ? (
          <EmptyState
            illustration="megaphone"
            title="No Posts Yet"
            description="Be the first to share something with the community. Start a discussion, ask a question, or create a poll."
            action={
            <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase text-black/60">
              <Sparkles className="h-4 w-4" />
              <span>Earn 10 points for each post you create</span>
            </div>
            }
          />
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
