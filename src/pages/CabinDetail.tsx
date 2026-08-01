import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageSquare, ShieldCheck, Tent, UserPlus, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, Sticker } from "@/components/camp/CampDesign";
import { useToast } from "@/hooks/use-toast";
import { fetchCabin, requestJoinCabin } from "@/lib/mentorship";
import { supabase } from "@/lib/supabaseClient";

type CabinMemberRow = {
  id: string;
  role: string;
  status: string;
  profile_id: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export default function CabinDetail() {
  const { cabinId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [introduction, setIntroduction] = useState("");
  const [joinReason, setJoinReason] = useState("");
  const [rulesConsent, setRulesConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: cabin, isLoading, isError } = useQuery({
    queryKey: ["cabin", cabinId],
    queryFn: () => fetchCabin(cabinId || ""),
    enabled: Boolean(cabinId),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["cabin-members", cabinId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_cabin_members")
        .select("id,role,status,profile_id,profiles(full_name,username,avatar_url)")
        .eq("cabin_id", cabinId)
        .in("status", ["approved", "active"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CabinMemberRow[];
    },
    enabled: Boolean(cabinId),
  });

  const submitJoinRequest = async () => {
    if (!cabin) return;
    setSubmitting(true);
    try {
      await requestJoinCabin({
        cabinId: cabin.id,
        introduction,
        joinReason,
        rulesConsent,
      });
      toast({
        title: "Request submitted",
        description: "The cabin lead or Team GPE can review it.",
      });
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Could not request cabin access",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main"><LoadingCampCard label="Loading cabin" /></main>
        <Footer />
      </div>
    );
  }

  if (isError || !cabin) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main">
          <EmptyState illustration="tent" title="Cabin Not Found" description="This cabin is unavailable." />
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
          eyebrow={<Sticker accent="yellow"><Tent className="mr-2 h-4 w-4" /> Camp Cabin</Sticker>}
          title={cabin.name}
          description={cabin.description || "Camp GPE cabin"}
          action={
            <div className="flex flex-wrap gap-2">
              {cabin.conversation_id ? (
                <CampButton variant="cyan" onClick={() => navigate(`/messages?conversation=${cabin.conversation_id}`)}>
                  <MessageSquare className="h-4 w-4" />
                  Open Cabin Chat
                </CampButton>
              ) : null}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <CampButton variant="yellow">
                    <UserPlus className="h-4 w-4" />
                    Request to Join
                  </CampButton>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request to Join Cabin</DialogTitle>
                    <DialogDescription>Approved members are added to the cabin and linked group chat.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Field label="Short introduction">
                      <Textarea value={introduction} onChange={(event) => setIntroduction(event.target.value)} />
                    </Field>
                    <Field label="Why do you want to join?">
                      <Textarea value={joinReason} onChange={(event) => setJoinReason(event.target.value)} />
                    </Field>
                    <label className="flex items-start gap-3 rounded-md border-[3px] border-black bg-white p-4 text-sm font-bold">
                      <input type="checkbox" checked={rulesConsent} onChange={(event) => setRulesConsent(event.target.checked)} className="mt-1" />
                      <span>I agree to follow the cabin rules and community agreement.</span>
                    </label>
                    <Button type="button" onClick={submitJoinRequest} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      Submit Request
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          }
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Cabin Activity</CardTitle>
              <CardDescription>Members, focus, agreement, and chat linkage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Detail label="Theme" value={cabin.theme} />
              <Detail label="Focus area" value={cabin.focus_area} />
              <Detail label="Location mode" value={cabin.location_mode} />
              <Detail label="Visibility" value={cabin.visibility} />
              <Detail label="Maximum members" value={cabin.max_members ? String(cabin.max_members) : null} />
              <Detail label="Community agreement" value={cabin.community_agreement} />
            </CardContent>
          </Card>

          <aside className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Members</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.length === 0 ? (
                  <p className="text-sm font-bold text-black/70">No active cabin members are visible yet.</p>
                ) : members.map((member) => (
                  <div key={member.id} className="rounded-md border-[3px] border-black bg-white p-3 text-sm font-bold">
                    {member.profiles?.full_name || member.profiles?.username || member.profile_id}
                    <span className="ml-2 uppercase text-black/60">{member.role}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Eligibility</CardTitle>
              </CardHeader>
              <CardContent className="text-sm font-bold text-black/70">
                Only active eligible members count toward cabin totals and can be added to linked chats.
              </CardContent>
            </Card>
          </aside>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <h2 className="text-sm font-black uppercase">{label}</h2>
      <p className="mt-1 whitespace-pre-line text-sm font-bold text-black/70">{value}</p>
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
