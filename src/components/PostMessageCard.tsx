import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Post } from "@/types/posts";
import { fetchPostById } from "@/lib/posts";
import { Loader2, MessageSquare, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
      <div className="flex items-center justify-center p-4 bg-background/50 rounded-lg border border-border w-64 h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-4 bg-background/50 rounded-lg border border-border w-64">
        <p className="text-sm text-muted-foreground">Post unavailable</p>
      </div>
    );
  }

  return (
    <Card 
      className="w-64 cursor-pointer hover:shadow-md transition-shadow overflow-hidden bg-background text-foreground"
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
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <Avatar className="h-5 w-5">
            <AvatarImage src={post.user?.avatar_url || ""} />
            <AvatarFallback className="text-[10px]">
              {post.user?.full_name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {post.user?.full_name || "Unknown"}
          </span>
        </div>
        <h4 className="font-semibold text-sm line-clamp-1">{post.title}</h4>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {post.description}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            <span>{post.likes_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>{post.comments_count || 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostMessageCard;
