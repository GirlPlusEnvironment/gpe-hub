import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, MessageSquare, UserRoundSearch, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { submitMentorshipListing, type MentorshipListingType } from "@/lib/mentorship";

type MentorshipFormState = {
  listingType: MentorshipListingType;
  displayName: string;
  headline: string;
  location: string;
  timeZone: string;
  communicationFormat: string;
  availability: string;
  intro: string;
  topics: string;
  climateFocus: string;
  careerStage: string;
  organizationRole: string;
  meetingFrequency: string;
  remotePreference: string;
  profileImageUrl: string;
  expiresAt: string;
  supportNeeded: string;
  currentGoals: string;
  skillsToDevelop: string;
  preferredMentorExperience: string;
  idealOutcome: string;
  urgency: string;
  mentorAreas: string;
  experienceSummary: string;
  bestPositionedToSupport: string;
  menteeCapacity: string;
  mentorshipFormat: string;
  boundaries: string;
  professionalLinks: string;
  contactConsent: boolean;
  visibility: string;
};

const initialForm: MentorshipFormState = {
  listingType: "mentor_request",
  displayName: "",
  headline: "",
  location: "",
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  communicationFormat: "Hub message, email, or video call",
  availability: "",
  intro: "",
  topics: "",
  climateFocus: "",
  careerStage: "",
  organizationRole: "",
  meetingFrequency: "",
  remotePreference: "either",
  profileImageUrl: "",
  expiresAt: "",
  supportNeeded: "",
  currentGoals: "",
  skillsToDevelop: "",
  preferredMentorExperience: "",
  idealOutcome: "",
  urgency: "",
  mentorAreas: "",
  experienceSummary: "",
  bestPositionedToSupport: "",
  menteeCapacity: "1",
  mentorshipFormat: "",
  boundaries: "",
  professionalLinks: "",
  contactConsent: false,
  visibility: "members",
};

const requiredFields: Array<keyof MentorshipFormState> = ["headline", "availability", "intro", "topics"];

export default function MentorshipSubmissionForm() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<MentorshipFormState>(() => ({
    ...initialForm,
    displayName: profile?.full_name || profile?.username || "",
  }));
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const updateField = (field: keyof MentorshipFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setCreatedId(null);
    try {
      const missing = requiredFields.filter((field) => !String(form[field] || "").trim());
      if (missing.length > 0 || !form.contactConsent) {
        throw new Error("Complete the required mentorship fields and contact consent before submitting.");
      }

      const listing = await submitMentorshipListing({
        ...form,
        email: profile?.email,
        profileId: profile?.id,
        status: "pending_review",
        menteeCapacity: form.menteeCapacity,
      });

      setCreatedId(listing.id);
      toast({
        title: "Mentorship listing submitted",
        description: "Team GPE can review and publish it from the admin workspace.",
      });
    } catch (error) {
      toast({
        title: "Could not submit mentorship listing",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRoundSearch className="h-5 w-5" />
            Mentorship
          </CardTitle>
          <CardDescription>
            Listings are reviewed before they appear in Explore. Your email stays private.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs
            value={form.listingType}
            onValueChange={(value) => updateField("listingType", value as MentorshipListingType)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mentor_request">Request a Mentor</TabsTrigger>
              <TabsTrigger value="mentor_offer">Become a Mentor</TabsTrigger>
            </TabsList>
            <TabsContent value="mentor_request" className="mt-6 space-y-4">
              <Field label="What support are you looking for?">
                <Textarea value={form.supportNeeded} onChange={(event) => updateField("supportNeeded", event.target.value)} />
              </Field>
              <Field label="Current goals">
                <Textarea value={form.currentGoals} onChange={(event) => updateField("currentGoals", event.target.value)} />
              </Field>
              <Field label="Skills or areas you want to develop">
                <Textarea value={form.skillsToDevelop} onChange={(event) => updateField("skillsToDevelop", event.target.value)} />
              </Field>
              <Field label="Preferred mentor experience">
                <Input value={form.preferredMentorExperience} onChange={(event) => updateField("preferredMentorExperience", event.target.value)} />
              </Field>
              <Field label="Ideal mentorship outcome">
                <Textarea value={form.idealOutcome} onChange={(event) => updateField("idealOutcome", event.target.value)} />
              </Field>
              <Field label="Optional urgency or target timeline">
                <Input value={form.urgency} onChange={(event) => updateField("urgency", event.target.value)} />
              </Field>
            </TabsContent>
            <TabsContent value="mentor_offer" className="mt-6 space-y-4">
              <Field label="Areas you can mentor in">
                <Textarea value={form.mentorAreas} onChange={(event) => updateField("mentorAreas", event.target.value)} />
              </Field>
              <Field label="Years or type of experience">
                <Input value={form.experienceSummary} onChange={(event) => updateField("experienceSummary", event.target.value)} />
              </Field>
              <Field label="Who you are best positioned to support">
                <Textarea value={form.bestPositionedToSupport} onChange={(event) => updateField("bestPositionedToSupport", event.target.value)} />
              </Field>
              <Field label="Number of mentees you can support">
                <Input type="number" min="0" value={form.menteeCapacity} onChange={(event) => updateField("menteeCapacity", event.target.value)} />
              </Field>
              <Field label="Preferred mentorship format">
                <Input value={form.mentorshipFormat} onChange={(event) => updateField("mentorshipFormat", event.target.value)} />
              </Field>
              <Field label="Boundaries or limitations">
                <Textarea value={form.boundaries} onChange={(event) => updateField("boundaries", event.target.value)} />
              </Field>
              <Field label="Optional professional links">
                <Input value={form.professionalLinks} onChange={(event) => updateField("professionalLinks", event.target.value)} />
              </Field>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shared Details</CardTitle>
          <CardDescription>Use comma-separated topics and focus areas for filtering in Explore.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Display name">
            <Input value={form.displayName} onChange={(event) => updateField("displayName", event.target.value)} />
          </Field>
          <Field label="Headline">
            <Input value={form.headline} onChange={(event) => updateField("headline", event.target.value)} required />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChange={(event) => updateField("location", event.target.value)} />
          </Field>
          <Field label="Time zone">
            <Input value={form.timeZone} onChange={(event) => updateField("timeZone", event.target.value)} />
          </Field>
          <Field label="Preferred communication format">
            <Input value={form.communicationFormat} onChange={(event) => updateField("communicationFormat", event.target.value)} />
          </Field>
          <Field label="Availability">
            <Input value={form.availability} onChange={(event) => updateField("availability", event.target.value)} required />
          </Field>
          <Field label="Mentorship topics">
            <Input value={form.topics} onChange={(event) => updateField("topics", event.target.value)} required />
          </Field>
          <Field label="Climate focus areas">
            <Input value={form.climateFocus} onChange={(event) => updateField("climateFocus", event.target.value)} />
          </Field>
          <Field label="Career stage">
            <Input value={form.careerStage} onChange={(event) => updateField("careerStage", event.target.value)} />
          </Field>
          <Field label="Organization, school, or role">
            <Input value={form.organizationRole} onChange={(event) => updateField("organizationRole", event.target.value)} />
          </Field>
          <Field label="Meeting frequency preference">
            <Input value={form.meetingFrequency} onChange={(event) => updateField("meetingFrequency", event.target.value)} />
          </Field>
          <Field label="Remote, local, or either">
            <select className="gpe-input" value={form.remotePreference} onChange={(event) => updateField("remotePreference", event.target.value)}>
              <option value="either">Either</option>
              <option value="remote">Remote</option>
              <option value="local">Local</option>
            </select>
          </Field>
          <Field label="Optional profile/image link">
            <Input value={form.profileImageUrl} onChange={(event) => updateField("profileImageUrl", event.target.value)} />
          </Field>
          <Field label="Expiration date">
            <Input type="date" value={form.expiresAt} onChange={(event) => updateField("expiresAt", event.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Short introduction">
              <Textarea value={form.intro} onChange={(event) => updateField("intro", event.target.value)} required />
            </Field>
          </div>
          <label className="flex items-start gap-3 rounded-md border-[3px] border-black bg-white p-4 text-sm font-bold">
            <input
              type="checkbox"
              checked={form.contactConsent}
              onChange={(event) => updateField("contactConsent", event.target.checked)}
              className="mt-1"
            />
            <span>I consent to be contacted through the Hub about this mentorship listing.</span>
          </label>
          <Field label="Visibility">
            <select className="gpe-input" value={form.visibility} onChange={(event) => updateField("visibility", event.target.value)}>
              <option value="members">Hub members</option>
              <option value="public">Public Explore listing</option>
              <option value="private">Private to Team GPE</option>
            </select>
          </Field>
        </CardContent>
      </Card>

      {createdId ? (
        <div className="rounded-md border-[3px] border-black bg-gpe-cyan p-4 text-sm font-bold">
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          Listing submitted: {createdId}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UsersRound className="h-4 w-4" />}
          Submit Mentorship Listing
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate("/explore?category=mentorship")}>
          <MessageSquare className="h-4 w-4" />
          Browse Mentorship
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div id={id}>{children}</div>
    </div>
  );
}
