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
const MINIMUM_FIELDS = ["title", "resourceCategory", "details"] as const;

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;

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
  const completedFields = MINIMUM_FIELDS.filter(field => {
    if (field === "details") return hasText(form.link) || hasText(form.image) || hasText(form.description);
    return hasText(form[field]);
  });
  const completionPercentage = Math.round((completedFields.length / MINIMUM_FIELDS.length) * 100);

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

    const newErrors: Record<string, string> = {};
    if (!hasText(form.title)) {
      newErrors.title = "Title is required.";
    }
    if (!hasText(form.resourceCategory)) {
      newErrors.resourceCategory = "Resource category is required.";
    }
    if (!hasText(form.link) && !hasText(form.image) && !hasText(form.description)) {
      newErrors.details = "Add an access link, attachment/image, or short description so Team GPE has something to review.";
    }
    if (form.link) {
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
      summary: form.description ? form.description.slice(0, 120) : form.link || form.source || "Submitted for Team GPE review.",
      description: form.description || form.link || "Details to be completed during Team GPE review.",
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
    <Card className="gpe-paper overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <BookOpen className="h-5 w-5 text-green-500" />
              Resource Details
            </CardTitle>
            <CardDescription className="mt-1">
              Fill out the form below · Your draft is auto-saved
            </CardDescription>
          </div>
          <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-3 text-right shadow-gpe-sm">
            <div className="text-xs font-black uppercase text-black/60">{completionPercentage}% complete</div>
            <div className="mt-2 h-4 w-28 overflow-hidden rounded-full border-[3px] border-black bg-white">
              <div 
                className="h-full rounded-full bg-gpe-pink transition-all duration-300" 
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
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <FolderOpen className="h-4 w-4" />
              Basic Information
            </div>
            
            <div className="rounded-[1.5rem] border-[3px] border-black bg-white p-4">
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
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
              </div>
              <div>
                <Label htmlFor="source" className="text-sm">Source/Author</Label>
                <Input id="source" name="source" value={form.source} onChange={handleChange} placeholder="e.g. Environmental Institute" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Section: Resource Type & Access */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
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
                {errors.resourceCategory && <p className="text-red-500 text-xs mt-1">{errors.resourceCategory}</p>}
              </div>
              <div>
                <Label htmlFor="link" className="text-sm">Download/Access Link</Label>
                <Input id="link" name="link" type="url" value={form.link} onChange={handleChange} placeholder="https://resource.org/download" className="mt-1" />
                {errors.link && <p className="text-red-500 text-xs mt-1">{errors.link}</p>}
              </div>
            </div>
            {errors.details && <p className="text-red-500 text-xs mt-1">{errors.details}</p>}
          </div>

          {/* Section: Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <FileText className="h-4 w-4" />
              Description
            </div>
            
            <div>
              <Label htmlFor="description" className="text-sm">Resource Description</Label>
              <Textarea id="description" name="description" value={form.description} onChange={handleChange} rows={5} placeholder="Describe the resource, what it covers, and who would benefit from it..." className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">{form.description.length} characters</p>
            </div>
          </div>

          {/* Section: Additional Notes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
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
              disabled={isSubmitting}
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
