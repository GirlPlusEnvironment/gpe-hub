import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Send, Trophy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  CampButton,
  ChallengeCard,
  MarqueeStrip,
  SectionHeader,
  SeasonHero,
  StatSticker,
  Sticker,
  Tape,
} from "@/components/camp/CampDesign";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  type CampChallenge,
  type CampPointsLedgerRow,
  type CampSeason,
  type CampSeasonMember,
  getActiveCampSeason,
  getHubCampChallenges,
  getMyCampHistory,
  getMyCampStatus,
} from "@/lib/camp";

export default function CampChallenges() {
  const { profile, user } = useAuth();
  const [season, setSeason] = useState<CampSeason | null>(null);
  const [campStatus, setCampStatus] = useState<CampSeasonMember | null>(null);
  const [challenges, setChallenges] = useState<CampChallenge[]>([]);
  const [ledger, setLedger] = useState<CampPointsLedgerRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [proof, setProof] = useState("");
  const [notes, setNotes] = useState("");
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherAction, setOtherAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const completionCounts = useMemo(() => {
    return ledger.reduce<Record<string, number>>((counts, row) => {
      if (!row.challenge_id || row.reversed_at || row.entry_type !== "challenge_award") return counts;
      counts[row.challenge_id] = (counts[row.challenge_id] || 0) + 1;
      return counts;
    }, {});
  }, [ledger]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const active = await getActiveCampSeason();
      setSeason(active);
      if (!active) return;
      const [challengeRows, status, history] = await Promise.all([
        getHubCampChallenges(active.id),
        getMyCampStatus(active.id),
        getMyCampHistory(active.id),
      ]);
      setChallenges(challengeRows);
      setCampStatus(status);
      setLedger(history.ledger);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camp challenges could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function toggleChallenge(challenge: CampChallenge) {
    const completed = completionCounts[challenge.id] || 0;
    const limitReached = completed >= challenge.max_completions_per_member || (!challenge.allow_multiple_submissions && completed > 0);
    if (limitReached) return;
    setSelected((current) =>
      current.includes(challenge.id)
        ? current.filter((id) => id !== challenge.id)
        : [...current, challenge.id],
    );
  }

  async function submitChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!profile?.email && !user?.email) {
      setError("Your Hub profile needs an email address before you can submit a Camp challenge.");
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const { data, error: invokeError } = await supabase.functions.invoke("camp-gpe-challenge-submit", {
        body: {
          idempotencyKey,
          fields: {
            firstName: profile?.first_name || "",
            lastName: profile?.last_name || "",
            email: profile?.email || user?.email || "",
            challengeIds: selected,
            actions: otherSelected ? ["other"] : [],
            otherAction,
            screenshotLinks: proof,
            socialLinks: "",
            notes,
          },
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.ok && !data?.duplicate) throw new Error(data?.message || "Challenge submission failed.");
      setSuccess(data.message || "Your submission has been received and will be reviewed by Team GPE. Approved actions will be added to your points.");
      setSelected([]);
      setProof("");
      setNotes("");
      setOtherSelected(false);
      setOtherAction("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Challenge submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main space-y-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <SeasonHero
            title="Camp Mission Board"
            seasonName={season?.name || "Camp GPE"}
            description="Pick any missions that match what you completed, or submit an unlisted action. Team GPE reviews everything before points are awarded."
            actionHref="/leaderboard"
            actionLabel="View Leaderboard"
            stats={[
              { label: "Open missions", value: challenges.length.toLocaleString(), accent: "cyan", icon: <Trophy className="h-12 w-12" /> },
              { label: "Selected", value: selected.length + (otherSelected ? 1 : 0), accent: "yellow", icon: <Send className="h-12 w-12" /> },
              { label: "Camp status", value: campStatus?.status || "Pending", accent: "orange", icon: <Trophy className="h-12 w-12" /> },
            ]}
          />

          <MarqueeStrip>
            Proof optional - descriptions optional - submit freely - Team GPE reviews - approved actions earn points
          </MarqueeStrip>

          {error && (
            <div className="rounded-[1.5rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-[1.5rem] border-[3px] border-green-600 bg-green-100 p-4 text-sm font-bold text-green-800">
              {success}
            </div>
          )}

          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : !season ? (
            <Card>
              <CardContent className="py-8 text-sm font-bold text-black/70">No active Camp season is configured.</CardContent>
            </Card>
          ) : (
            <form onSubmit={submitChallenge} className="space-y-6">
              <Card className="gpe-paper">
                <CardHeader>
                  <SectionHeader
                    eyebrow={<Sticker accent="pink">Mission tracks</Sticker>}
                    title="Active Challenges"
                    description="Select actions when they fit what you completed. Team GPE can classify or adjust submissions during review."
                    action={<Button variant="outline" onClick={load} type="button">Refresh</Button>}
                  />
                </CardHeader>
                <CardContent className="space-y-5">
                  {!campStatus && (
                    <div className="rounded-[1.5rem] border-[4px] border-black bg-gpe-yellow p-4 text-sm font-black text-black">
                      This Hub account is not linked to a Camp season registration yet. You can submit, but Team GPE may need to reconcile it.
                    </div>
                  )}
                  {challenges.length === 0 ? (
                    <p className="text-sm font-bold text-black/60">No Camp challenges are open right now.</p>
                  ) : (
                    <div className="grid gap-5 md:grid-cols-2">
                      {challenges.map((challenge, index) => {
                        const completed = completionCounts[challenge.id] || 0;
                        const limitReached = completed >= challenge.max_completions_per_member || (!challenge.allow_multiple_submissions && completed > 0);
                        const accent = (["cyan", "yellow", "orange", "white"] as const)[index % 4];
                        return (
                          <ChallengeCard
                            key={challenge.id}
                            title={challenge.title}
                            description={challenge.short_description}
                            points={challenge.point_value == null ? "Points pending" : `${challenge.point_value} points`}
                            category={challenge.category.replaceAll("_", " ")}
                            status={limitReached ? "Completed" : selected.includes(challenge.id) ? "Selected" : "Open"}
                            accent={accent}
                            selected={selected.includes(challenge.id)}
                            disabled={limitReached}
                            onToggle={() => toggleChallenge(challenge)}
                            action={challenge.action_url ? (
                              <a
                                href={challenge.action_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-black uppercase underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Open action <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          />
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setOtherSelected((current) => !current)}
                    className={`gpe-card-sm gpe-hover-lift flex w-full items-center justify-between gap-4 p-5 text-left ${otherSelected ? "bg-gpe-pink text-white" : "bg-white"}`}
                  >
                    <span className="font-header text-2xl uppercase">Other Camp Action</span>
                    <Sticker accent={otherSelected ? "yellow" : "cyan"} rotate="none">{otherSelected ? "Selected" : "Optional"}</Sticker>
                  </button>
                  {otherSelected && (
                    <Textarea value={otherAction} onChange={(event) => setOtherAction(event.target.value)} placeholder="Describe what you completed." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Tape>Optional context</Tape>
                  <CardTitle>Proof and Notes</CardTitle>
                  <CardDescription>Share whatever context you have. Missing links or details will not block review.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea value={proof} onChange={(event) => setProof(event.target.value)} placeholder="https://..." />
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for Team GPE." />
                  <CampButton type="submit" disabled={submitting} variant="secondary">
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit for Review
                  </CampButton>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                <StatSticker label="Proof" value="Optional" accent="white" />
                <StatSticker label="Points" value="After review" accent="yellow" />
                <StatSticker label="Identity" value={campStatus ? "Linked" : "Reconcile"} accent="cyan" />
              </div>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
