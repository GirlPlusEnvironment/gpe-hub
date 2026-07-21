import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { ImageUpload } from "@/components/ImageUpload";
import { useToast } from "@/hooks/use-toast";
import { validateListingContent } from "@/lib/listings";
import { BookOpen, FolderOpen, Link, FileText, CheckCircle2, Loader2, Info } from "lucide-react";

const resourceCategories = ["Toolkit", "Video", "Guide", "Handbook", "Technical Guide", "Database", "Other"];

const STORAGE_KEY = "resource-submission-draft";

export default function ResourceSubmissionForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load from localStorage on mount
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          title: "",
          description: "",
          image: "",
          source: "",
          resourceCategory: resourceCategories[0],
          link: "",
          notes: "",
        };
      }
    }
    return {
      title: "",
      description: "",
      image: "",
      source: "",
      resourceCategory: resourceCategories[0],
      link: "",
      notes: "",
    };
  });

  // Save to localStorage whenever form changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  // Calculate form completion percentage
  const requiredFields = ['title', 'source', 'resourceCategory', 'link', 'description'];
  const completedFields = requiredFields.filter(field => form[field] && form[field].toString().trim() !== '');
  const completionPercentage = Math.round((completedFields.length / requiredFields.length) * 100);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[e.target.name];
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate link
    const newErrors: Record<string, string> = {};
    if (!form.link) {
      newErrors.link = "Resource link is required.";
    } else {
      try {
        new URL(form.link);
      } catch {
        newErrors.link = "Please enter a valid URL (include https://).";
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      toast({
        title: "Sign in required",
        description: "You must be logged in to submit a resource.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
    
    const resourceData = {
      category: "resources",
      title: form.title,
      image_url: form.image,
      summary: form.description.slice(0, 120),
      description: form.description,
      tags: [],
      submitted_by: user.id,
      status: "pending_review",
      metadata: {
        source: form.source,
        resource_category: form.resourceCategory,
        resource_type: form.resourceCategory,
        topic: form.resourceCategory,
        link: form.link,
        download_url: form.link,
        notes: form.notes,
      },
    };
    
    // Validate content before inserting
    try {
      validateListingContent(resourceData);
    } catch (validationError: unknown) {
      toast({
        title: "Error",
        description: validationError instanceof Error ? validationError.message : "Your content contains inappropriate language. Please revise and try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
    
    const { data: insertData, error } = await supabase.from("listings").insert([resourceData]).select();
    if (error) {
      toast({
        title: "Error submitting resource",
        description: "We couldn't submit your resource. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    } else if (insertData && insertData.length > 0) {
      const newListingId = insertData[0].id;
      localStorage.removeItem(STORAGE_KEY);
      
      toast({
        title: "Resource submitted!",
        description: "Your resource is under Team GPE review.",
      });
      navigate(`/listing/${newListingId}`);
    }
  };

  const getEmptyForm = () => ({
    title: "",
    description: "",
    image: "",
    source: "",
    resourceCategory: "",
    link: "",
    notes: "",
  });

  const handleClearDraft = () => {
    if (confirm("Are you sure you want to clear this draft?")) {
      localStorage.removeItem(STORAGE_KEY);
      setForm(getEmptyForm());
      setErrors({});
      toast({
        title: "Draft cleared",
        description: "Your form has been reset.",
      });
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-green-500" />
              Resource Details
            </CardTitle>
            <CardDescription className="mt-1">
              Fill out the form below · Your draft is auto-saved
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-muted-foreground">{completionPercentage}% complete</div>
            <div className="w-24 h-2 bg-muted rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 rounded-full" 
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section: Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
              <FolderOpen className="h-4 w-4" />
              Basic Information
            </div>
            
            <div className="bg-muted/30 rounded-lg p-4">
              <Label className="text-sm font-medium">Resource Thumbnail (Optional)</Label>
              <p className="text-xs text-muted-foreground mb-3">Upload a cover image or screenshot</p>
              <ImageUpload
                bucket="event-images"
                folder="resources"
                currentImage={form.image}
                onUploadComplete={(url) => setForm({ ...form, image: url })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title" className="text-sm">Resource Title <span className="text-red-500">*</span></Label>
                <Input id="title" name="title" value={form.title} onChange={handleChange} required placeholder="e.g. Climate Action Toolkit" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="source" className="text-sm">Source/Author <span className="text-red-500">*</span></Label>
                <Input id="source" name="source" value={form.source} onChange={handleChange} required placeholder="e.g. Environmental Institute" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Section: Resource Type & Access */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
              <Link className="h-4 w-4" />
              Resource Type & Access
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="resourceCategory" className="text-sm">Resource Category <span className="text-red-500">*</span></Label>
                <select id="resourceCategory" name="resourceCategory" value={form.resourceCategory} onChange={handleChange} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                  <option value="">Select category...</option>
                  {resourceCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="link" className="text-sm">Download/Access Link <span className="text-red-500">*</span></Label>
                <Input id="link" name="link" type="url" value={form.link} onChange={handleChange} required placeholder="https://resource.org/download" className="mt-1" />
                {errors.link && <p className="text-red-500 text-xs mt-1">{errors.link}</p>}
              </div>
            </div>
          </div>

          {/* Section: Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
              <FileText className="h-4 w-4" />
              Description
            </div>
            
            <div>
              <Label htmlFor="description" className="text-sm">Resource Description <span className="text-red-500">*</span></Label>
              <Textarea id="description" name="description" value={form.description} onChange={handleChange} required rows={5} placeholder="Describe the resource, what it covers, and who would benefit from it..." className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">{form.description.length} characters</p>
            </div>
          </div>

          {/* Section: Additional Notes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
              <Info className="h-4 w-4" />
              Additional Information
            </div>
            
            <div>
              <Label htmlFor="notes" className="text-sm">Additional Notes</Label>
              <Textarea id="notes" name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Any additional information, requirements, or usage guidelines..." className="mt-1" />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button 
              type="submit" 
              className="flex-1 gap-2" 
              size="lg"
              disabled={isSubmitting || completionPercentage < 100}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Resource
                </>
              )}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={handleClearDraft}>
              Clear Draft
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
