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
import { awardPoints } from "@/lib/points";
import { validateListingContent } from "@/lib/listings";
import { DollarSign, Building, Calendar, Link, FileText, CheckCircle2, Loader2, Info } from "lucide-react";

const fundingTypes = ["Grant", "Scholarship", "Fellowship", "Award", "Other"];

const STORAGE_KEY = "funding-submission-draft";

export default function FundingSubmissionForm() {
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
          source: "",
          image: "",
          description: "",
          fundingType: fundingTypes[0],
          amount: "",
          deadline: "",
          link: "",
          contactEmail: "",
          notes: "",
        };
      }
    }
    return {
      title: "",
      source: "",
      image: "",
      description: "",
      fundingType: fundingTypes[0],
      amount: "",
      deadline: "",
      link: "",
      contactEmail: "",
      notes: "",
    };
  });

  // Save to localStorage whenever form changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  // Calculate form completion percentage
  const requiredFields = ['title', 'fundingType', 'link', 'description'];
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
    
    // Prevent past deadline
    if (form.deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(form.deadline);
      if (deadlineDate < today) {
        toast({
          title: "Invalid deadline",
          description: "Deadline cannot be in the past.",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate link
    const newErrors: Record<string, string> = {};
    if (!form.link) {
      newErrors.link = "Application link is required.";
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
        description: "You must be logged in to submit a funding opportunity.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
    
    const fundingData = {
      category: "fundraisers",
      title: form.title,
      summary: form.description.slice(0, 120),
      description: form.description,
      image_url: form.image,
      tags: [],
      submitted_by: user.id,
      status: "published",
      metadata: {
        organizer: form.source,
        source: form.source,
        funding_type: form.fundingType,
        amount: form.amount,
        goal_amount: form.amount,
        current_amount: "0",
        deadline: form.deadline,
        link: form.link,
        donation_url: form.link,
        contact_email: form.contactEmail,
        notes: form.notes,
      },
    };
    
    // Validate content before inserting
    try {
      validateListingContent(fundingData);
    } catch (validationError: any) {
      toast({
        title: "Error",
        description: validationError.message || "Your content contains inappropriate language. Please revise and try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
    
    const { data: insertData, error } = await supabase.from("listings").insert([fundingData]).select();
    if (error) {
      toast({
        title: "Error submitting funding opportunity",
        description: "We couldn't submit your funding opportunity. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    } else if (insertData && insertData.length > 0) {
      const newListingId = insertData[0].id;
      localStorage.removeItem(STORAGE_KEY);
      
      try {
        await awardPoints(user.id, 3);
      } catch (pointsError) {
        console.error("Failed to award points for listing submission", pointsError);
      }
      
      toast({
        title: "Funding opportunity posted!",
        description: "Your funding opportunity has been successfully submitted.",
      });
      navigate(`/listing/${newListingId}`);
    }
  };

  const getEmptyForm = () => ({
    title: "",
    source: "",
    image: "",
    description: "",
    fundingType: "",
    amount: "",
    deadline: "",
    link: "",
    contactEmail: "",
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
              <DollarSign className="h-5 w-5 text-green-500" />
              Funding Opportunity Details
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
              <Building className="h-4 w-4" />
              Basic Information
            </div>
            
            <div className="bg-muted/30 rounded-lg p-4">
              <Label className="text-sm font-medium">Organization Logo (Optional)</Label>
              <p className="text-xs text-muted-foreground mb-3">Upload an organization logo or relevant image</p>
              <ImageUpload
                bucket="event-images"
                folder="funding"
                currentImage={form.image}
                onUploadComplete={(url) => setForm({ ...form, image: url })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title" className="text-sm">Funding Title <span className="text-red-500">*</span></Label>
                <Input id="title" name="title" value={form.title} onChange={handleChange} required placeholder="e.g. Environmental Research Grant 2025" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="source" className="text-sm">Source/Organization</Label>
                <Input id="source" name="source" value={form.source} onChange={handleChange} placeholder="e.g. National Science Foundation" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Section: Funding Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
              <DollarSign className="h-4 w-4" />
              Funding Details
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="fundingType" className="text-sm">Funding Type <span className="text-red-500">*</span></Label>
                <select id="fundingType" name="fundingType" value={form.fundingType} onChange={handleChange} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                  <option value="">Select funding type...</option>
                  {fundingTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="amount" className="text-sm">Funding Amount</Label>
                <Input id="amount" name="amount" value={form.amount} onChange={handleChange} placeholder="e.g. $50,000" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="deadline" className="text-sm">Application Deadline</Label>
                <Input id="deadline" name="deadline" type="date" value={form.deadline} onChange={handleChange} min={new Date().toISOString().split('T')[0]} className="mt-1" />
              </div>
            </div>
          </div>

          {/* Section: Application Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
              <Link className="h-4 w-4" />
              Application Information
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="link" className="text-sm">Application/Info Link <span className="text-red-500">*</span></Label>
                <Input id="link" name="link" type="url" value={form.link} onChange={handleChange} placeholder="https://foundation.org/apply" required className="mt-1" />
                {errors.link && <p className="text-red-500 text-xs mt-1">{errors.link}</p>}
              </div>
              <div>
                <Label htmlFor="contactEmail" className="text-sm">Contact Email</Label>
                <Input id="contactEmail" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} placeholder="grants@organization.org" className="mt-1" />
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
              <Label htmlFor="description" className="text-sm">Funding Description <span className="text-red-500">*</span></Label>
              <Textarea id="description" name="description" value={form.description} onChange={handleChange} required rows={5} placeholder="Describe the funding opportunity, eligibility criteria, and how to apply..." className="mt-1" />
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
              <Textarea id="notes" name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Any additional information or requirements..." className="mt-1" />
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
                  Submit Funding Opportunity
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
