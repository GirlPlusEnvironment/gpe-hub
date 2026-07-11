import { useCallback, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { supabase, supabasePublicStorageUrl } from "@/lib/supabaseClient";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  bucket: string;
  onUploadComplete: (url: string) => void;
  currentImage?: string;
  folder?: string;
}

export function ImageUpload({ bucket, onUploadComplete, currentImage, folder }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const { toast } = useToast();

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file (JPG, PNG, GIF, etc.)",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (5MB max)
      const maxSizeMb = 5;
      if (file.size > maxSizeMb * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `Please choose an image smaller than ${maxSizeMb}MB.`,
          variant: "destructive",
        });
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      setUploading(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        
        if (!user) {
          toast({
            title: "Authentication required",
            description: "Please log in to upload images.",
            variant: "destructive",
          });
          setUploading(false);
          return;
        }

        const fileExt = file.name.split(".").pop() ?? "png";
        const timestamp = Date.now();
        const folderPath = folder || user.id;
        const filePath = `${folderPath}/${timestamp}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, { cacheControl: "3600", upsert: true });

        if (uploadError) {
          throw uploadError;
        }

        const publicUrl = `${supabasePublicStorageUrl}/${bucket}/${filePath}`;
        onUploadComplete(publicUrl);

        toast({
          title: "Image uploaded",
          description: "Your image has been successfully uploaded.",
        });
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Upload failed",
          description: "We couldn't upload your image. Please try again.",
          variant: "destructive",
        });
        setPreview(null);
      } finally {
        setUploading(false);
      }
    },
    [bucket, folder, onUploadComplete, toast]
  );

  const handleRemove = () => {
    setPreview(null);
    onUploadComplete("");
  };

  return (
    <div className="space-y-4">
      <div className="relative w-full h-48 border-2 border-dashed border-border rounded-lg overflow-hidden bg-muted/50">
        {preview ? (
          <>
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handleRemove}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <label className="flex flex-col items-center justify-center h-full cursor-pointer hover:bg-muted/70 transition-colors">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">
              {uploading ? "Uploading..." : "Click to upload image"}
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG or GIF (max 5MB)
            </p>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        )}
      </div>
      {!preview && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Choose Image"}
        </Button>
      )}
    </div>
  );
}
