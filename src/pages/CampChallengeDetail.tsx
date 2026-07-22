import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Share2, Trophy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CampButton,
  EmptyState,
  LoadingCampCard,
  SectionHeader,
  StatSticker,
  Sticker,
  Tape,
} from "@/components/camp/CampDesign";
import {
  type CampChallenge,
  type CampPointsLedgerRow,
  type CampSeason,
  getActiveCampSeason,
  getHubCampChallengeBySlug,
  getHubCampChallenges,
  getMyCampHistory,
} from "@/lib/camp";

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function fullDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function normalizeUrl(url: string | null | undefined) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

function challengeWindow(challenge: CampChallenge) {
  const start = formatDate(challenge.starts_at);
  const end = formatDate(challenge.ends_at);
  if (start && end) return `${start} - ${end}`;
  return start || end || "Seasonal";
}

function challengeAvailability(challenge: CampChallenge) {
  const now = Date.now();
  const start = challenge.starts_at ? new Date(challenge.starts_at).getTime() : null;
  const end = challenge.ends_at ? new Date(challenge.ends_at).getTime() : null;
  if (start && now < start) return "Upcoming";
  if (end && now > end) return "Closed";
  return "Open";
}

function categoryLabel(value: string | null | undefined) {
  return String(value || "challenge").replaceAll("_", " ");
}

function submissionLabel(challenge: CampChallenge) {
  const type = String(challenge.submission_type || challenge.category || "").toLowerCase();
  if (type.includes("petition")) return "Complete the petition action, then submit this challenge if points are not awarded automatically.";
  if (type.includes("video")) return "Submit a video link, post link, or screenshot that shows what you created.";
  if (type.includes("social") || type.includes("story")) return "Submit a social post link, story screenshot, or a short note describing the post.";
  if (type.includes("reflection")) return "Submit a written reflection, video, or social post for Team GPE review.";
  return "Submit proof, a link, or context so Team GPE can review the action.";
}

export default function CampChallengeDetail() {
  const { challengeSlug } = useParams();
  const navigate = useNavigate();
  const [season, setSeason] = useState<CampSeason | null>(null);
  const [challenge, setChallenge] = useState<CampChallenge | null>(null);
  const [related, setRelated] = useState<CampChallenge[]>([]);
  const [ledger, setLedger] = useState<CampPointsLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [challengeSlug]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const active = await getActiveCampSeason();
      setSeason(active);
      if (!active || !challengeSlug) {
        setChallenge(null);
        return;
      }
      const [challengeRow, allChallenges, history] = await Promise.all([
        getHubCampChallengeBySlug(active.id, challengeSlug),
        getHubCampChallenges(active.id),
        getMyCampHistory(active.id),
      ]);
      setChallenge(challengeRow);
      setLedger(history.ledger);
      setRelated(
        allChallenges
          .filter((item) => item.slug !== challengeSlug)
          .map((item) => ({
            item,
            score:
              (item.week_number && item.week_number === challengeRow?.week_number ? 3 : 0) +
              (item.category === challengeRow?.category ? 2 : 0) +
              (item.theme && item.theme === challengeRow?.theme ? 1 : 0),
          }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score || a.item.display_order - b.item.display_order)
          .slice(0, 3)
          .map(({ item }) => item),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Challenge details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  const completed = useMemo(() => {
    if (!challenge) return false;
    return ledger.some((row) => row.challenge_id === challenge.id && !row.reversed_at && row.entry_type === "challenge_award");
  }, [challenge, ledger]);

  const externalUrl = normalizeUrl(challenge?.related_url || challenge?.action_url);
  const availability = challenge ? challengeAvailability(challenge) : "Open";
  const submitHref = challenge ? `/camp-gpe/challenges?challenge=${encodeURIComponent(challenge.slug)}` : "/camp-gpe/challenges";
  const externalCta = challenge?.cta_label || (challenge?.category === "sign_petition" ? "Open Petition" : "Open Action");
  const usesExternalCta = Boolean(externalUrl) && (challenge?.related_kind === "petition" || challenge?.submission_type === "petition" || challenge?.action_url);

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main space-y-8">
        <div className="mx-auto max-w-6xl space-y-8">
          {loading ? (
            <LoadingCampCard label="Loading challenge details" />
          ) : error ? (
            <EmptyState
              illustration="clipboard"
              title="Challenge Error"
              description={error}
              action={<CampButton variant="outline" onClick={load}>Try Again</CampButton>}
            />
          ) : !season ? (
            <EmptyState
              illustration="campfire"
              title="Between Seasons"
              description="There is no active Camp GPE season right now."
              action={<Link to="/leaderboard"><CampButton variant="outline">View Leaderboard</CampButton></Link>}
            />
          ) : !challenge ? (
            <EmptyState
              illustration="clipboard"
              title="Challenge Not Found"
              description="This challenge link does not match a visible Camp GPE challenge."
              action={<Link to="/camp-gpe/challenges"><CampButton variant="outline">Back to Challenges</CampButton></Link>}
            />
          ) : (
            <>
              <SectionHeader
                eyebrow={<Sticker accent="cyan">Week {challenge.week_number || "Season"}</Sticker>}
                title={challenge.title}
                description={challenge.short_description || challenge.theme || "Camp GPE seasonal challenge."}
                action={
                  <>
                    <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(window.location.href);
                      }}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                  </>
                }
              />

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <Card className="gpe-paper">
                    <CardHeader>
                      <Tape>{challenge.theme || season.name}</Tape>
                      <CardTitle className="font-header text-4xl uppercase">{challenge.icon ? `${challenge.icon} ` : ""}{challenge.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {challenge.why_it_matters ? (
                        <div>
                          <h2 className="font-header text-2xl uppercase">Why It Matters</h2>
                          <p className="mt-2 font-bold text-black/75">{challenge.why_it_matters}</p>
                        </div>
                      ) : null}
                      {challenge.instructions ? (
                        <div>
                          <h2 className="font-header text-2xl uppercase">How to Complete It</h2>
                          <p className="mt-2 whitespace-pre-line font-bold text-black/75">{challenge.instructions}</p>
                        </div>
                      ) : null}
                      <div>
                        <h2 className="font-header text-2xl uppercase">Submission Requirements</h2>
                        <p className="mt-2 font-bold text-black/75">{submissionLabel(challenge)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Sticker accent="yellow" rotate="none">{availability}</Sticker>
                        <Sticker accent="cyan" rotate="none">{challengeWindow(challenge)}</Sticker>
                        <Sticker accent="white" rotate="none">{categoryLabel(challenge.category)}</Sticker>
                        {challenge.badge_eligible ? <Sticker accent="orange" rotate="none">Badge eligible</Sticker> : null}
                        {completed ? <Sticker accent="pink" rotate="none">Earned</Sticker> : null}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Related Camp Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {related.length === 0 ? (
                        <p className="font-bold text-black/65">Related challenges will appear here as Team GPE connects more seasonal content.</p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-3">
                          {related.map((item) => (
                            <Link
                              key={item.id}
                              to={`/camp-gpe/challenges/${item.slug}`}
                              className="gpe-card-sm gpe-hover-lift block bg-white p-4"
                            >
                              <div className="font-header text-xl uppercase">{item.title}</div>
                              <div className="mt-2 text-xs font-black uppercase text-black/60">
                                Week {item.week_number || "Season"} · {item.point_value ?? 0} point{item.point_value === 1 ? "" : "s"}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <aside className="space-y-4">
                  <StatSticker label="Points" value={challenge.point_value == null ? "Pending" : challenge.point_value.toLocaleString()} accent="yellow" />
                  <StatSticker label="Status" value={completed ? "Earned" : availability} accent={completed ? "pink" : "cyan"} />
                  <StatSticker label="Window" value={challengeWindow(challenge)} accent="orange" />

                  <Card className="border-[4px] border-black">
                    <CardContent className="space-y-3 p-5">
                      {usesExternalCta && externalUrl ? (
                        <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                          <CampButton className="w-full justify-center" variant="secondary">
                            {externalCta} <ExternalLink className="ml-2 h-4 w-4" />
                          </CampButton>
                        </a>
                      ) : (
                        <Link to={submitHref}>
                          <CampButton className="w-full justify-center" variant="secondary">Open Submission Flow</CampButton>
                        </Link>
                      )}
                      <Link to={submitHref}>
                        <CampButton className="w-full justify-center" variant="outline">
                          <Trophy className="mr-2 h-4 w-4" />
                          Submit for Points
                        </CampButton>
                      </Link>
                      <Link to="/camp-gpe/challenges">
                        <CampButton className="w-full justify-center" variant="yellow">
                          Back to Challenges
                        </CampButton>
                      </Link>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="space-y-2 p-5 text-sm font-bold">
                      <div><span className="font-black">Start:</span> {fullDate(challenge.starts_at) || "Seasonal"}</div>
                      <div><span className="font-black">End:</span> {fullDate(challenge.ends_at) || "Seasonal"}</div>
                      <div><span className="font-black">Verification:</span> {categoryLabel(challenge.verification_method || "team_review")}</div>
                      <div><span className="font-black">Progress:</span> {completed ? "Completed and awarded" : "Not earned yet"}</div>
                    </CardContent>
                  </Card>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
