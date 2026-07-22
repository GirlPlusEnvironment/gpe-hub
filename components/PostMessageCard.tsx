import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Post } from "@/types/posts";
import { fetchPostById } from "@/lib/posts";
import { Loader2, MessageSquare, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sticker } from "@/components/camp/CampDesign";

interface PostMessageCardProps {
  postId: string;
}

const PostMessageCard = ({ postId }: PostMessageCardProps) => {
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadPost = async () => {
      try {
        const data = await fetchPostById(postId);
        setPost(data);
      } catch (error) {
        console.error("Failed to load post preview", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (postId) {
      loadPost();
    }
  }, [postId]);

  if (isLoading) {
    return (
      <div className="flex h-32 w-full min-w-0 max-w-64 items-center justify-center rounded-[1.5rem] border-[3px] border-black bg-white p-4 shadow-gpe-sm">
        <Loader2 className="h-6 w-6 animate-spin text-gpe-pink" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="w-full min-w-0 max-w-64 rounded-[1.5rem] border-[3px] border-black bg-white p-4 shadow-gpe-sm">
        <p className="text-sm font-bold text-black/60">Post unavailable</p>
      </div>
    );
  }

  return (
    <article
      className="gpe-card-sm gpe-hover-lift w-full min-w-0 max-w-64 cursor-pointer overflow-hidden text-foreground"
      onClick={() => navigate(`/community/post/${post.id}`)}
    >
      {post.image_url && (
        <div className="h-32 w-full overflow-hidden">
          <img 
            src={post.image_url} 
            alt={post.title} 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-3 pb-0">
        <div className="mb-1 flex min-w-0 items-center gap-2">
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarImage src={post.user?.avatar_url || ""} />
            <AvatarFallback className="text-[10px]">
              {post.user?.full_name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {post.user?.full_name || "Unknown"}
          </span>
        </div>
        <h4 className="line-clamp-2 break-words text-sm font-black leading-tight">{post.title}</h4>
      </div>
      <div className="p-3 pt-1">
        <p className="mb-2 line-clamp-3 break-words text-xs font-bold text-black/60">
          {post.description}
        </p>
        <div className="flex items-center gap-3 text-xs font-black text-black/65">
          <div className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            <span>{post.likes_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>{post.comments_count || 0}</span>
          </div>
        </div>
        <Sticker accent="cyan" rotate="none" className="mt-3 px-2 py-1 text-[10px]">Community post</Sticker>
      </div>
    </article>
  );
};

export default PostMessageCard;
