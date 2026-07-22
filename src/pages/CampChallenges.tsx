import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, Send, Trophy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  CampButton,
  ChallengeCard,
  EmptyState,
  LoadingCampCard,
  MarqueeStrip,
  SectionHeader,
  SeasonHero,
  StatSticker,
  Sticker,
  Tape,
} from "@/components/camp/CampDesign";
import { useAuth } from "@/hooks/useAuth";
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
  const [searchParams] = useSearchParams();
  const [season, setSeason] = useState<CampSeason | null>(null);
  const [campStatus, setCampStatus] = useState<CampSeasonMember | null>(null);
  const [challenges, setChallenges] = useState<CampChallenge[]>([]);
  const [ledger, setLedger] = useState<CampPointsLedgerRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeType, setActiveType] = useState("all");
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

  useEffect(() => {
    const requestedSlug = searchParams.get("challenge");
    if (!requestedSlug || challenges.length === 0) return;
    const match = challenges.find((challenge) => challenge.slug === requestedSlug);
    if (match) setSelected((current) => current.includes(match.id) ? current : [...current, match.id]);
  }, [challenges, searchParams]);

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
      setError(err instanceof Error ? err.message : "Seasonal challenges could not be loaded.");
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
      setError("Your Hub profile needs an email address before you can submit a seasonal challenge.");
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

  function formatDate(value: string | null | undefined) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  function challengeWindow(challenge: CampChallenge) {
    const start = formatDate(challenge.starts_at);
    const end = formatDate(challenge.ends_at);
    if (start && end) return `${start} - ${end}`;
    return start || end || "Seasonal";
  }

  function challengeStatus(challenge: CampChallenge, completed: number, selectedNow: boolean) {
    if (completed >= challenge.max_completions_per_member || (!challenge.allow_multiple_submissions && completed > 0)) return "Completed";
    const now = Date.now();
    const start = challenge.starts_at ? new Date(challenge.starts_at).getTime() : null;
    const end = challenge.ends_at ? new Date(challenge.ends_at).getTime() : null;
    if (start && now < start) return selectedNow ? "Selected" : "Upcoming";
    if (end && now > end) return "Closed";
    return selectedNow ? "Selected" : "Open";
  }

  const typeFilters = useMemo(() => {
    const categories = Array.from(new Set(challenges.map((challenge) => challenge.category).filter(Boolean))).sort();
    return [
      { value: "all", label: "All" },
      { value: "featured", label: "Featured" },
      ...categories.map((category) => ({ value: category, label: category.replaceAll("_", " ") })),
    ];
  }, [challenges]);

  const visibleChallenges = useMemo(() => {
    if (activeType === "featured") return challenges.filter((challenge) => challenge.is_featured);
    if (activeType === "all") return challenges;
    return challenges.filter((challenge) => challenge.category === activeType);
  }, [activeType, challenges]);

  const challengeWeeks = useMemo(() => {
    const groups = visibleChallenges.reduce<Record<string, CampChallenge[]>>((acc, challenge) => {
      const key = String(challenge.week_number || "season");
      acc[key] = acc[key] || [];
      acc[key].push(challenge);
      return acc;
    }, {});
    return Object.entries(groups)
      .map(([key, items]) => ({
        key,
        weekNumber: key === "season" ? null : Number(key),
        theme: items.find((item) => item.theme)?.theme,
        window: challengeWindow(items[0]),
        items: items.sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => (a.weekNumber ?? 999) - (b.weekNumber ?? 999));
  }, [visibleChallenges]);

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main space-y-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <SeasonHero
            title="Seasonal Challenges"
            seasonName={season?.name || "Current Season"}
            description="Pick any missions that match what you completed, or submit an unlisted action. Team GPE reviews everything before points are awarded."
            actionHref="/leaderboard"
            actionLabel="View Leaderboard"
            stats={[
              { label: "Open missions", value: challenges.length.toLocaleString(), accent: "cyan", icon: <Trophy className="h-12 w-12" /> },
              { label: "Selected", value: selected.length + (otherSelected ? 1 : 0), accent: "yellow", icon: <Send className="h-12 w-12" /> },
              { label: "Season status", value: campStatus?.status || "Pending", accent: "orange", icon: <Trophy className="h-12 w-12" /> },
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
            <div className="grid gap-4 md:grid-cols-2">
              <LoadingCampCard label="Loading seasonal challenges" />
              <LoadingCampCard label="Loading seasonal challenges" />
            </div>
          ) : !season ? (
            <EmptyState
              illustration="campfire"
              title="Between Seasons"
              description="There is no active seasonal challenge configured yet. Check back when Team GPE opens the next mission board."
              action={<Link to="/leaderboard"><CampButton variant="outline">View Leaderboard</CampButton></Link>}
            />
          ) : (
            <form onSubmit={submitChallenge} className="space-y-6">
              <Card className="gpe-paper">
                <CardHeader>
                  <SectionHeader
                    eyebrow={<Sticker accent="pink">Mission tracks</Sticker>}
                    title="Active Challenges"
                    description="Browse the full Camp calendar by week or challenge type. Select actions when they fit what you completed; Team GPE reviews submissions before awarding points."
                    action={<Button variant="outline" onClick={load} type="button">Refresh</Button>}
                  />
                </CardHeader>
                <CardContent className="space-y-5">
                  {!campStatus && (
                    <div className="rounded-[1.5rem] border-[4px] border-black bg-gpe-yellow p-4 text-sm font-black text-black">
                      This Hub account is not linked to the current season yet. You can submit, but Team GPE may need to reconcile it.
                    </div>
                  )}
                  {challenges.length === 0 ? (
                    <EmptyState
                      illustration="clipboard"
                      title="No Open Missions"
                      description="Team GPE has not published active challenges for this season yet."
                      action={<CampButton variant="outline" onClick={load} type="button">Refresh</CampButton>}
                    />
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Challenge type filters">
                        {typeFilters.map((filter) => (
                          <Button
                            key={filter.value}
                            type="button"
                            role="tab"
                            aria-selected={activeType === filter.value}
                            variant={activeType === filter.value ? "default" : "outline"}
                            onClick={() => setActiveType(filter.value)}
                          >
                            {filter.label}
                          </Button>
                        ))}
                      </div>
                      {challengeWeeks.length === 0 ? (
                        <EmptyState
                          illustration="clipboard"
                          title="No Matching Missions"
                          description="No Camp GPE challenges match this type yet."
                        />
                      ) : challengeWeeks.map((week, weekIndex) => (
                        <section key={week.key} className="space-y-4">
                          <div className="flex flex-col gap-2 rounded-[1.5rem] border-[3px] border-black bg-white p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-header text-3xl uppercase">
                                {week.weekNumber ? `Weeks ${week.weekNumber}-${week.weekNumber + 1}` : "Seasonal Missions"}
                              </div>
                              {week.theme ? <p className="font-bold text-black/70">{week.theme}</p> : null}
                            </div>
                            <Sticker accent={(["cyan", "yellow", "orange", "pink"] as const)[weekIndex % 4]} rotate="none">
                              {week.window}
                            </Sticker>
                          </div>
                          <div className="grid gap-5 md:grid-cols-2">
                            {week.items.map((challenge, index) => {
                              const completed = completionCounts[challenge.id] || 0;
                              const limitReached = completed >= challenge.max_completions_per_member || (!challenge.allow_multiple_submissions && completed > 0);
                              const selectedNow = selected.includes(challenge.id);
                              const accent = (["cyan", "yellow", "orange", "white"] as const)[(index + weekIndex) % 4];
                              const status = challengeStatus(challenge, completed, selectedNow);
                              return (
                                <ChallengeCard
                                  key={challenge.id}
                                  title={challenge.icon ? `${challenge.icon} ${challenge.title}` : challenge.title}
                                  description={challenge.short_description}
                                  points={challenge.point_value == null ? "Points pending" : `${challenge.point_value} points`}
                                  category={challenge.category.replaceAll("_", " ")}
                                  deadline={challengeWindow(challenge)}
                                  difficulty={challenge.is_featured ? "Featured" : challenge.submission_type?.replaceAll("_", " ")}
                                  estimatedTime={challenge.cta_label || "Details"}
                                  status={status}
                                  progress={limitReached ? 100 : selectedNow ? 50 : 0}
                                  accent={accent}
                                  selected={selectedNow}
                                  disabled={limitReached}
                                  action={
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        variant={selectedNow ? "default" : "outline"}
                                        size="sm"
                                        disabled={limitReached}
                                        onClick={() => toggleChallenge(challenge)}
                                      >
                                        {selectedNow ? "Selected" : "Select"}
                                      </Button>
                                      <Link to={`/camp-gpe/challenges/${challenge.slug}`}>
                                        <Button type="button" variant="sticker" size="sm">Open Details</Button>
                                      </Link>
                                    </div>
                                  }
                                />
                              );
                            })}
                          </div>
                        </section>
                      ))}
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
