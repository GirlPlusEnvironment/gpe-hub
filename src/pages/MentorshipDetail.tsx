import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Loader2, MapPin, MessageSquare, ShieldAlert, UsersRound } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, Sticker } from "@/components/camp/CampDesign";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { fetchMentorshipListing, mentorshipBadge, requestMentorshipMatch, toListText, type MentorshipListing } from "@/lib/mentorship";

export default function MentorshipDetail() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [fitReason, setFitReason] = useState("");
  const [availability, setAvailability] = useState("");
  const [firstMeetingIdea, setFirstMeetingIdea] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ["mentorship-listing", listingId],
    queryFn: () => fetchMentorshipListing(listingId || ""),
    enabled: Boolean(listingId),
  });

  const submitMatch = async () => {
    if (!listing) return;
    setSubmitting(true);
    setRequestId(null);
    try {
      const request = await requestMentorshipMatch({
        listingId: listing.id,
        message,
        fitReason,
        proposedAvailability: availability,
        firstMeetingIdea,
      });
      setRequestId(request.id);
      toast({
        title: "Match request sent",
        description: "The other member will see the request in their mentorship dashboard.",
      });
    } catch (error) {
      toast({
        title: "Could not request match",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isOwner = listing?.profile_id === profile?.id;
  const matchCta = listing?.listing_type === "mentor_offer" ? "Request Mentorship" : "Offer to Mentor";

  if (isLoading) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main"><LoadingCampCard label="Loading mentorship" /></main>
        <Footer />
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main">
          <EmptyState illustration="notebook" title="Listing Not Found" description="This mentorship listing is unavailable." />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <Button type="button" variant="outline" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <SectionHeader
          className="mb-10"
          eyebrow={<Sticker accent="cyan"><UsersRound className="mr-2 h-4 w-4" /> {mentorshipBadge(listing)}</Sticker>}
          title={listing.headline}
          description={listing.intro || "Mentorship listing"}
          action={
            isOwner ? (
              <Sticker accent="yellow">Your listing</Sticker>
            ) : (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <CampButton variant="yellow">{matchCta}</CampButton>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{matchCta}</DialogTitle>
                    <DialogDescription>
                      Send a short note. If accepted, the Hub creates a shared mentorship chat automatically.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Field label="Message">
                      <Textarea value={message} onChange={(event) => setMessage(event.target.value)} />
                    </Field>
                    <Field label="Why this match may be a fit">
                      <Textarea value={fitReason} onChange={(event) => setFitReason(event.target.value)} />
                    </Field>
                    <Field label="Proposed availability">
                      <Textarea value={availability} onChange={(event) => setAvailability(event.target.value)} />
                    </Field>
                    <Field label="Optional first meeting idea">
                      <Textarea value={firstMeetingIdea} onChange={(event) => setFirstMeetingIdea(event.target.value)} />
                    </Field>
                    {requestId ? (
                      <div className="rounded-md border-[3px] border-black bg-gpe-cyan p-3 text-sm font-bold">
                        Match request created: {requestId}
                      </div>
                    ) : null}
                    <Button type="button" onClick={submitMatch} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                      Send Request
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )
          }
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Mentorship Details</CardTitle>
              <CardDescription>Full listing summary and match preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ProfileLine listing={listing} />
              <DetailBlock title={listing.listing_type === "mentor_offer" ? "What I Can Support" : "Support Needed"} value={listing.mentor_areas || listing.support_needed} />
              <DetailBlock title="Goals or Outcome" value={listing.current_goals || listing.ideal_outcome} />
              <DetailBlock title="Skills and Focus" value={[toListText(listing.topics), toListText(listing.climate_focus)].join(" | ")} />
              <DetailBlock title="Experience or Career Stage" value={listing.experience_summary || listing.career_stage} />
              <DetailBlock title="Preferences" value={[listing.communication_format, listing.meeting_frequency, listing.remote_preference].filter(Boolean).join(" | ")} />
              <DetailBlock title="Boundaries or Timeline" value={listing.boundaries || listing.urgency} />
              <DetailBlock title="Related Links" value={listing.professional_links} />
            </CardContent>
          </Card>

          <aside className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Availability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm font-bold text-black/70">
                <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> {listing.availability || "Open"}</div>
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {listing.location || listing.remote_preference}</div>
                <div>Status: {listing.status}</div>
                <div>Created: {new Date(listing.created_at).toLocaleDateString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Moderation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="button" variant="outline" className="w-full">Report Listing</Button>
                <Link to="/messages" className="block">
                  <Button type="button" variant="outline" className="w-full">
                    <MessageSquare className="h-4 w-4" />
                    Messages
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </aside>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function ProfileLine({ listing }: { listing: MentorshipListing }) {
  return (
    <div className="flex items-center gap-4 rounded-md border-[3px] border-black bg-white p-4">
      <Avatar className="h-14 w-14 border-[3px] border-black">
        <AvatarImage src={listing.profile_image_url || listing.profiles?.avatar_url || undefined} alt={listing.display_name} />
        <AvatarFallback>{listing.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="font-header text-2xl uppercase">{listing.display_name}</p>
        <p className="text-sm font-bold text-black/70">{listing.organization_role || listing.career_stage || "GPE member"}</p>
      </div>
    </div>
  );
}

function DetailBlock({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <h2 className="text-sm font-black uppercase">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm font-bold text-black/70">{value}</p>
    </div>
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
