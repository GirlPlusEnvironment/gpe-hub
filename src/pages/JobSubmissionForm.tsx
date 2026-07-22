import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageUpload } from "@/components/ImageUpload";
import { useToast } from "@/hooks/use-toast";
import { validateListingContent } from "@/lib/listings";
import { Building, MapPin, Briefcase, DollarSign, Clock, Mail, Link, FileText, CheckCircle2, Loader2 } from "lucide-react";

const experienceLevels = ["Entry-level", "Mid-level", "Senior"];
const salaryRanges = ["<$30,000", "$30,000 - $50,000", "$50,000 - $75,000", "$75,000 - $100,000", "$100,000 - $150,000", "$150,000+", "Negotiable"];
const usStates = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "Other"];
const workArrangements = ["In-person", "Remote", "Freelance", "Full-time", "Part-time", "Internship"];
const industries = ["Academia", "Agriculture", "Clean Energy", "Education", "Environmental/Climate Justice", "For-profit", "Health", "Nonprofit", "Other", "Outdoor/Nature-based", "Sustainability", "Tech"];

const STORAGE_KEY = "job-submission-draft";

export default function JobSubmissionForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
          company: "",
          image: "",
          state: "",
          workArrangements: [],
          industry: "",
          experienceLevel: experienceLevels[0],
          salary: salaryRanges[0],
          requirements: "",
          applicationDeadline: "",
          contactEmail: "",
          applicationUrl: "",
          description: "",
        };
      }
    }
    return {
      title: "",
      company: "",
      image: "",
      state: "",
      workArrangements: [],
      industry: "",
      experienceLevel: experienceLevels[0],
      salary: salaryRanges[0],
      requirements: "",
      applicationDeadline: "",
      contactEmail: "",
      applicationUrl: "",
      description: "",
    };
  });

  // Save to localStorage whenever form changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[e.target.name];
      return copy;
    });
  };

  const handleWorkArrangementsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setForm(prev => ({
      ...prev,
      workArrangements: checked
        ? [...(Array.isArray(prev.workArrangements) ? prev.workArrangements : []), value]
        : (Array.isArray(prev.workArrangements) ? prev.workArrangements : []).filter(arr => arr !== value)
    }));
    setErrors(prev => {
      const copy = { ...prev };
      delete copy.workArrangements;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Validate required fields and show inline errors
    const newErrors: Record<string, string> = {};

    // applicationDeadline: required + valid + not in past
    if (!form.applicationDeadline) {
      newErrors.applicationDeadline = "Application deadline is required.";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(form.applicationDeadline);
      if (isNaN(deadlineDate.getTime())) {
        newErrors.applicationDeadline = "Invalid application deadline.";
      } else if (deadlineDate < today) {
        newErrors.applicationDeadline = "Application deadline cannot be in the past.";
      }
    }

    // applicationUrl: required + valid URL
    if (!form.applicationUrl) {
      newErrors.applicationUrl = "Application URL is required.";
    } else {
      try {
        new URL(form.applicationUrl);
      } catch {
        newErrors.applicationUrl = "Please enter a valid application URL (include https://).";
      }
    }

    // If any errors, set them and bail out
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }
    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      toast({ title: "You must be logged in", description: "You must be logged in to submit a job." });
      setIsSubmitting(false);
      return;
    }

    // Prepare data for Supabase
    const jobData = {
      category: "jobs",
      title: form.title,
      summary: form.description.slice(0, 120),
      description: form.description,
      image_url: form.image,
      location: form.state,
      tags: [],
      status: "pending_review",
      submitted_by: user.id,
      metadata: {
        location: form.state,
        job_type: Array.isArray(form.workArrangements) && form.workArrangements.length > 0
          ? form.workArrangements[0]
          : "Full-time",
        salary: form.salary,
        company: form.company,
        state: form.state,
        work_arrangements: form.workArrangements,
        industry: form.industry,
        requirements: form.requirements
          ? form.requirements.split(",").map((r) => r.trim()).filter(Boolean)
          : [],
        contact_email: form.contactEmail,
        application_url: form.applicationUrl,
        experience_level: form.experienceLevel,
        application_deadline: form.applicationDeadline,
      },
    };

    // Validate content before inserting
    try {
      validateListingContent(jobData);
    } catch (validationError: unknown) {
      toast({
        title: "Error",
        description: validationError instanceof Error ? validationError.message : "Your content contains inappropriate language. Please revise and try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase.from("listings").insert([jobData]).select();
    if (error) {
      toast({ title: "Error submitting job", description: "We couldn't submit your job listing. Please try again." });
      setIsSubmitting(false);
    } else if (data && data.length > 0) {
      const newListingId = data[0].id;
      // Clear the draft after successful submission
      localStorage.removeItem(STORAGE_KEY);
      setErrors({});
      
      toast({
        title: "Job submitted!",
        description: "Your job listing is under Team GPE review.",
      });
      navigate(`/listing/${newListingId}`);
    }
  };

  const getEmptyForm = () => ({
    title: "",
    company: "",
    image: "",
    state: "",
    workArrangements: [],
    industry: "",
    experienceLevel: "",
    salary: "",
    requirements: "",
    applicationDeadline: "",
    contactEmail: "",
    applicationUrl: "",
    description: "",
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate form completion percentage
  const requiredFields = ['title', 'company', 'state', 'industry', 'salary', 'applicationDeadline', 'contactEmail', 'applicationUrl', 'description'];
  const completedFields = requiredFields.filter(field => {
    if (field === 'workArrangements') return Array.isArray(form.workArrangements) && form.workArrangements.length > 0;
    return form[field] && form[field].toString().trim() !== '';
  });
  const completionPercentage = Math.round((completedFields.length / requiredFields.length) * 100);

  return (
    <Card className="gpe-paper overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Briefcase className="h-5 w-5 text-blue-500" />
              Job Listing Details
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
        <form onSubmit={async (e) => {
          e.preventDefault();
          setIsSubmitting(true);
          await handleSubmit(e);
          setIsSubmitting(false);
        }} className="space-y-8">
          
          {/* Section: Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <Building className="h-4 w-4" />
              Basic Information
            </div>
            
            {/* Image Upload */}
            <div className="rounded-[1.5rem] border-[3px] border-black bg-white p-4">
              <Label className="text-sm font-medium">Company Logo (Optional)</Label>
              <p className="text-xs text-muted-foreground mb-3">A logo helps your listing stand out</p>
              <ImageUpload
                bucket="event-images"
                folder="jobs"
                currentImage={form.image}
                onUploadComplete={(url) => setForm({ ...form, image: url })}
              />
            </div>

            {/* Two Column Layout for basic fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title" className="text-sm">Job Title <span className="text-red-500">*</span></Label>
                <Input id="title" name="title" value={form.title} onChange={handleChange} required placeholder="e.g. Environmental Scientist" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="company" className="text-sm">Company <span className="text-red-500">*</span></Label>
                <Input id="company" name="company" value={form.company} onChange={handleChange} required placeholder="e.g. Green Earth Co." className="mt-1" />
              </div>
            </div>
          </div>

          {/* Section: Location & Industry */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <MapPin className="h-4 w-4" />
              Location & Industry
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="state" className="text-sm">State <span className="text-red-500">*</span></Label>
                <select id="state" name="state" value={form.state} onChange={handleChange} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                  <option value="">Select a state...</option>
                  {usStates.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="industry" className="text-sm">Industry <span className="text-red-500">*</span></Label>
                <select id="industry" name="industry" value={form.industry} onChange={handleChange} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                  <option value="">Select an industry...</option>
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Compensation & Experience */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <DollarSign className="h-4 w-4" />
              Compensation & Experience
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="salary" className="text-sm">Salary Range <span className="text-red-500">*</span></Label>
                <select id="salary" name="salary" value={form.salary} onChange={handleChange} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                  <option value="">Select salary range...</option>
                  {salaryRanges.map((range) => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="experienceLevel" className="text-sm">Experience Level</Label>
                <select id="experienceLevel" name="experienceLevel" value={form.experienceLevel} onChange={handleChange} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Select experience level...</option>
                  {experienceLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Application Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <Clock className="h-4 w-4" />
              Application Details
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="applicationDeadline" className="text-sm">Application Deadline <span className="text-red-500">*</span></Label>
                <Input id="applicationDeadline" name="applicationDeadline" type="date" value={form.applicationDeadline} onChange={handleChange} min={new Date().toISOString().split('T')[0]} required className="mt-1" />
                {errors.applicationDeadline && <p className="text-red-500 text-xs mt-1">{errors.applicationDeadline}</p>}
              </div>
              <div>
                <Label htmlFor="contactEmail" className="text-sm">Contact Email <span className="text-red-500">*</span></Label>
                <Input id="contactEmail" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} required placeholder="jobs@company.com" className="mt-1" />
              </div>
            </div>
            
            <div>
              <Label htmlFor="applicationUrl" className="text-sm">Application URL <span className="text-red-500">*</span></Label>
              <Input id="applicationUrl" name="applicationUrl" type="url" value={form.applicationUrl} onChange={handleChange} placeholder="https://company.com/apply" required className="mt-1" />
              {errors.applicationUrl && <p className="text-red-500 text-xs mt-1">{errors.applicationUrl}</p>}
            </div>
          </div>

          {/* Section: Job Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <FileText className="h-4 w-4" />
              Job Description
            </div>
            
            <div>
              <Label htmlFor="description" className="text-sm">Description <span className="text-red-500">*</span></Label>
              <Textarea id="description" name="description" value={form.description} onChange={handleChange} required rows={5} placeholder="Describe the role, responsibilities, and what makes it great..." className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">{form.description.length} characters</p>
            </div>

            <div>
              <Label htmlFor="requirements" className="text-sm">Requirements <span className="text-muted-foreground text-xs">(comma separated)</span></Label>
              <Textarea id="requirements" name="requirements" value={form.requirements} onChange={handleChange} rows={3} placeholder="Bachelor's degree, 2+ years experience, Python proficiency" className="mt-1" />
            </div>
          </div>

          {/* Work Arrangements */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <Briefcase className="h-4 w-4" />
              Work Arrangements <span className="text-red-500">*</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {workArrangements.map((arrangement) => (
                <label 
                  key={arrangement} 
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                    Array.isArray(form.workArrangements) && form.workArrangements.includes(arrangement)
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={arrangement}
                    checked={Array.isArray(form.workArrangements) && form.workArrangements.includes(arrangement)}
                    onChange={handleWorkArrangementsChange}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">{arrangement}</span>
                </label>
              ))}
            </div>
            {(!Array.isArray(form.workArrangements) || form.workArrangements.length === 0) && (
              <p className="text-amber-600 text-xs flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Please select at least one work arrangement
              </p>
            )}
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
                  Submit Job Listing
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
