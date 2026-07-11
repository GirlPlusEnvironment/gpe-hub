import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updatePost } from "@/lib/posts";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { Post } from "@/types/posts";
import { ImageUpload } from "@/components/ImageUpload";

interface EditPostDialogProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostUpdated: () => void;
}

interface EditPostForm {
  title: string;
  description: string;
}

export function EditPostDialog({ post, open, onOpenChange, onPostUpdated }: EditPostDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>(post.image_url || undefined);
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<EditPostForm>({
    defaultValues: {
      title: post.title,
      description: post.description,
    }
  });

  const isPoll = post.type === 'poll';

  const onSubmit = async (data: EditPostForm) => {
    setIsLoading(true);
    try {
      // For polls, only update the title
      const updateData = isPoll 
        ? { title: data.title }
        : { ...data, image_url: imageUrl };
      
      await updatePost(post.id, updateData);
      toast({
        title: "Success",
        description: isPoll ? "Poll title updated successfully." : "Post updated successfully.",
      });
      onPostUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to update post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isPoll ? "Edit Poll" : "Edit Post"}</DialogTitle>
          {isPoll && (
            <DialogDescription>
              Only the poll title can be edited. Poll options and votes cannot be changed.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder={isPoll ? "Poll question" : "Post title"}
              {...register("title", { required: "Title is required" })}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>
          
          {/* Only show description and image for non-poll posts */}
          {!isPoll && (
            <>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What's on your mind?"
                  className="min-h-[100px]"
                  {...register("description", { required: "Description is required" })}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Image (Optional)</Label>
                <ImageUpload
                  bucket="post-images"
                  folder="posts"
                  onUploadComplete={(url) => setImageUrl(url)}
                  currentImage={imageUrl}
                />
              </div>
            </>
          )}

          {/* Info message for polls */}
          {isPoll && (
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Poll options cannot be modified after creation to preserve vote integrity.</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
