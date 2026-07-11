import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPost } from "@/lib/posts";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";

interface CreatePostDialogProps {
  onPostCreated: () => void;
}

interface CreatePostForm {
  title: string;
  description: string;
}

export function CreatePostDialog({ onPostCreated }: CreatePostDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [postType, setPostType] = useState<'text' | 'poll'>('text');
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreatePostForm>();
  const { toast } = useToast();

  const handleAddOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (pollOptions.length > 2) {
      const newOptions = [...pollOptions];
      newOptions.splice(index, 1);
      setPollOptions(newOptions);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const onSubmit = async (data: CreatePostForm) => {
    if (postType === 'poll') {
      // Validate poll options
      const validOptions = pollOptions.filter(opt => opt.trim() !== "");
      if (validOptions.length < 2) {
        toast({
          title: "Invalid Poll",
          description: "Please provide at least two options for your poll.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      await createPost({
        ...data,
        image_url: imageUrl,
        type: postType,
        poll_options: postType === 'poll' ? pollOptions.filter(opt => opt.trim() !== "") : undefined
      });
      toast({
        title: "Success",
        description: "Post created successfully!",
      });
      reset();
      setImageUrl(undefined);
      setPollOptions(["", ""]);
      setPostType('text');
      setIsOpen(false);
      onPostCreated();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to create post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Create Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create a New Post</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="text" value={postType} onValueChange={(v) => setPostType(v as 'text' | 'poll')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="text">Regular Post</TabsTrigger>
            <TabsTrigger value="poll">Poll</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{postType === 'poll' ? 'Question' : 'Title'}</Label>
              <Input
                id="title"
                placeholder={postType === 'poll' ? "Ask a question..." : "What's on your mind?"}
                {...register("title", { required: "Title is required" })}
              />
              {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description {postType === 'poll' && <span className="text-muted-foreground font-normal">(Optional)</span>}</Label>
              <Textarea
                id="description"
                placeholder={postType === 'poll' ? "Add context to your poll (optional)..." : "Share more details..."}
                className="min-h-[100px]"
                {...register("description", { required: postType === 'text' ? "Description is required" : false })}
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
            </div>

            <TabsContent value="text" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Label>Image (Optional)</Label>
                <ImageUpload
                  bucket="post-images"
                  folder="posts"
                  onUploadComplete={(url) => setImageUrl(url)}
                  currentImage={imageUrl}
                />
              </div>
            </TabsContent>

            <TabsContent value="poll" className="mt-0 space-y-4">
              <div className="space-y-3">
                <Label>Poll Options</Label>
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                    />
                    {pollOptions.length > 2 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 5 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddOption}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Option
                  </Button>
                )}
              </div>
            </TabsContent>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post
            </Button>
          </div>
        </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
