import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Camera, Trophy, Calendar, ArrowLeft, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, supabasePublicStorageUrl } from "@/lib/supabaseClient";
import { validateContent } from "@/lib/profanityFilter";
import { format } from "date-fns";

type ProfileFormState = {
  full_name: string;
  username: string;
  bio: string;
  avatar_url: string;
};

const INITIAL_STATE: ProfileFormState = {
  full_name: "",
  username: "",
  bio: "",
  avatar_url: "",
};

const LEVELS = [
  { level: 1, threshold: 0, name: "Newcomer", color: "bg-gray-200 text-gray-700" },
  { level: 2, threshold: 100, name: "Contributor", color: "bg-blue-200 text-blue-700" },
  { level: 3, threshold: 500, name: "Active Member", color: "bg-green-200 text-green-700" },
  { level: 4, threshold: 1000, name: "Champion", color: "bg-purple-200 text-purple-700" },
  { level: 5, threshold: 2000, name: "Legend", color: "bg-amber-300 text-amber-800" },
];

function calculateLevel(points: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].threshold) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

const Profile = () => {
  const { user, profile, refreshProfile, loading } = useAuth();
  const { toast } = useToast();

  const [formState, setFormState] = useState<ProfileFormState>(INITIAL_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarKey, setAvatarKey] = useState(0); // Force re-render key
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) {
      setFormState(INITIAL_STATE);
      setAvatarKey(0);
      return;
    }

    const newAvatarUrl = profile?.avatar_url ??
      ((user.user_metadata?.avatar_url as string | undefined) ?? "");
    
    console.log('Setting avatar URL:', newAvatarUrl);

    setFormState({
      full_name:
        profile?.full_name ??
        (user.user_metadata?.full_name as string | undefined) ??
        user.email ??
        "",
      username: profile?.username ?? "",
      bio: profile?.bio ?? "",
      avatar_url: newAvatarUrl,
    });
  }, [profile, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    setIsSaving(true);
    // Validate profile content before saving
    try {
      if (formState.full_name.trim()) {
        validateContent(formState.full_name);
      }
      if (formState.username.trim()) {
        validateContent(formState.username);
      }
      if (formState.bio.trim()) {
        validateContent(formState.bio);
      }
    } catch (validationError: any) {
      toast({
        title: "Error",
        description: validationError.message || "Your profile contains inappropriate language. Please revise and try again.",
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          full_name: formState.full_name,
          username: formState.username,
          bio: formState.bio,
          avatar_url: formState.avatar_url || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (error) {
      // Check for duplicate username error
      if (error.code === '23505' && error.message.includes('username')) {
        toast({
          title: "Username already taken",
          description: "That username is already in use. Please choose a different one.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Could not save profile",
          description: "We couldn't save your profile changes. Please try again.",
          variant: "destructive",
        });
      }
      setIsSaving(false);
      return;
    }

    await refreshProfile();

    toast({
      title: "Profile updated",
      description: "Your information is now saved.",
    });

    setIsSaving(false);
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !user) {
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG, PNG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    const maxSizeMb = 5;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `Please choose an image smaller than ${maxSizeMb}MB.`,
        variant: "destructive",
      });
      return;
    }

    // Create preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);

    const fileExt = file.name.split(".").pop() ?? "png";
    const timestamp = Date.now();
    const filePath = `${user.id}/${timestamp}.${fileExt}`;

    console.log('Uploading to:', filePath);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast({
        title: "Upload failed",
        description: "We couldn't upload your photo. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
      setPreviewUrl(null);
      return;
    }

    console.log('Upload successful:', uploadData);

    // Get the public URL (without query params first)
    const publicUrl = `${supabasePublicStorageUrl}/avatars/${filePath}`;
    console.log('Public URL:', publicUrl);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      toast({
        title: "Could not update profile photo",
        description: "We couldn't update your profile photo. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
      setPreviewUrl(null);
      return;
    }

    console.log('Profile updated successfully');

    // Update local state with cache buster
    const urlWithCacheBuster = `${publicUrl}?t=${timestamp}`;
    setFormState((previous) => ({ ...previous, avatar_url: urlWithCacheBuster }));
    
    // Force avatar to re-render
    setAvatarKey(prev => prev + 1);
    
    // Refresh profile from database
    await refreshProfile();

    toast({
      title: "Photo updated",
      description: "Looking good!",
    });

    setIsUploading(false);
    // Keep preview for a moment to ensure smooth transition
    setTimeout(() => setPreviewUrl(null), 500);
  };

  const avatarInitial =
    formState.full_name?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    "Y";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">You need to sign in to view this page.</p>
          <Link to="/login">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Link */}
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Left Column - Profile Preview */}
            <div className="md:col-span-1">
              <Card className="border-2 sticky top-24">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    {/* Avatar with Upload */}
                    <div className="relative group mb-4">
                      <Avatar key={avatarKey} className="h-28 w-28 ring-4 ring-primary/20">
                        <AvatarImage 
                          src={previewUrl || formState.avatar_url} 
                          alt={formState.full_name}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-3xl">
                          {avatarInitial}
                        </AvatarFallback>
                      </Avatar>
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                          <Loader2 className="h-8 w-8 text-white animate-spin" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        disabled={isUploading}
                      />
                    </div>

                    {/* Name Preview */}
                    <h2 className="text-xl font-bold">
                      {formState.full_name || "Your Name"}
                    </h2>
                    {formState.username && (
                      <p className="text-sm text-muted-foreground">@{formState.username}</p>
                    )}

                    {/* Level Badge */}
                    <Badge className={`mt-3 ${calculateLevel(profile?.points || 0).color}`}>
                      <Trophy className="h-3 w-3 mr-1" />
                      {calculateLevel(profile?.points || 0).name}
                    </Badge>

                    {/* Stats */}
                    <div className="w-full mt-6 pt-6 border-t space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Points</span>
                        <span className="font-semibold text-primary">{profile?.points || 0}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Member since</span>
                        <span className="font-medium">
                          {profile?.created_at 
                            ? format(new Date(profile.created_at), "MMM yyyy")
                            : "—"
                          }
                        </span>
                      </div>
                    </div>

                    {/* Photo Upload Hint */}
                    <p className="text-xs text-muted-foreground mt-4">
                      Click the camera icon to update your photo
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Edit Form */}
            <div className="md:col-span-2">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">Edit Profile</CardTitle>
                  <CardDescription>
                    Update your information to help others in the community know you better.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                          id="full_name"
                          value={formState.full_name}
                          onChange={(event) =>
                            setFormState((previous) => ({ ...previous, full_name: event.target.value }))
                          }
                          placeholder="Enter your full name"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={formState.username}
                          onChange={(event) =>
                            setFormState((previous) => ({ ...previous, username: event.target.value }))
                          }
                          placeholder="Choose a username"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={user.email ?? ""} disabled className="bg-muted" />
                      <p className="text-xs text-muted-foreground">
                        Your email is linked to your account and cannot be changed here.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={formState.bio}
                        onChange={(event) =>
                          setFormState((previous) => ({ ...previous, bio: event.target.value }))
                        }
                        placeholder="Tell the community about yourself, your work, and interests..."
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formState.bio.length}/500 characters
                      </p>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                      <Button 
                        type="submit" 
                        className="gap-2" 
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;

