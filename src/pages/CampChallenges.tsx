import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Send, Trophy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
      <main className="gpe-page-main">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border-[3px] border-black bg-cyan-200 px-4 py-2 text-xs font-black uppercase">
                <Trophy className="h-4 w-4" />
                Camp GPE
              </div>
              <h1 className="gpe-heading text-4xl md:text-6xl">Submit Challenges</h1>
              <p className="mt-3 max-w-2xl text-sm font-bold text-black/70">
                Submit completed Camp GPE actions for {season?.name || "the active season"}. Your Hub profile is used automatically.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={load}>Refresh</Button>
              <Link to="/leaderboard"><Button variant="outline">Leaderboard</Button></Link>
            </div>
          </div>

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
              <Card>
                <CardHeader>
                  <CardTitle>Active Challenges</CardTitle>
                  <CardDescription>
                    Select actions when they fit what you completed. Team GPE can classify or adjust submissions during review.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!campStatus && (
                    <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 p-3 text-sm font-bold text-yellow-900">
                      This Hub account is not linked to a Camp season registration yet. You can submit, but Team GPE may need to reconcile it.
                    </div>
                  )}
                  {challenges.length === 0 ? (
                    <p className="text-sm font-bold text-black/60">No Camp challenges are open right now.</p>
                  ) : challenges.map((challenge) => {
                    const completed = completionCounts[challenge.id] || 0;
                    const limitReached = completed >= challenge.max_completions_per_member || (!challenge.allow_multiple_submissions && completed > 0);
                    return (
                      <label key={challenge.id} className="flex gap-3 rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                        <input
                          type="checkbox"
                          checked={selected.includes(challenge.id)}
                          disabled={limitReached}
                          onChange={() => toggleChallenge(challenge)}
                          className="mt-1 h-5 w-5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-black">{challenge.title}</span>
                          {challenge.short_description && <span className="mt-1 block text-sm font-bold text-black/70">{challenge.short_description}</span>}
                          <span className="mt-2 flex flex-wrap gap-2">
                            <Badge>{challenge.point_value == null ? "Points pending" : `${challenge.point_value} points`}</Badge>
                            <Badge variant="outline">Proof optional</Badge>
                            {limitReached && <Badge variant="outline">Completed</Badge>}
                          </span>
                          {challenge.action_url && (
                            <a href={challenge.action_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-black underline">
                              Open action <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </span>
                      </label>
                    );
                  })}
                  <label className="flex gap-3 rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                    <input type="checkbox" checked={otherSelected} onChange={(event) => setOtherSelected(event.target.checked)} className="mt-1 h-5 w-5" />
                    <span className="font-black">Other Camp action</span>
                  </label>
                  {otherSelected && (
                    <Textarea value={otherAction} onChange={(event) => setOtherAction(event.target.value)} placeholder="Describe what you completed." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Proof and Notes</CardTitle>
                  <CardDescription>Share whatever context you have. Missing links or details will not block review.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea value={proof} onChange={(event) => setProof(event.target.value)} placeholder="https://..." />
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for Team GPE." />
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit Challenge
                  </Button>
                </CardContent>
              </Card>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
