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
import { Calendar, MapPin, Clock, Link, FileText, CheckCircle2, Loader2 } from "lucide-react";

const eventTypes = ["Conference", "Workshop", "Festival", "Meetup", "Expo", "Panel"];
const usStates = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "Other"];

const STORAGE_KEY = "event-submission-draft";

export default function EventSubmissionForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load from localStorage on mount
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          title: "",
          organizer: "",
          image: "",
          location: "",
          eventType: eventTypes[0],
          date: "",
          time: "",
          cost: "",
          contactEmail: "",
          registrationUrl: "",
          description: "",
        };
      }
    }
    return {
      title: "",
      organizer: "",
      image: "",
      location: "",
      eventType: eventTypes[0],
      date: "",
      time: "",
      cost: "",
      contactEmail: "",
      registrationUrl: "",
      description: "",
    };
  });

  // Save to localStorage whenever form changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  // Calculate form completion percentage
  const requiredFields = ['title', 'location', 'eventType', 'date', 'registrationUrl', 'description'];
  const completedFields = requiredFields.filter(field => form[field] && form[field].toString().trim() !== '');
  const completionPercentage = Math.round((completedFields.length / requiredFields.length) * 100);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[e.target.name];
      return copy;
    });
  };  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate date
    if (form.date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(form.date);
      if (eventDate < today) {
        toast({
          title: "Invalid date",
          description: "Event date cannot be in the past.",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate required registration URL and location
    const newErrors: Record<string, string> = {};
    if (!form.registrationUrl) {
      newErrors.registrationUrl = "Registration URL is required.";
    } else {
      try {
        new URL(form.registrationUrl);
      } catch {
        newErrors.registrationUrl = "Please enter a valid registration URL (include https://).";
      }
    }
    if (!form.location) {
      newErrors.location = "Location is required.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      toast({
        title: "Sign in required",
        description: "You must be logged in to submit an event.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Prepare data for Supabase
    const eventData = {
      category: "events",
      title: form.title,
      summary: form.description.slice(0, 120),
      description: form.description,
      image_url: form.image,
      tags: [],
      submitted_by: user.id,
      status: "pending_review",
      metadata: {
        organizer: form.organizer,
        event_type: form.eventType,
        contact_email: form.contactEmail,
        registration_url: form.registrationUrl,
        cost: form.cost,
        location: form.location,
        date: form.date,
        time: form.time,
      },
    };

    // Validate content before inserting
    try {
      validateListingContent(eventData);
    } catch (validationError: unknown) {
      toast({
        title: "Error",
        description: validationError instanceof Error ? validationError.message : "Your content contains inappropriate language. Please revise and try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const { data: insertData, error } = await supabase.from("listings").insert([eventData]).select();
    if (error) {
      toast({
        title: "Error submitting event",
        description: "We couldn't submit your event. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    } else if (insertData && insertData.length > 0) {
      const newListingId = insertData[0].id;
      // Clear the draft after successful submission
      localStorage.removeItem(STORAGE_KEY);
      
      toast({
        title: "Event submitted!",
        description: "Your event is under Team GPE review.",
      });
      navigate(`/listing/${newListingId}`);
    }
  };

  const getEmptyForm = () => ({
    title: "",
    organizer: "",
    image: "",
    location: "",
    eventType: "",
    date: "",
    time: "",
    cost: "",
    contactEmail: "",
    registrationUrl: "",
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

  return (
    <Card className="gpe-paper overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Calendar className="h-5 w-5 text-green-500" />
              Event Details
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
              <Calendar className="h-4 w-4" />
              Basic Information
            </div>
            
            <div className="rounded-[1.5rem] border-[3px] border-black bg-white p-4">
              <Label className="text-sm font-medium">Event Image (Optional)</Label>
              <p className="text-xs text-muted-foreground mb-3">An image helps your event stand out</p>
              <ImageUpload
                bucket="event-images"
                folder="events"
                currentImage={form.image}
                onUploadComplete={(url) => setForm({ ...form, image: url })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title" className="text-sm">Event Title <span className="text-red-500">*</span></Label>
                <Input id="title" name="title" value={form.title} onChange={handleChange} required placeholder="e.g. Climate Action Summit 2025" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="organizer" className="text-sm">Organizer</Label>
                <Input id="organizer" name="organizer" value={form.organizer} onChange={handleChange} placeholder="e.g. Environmental Coalition" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Section: Location & Type */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <MapPin className="h-4 w-4" />
              Location & Type
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location" className="text-sm">Location <span className="text-red-500">*</span></Label>
                <select id="location" name="location" value={form.location} onChange={handleChange} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                  <option value="">Select a state...</option>
                  {usStates.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
              </div>
              <div>
                <Label htmlFor="eventType" className="text-sm">Event Type <span className="text-red-500">*</span></Label>
                <select id="eventType" name="eventType" value={form.eventType} onChange={handleChange} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                  <option value="">Select event type...</option>
                  {eventTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Date & Time */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <Clock className="h-4 w-4" />
              Date & Time
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date" className="text-sm">Event Date <span className="text-red-500">*</span></Label>
                <Input id="date" name="date" type="date" value={form.date} onChange={handleChange} required min={new Date().toISOString().split('T')[0]} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="time" className="text-sm">Event Time</Label>
                <Input id="time" name="time" type="time" value={form.time} onChange={handleChange} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cost" className="text-sm">Cost</Label>
                <Input id="cost" name="cost" value={form.cost} onChange={handleChange} placeholder="e.g. Free, $50" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Section: Contact & Registration */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <Link className="h-4 w-4" />
              Contact & Registration
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contactEmail" className="text-sm">Contact Email</Label>
                <Input id="contactEmail" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} placeholder="events@organization.org" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="registrationUrl" className="text-sm">Registration URL <span className="text-red-500">*</span></Label>
                <Input id="registrationUrl" name="registrationUrl" type="url" value={form.registrationUrl} onChange={handleChange} placeholder="https://eventbrite.com/..." required className="mt-1" />
                {errors.registrationUrl && <p className="text-red-500 text-xs mt-1">{errors.registrationUrl}</p>}
              </div>
            </div>
          </div>

          {/* Section: Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-[3px] border-black pb-2 text-sm font-black uppercase text-black/70">
              <FileText className="h-4 w-4" />
              Event Description
            </div>
            
            <div>
              <Label htmlFor="description" className="text-sm">Description <span className="text-red-500">*</span></Label>
              <Textarea id="description" name="description" value={form.description} onChange={handleChange} required rows={5} placeholder="Describe the event, agenda, speakers, and what attendees can expect..." className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">{form.description.length} characters</p>
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
                  Submit Event
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
