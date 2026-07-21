import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, CalendarDays, Loader2, Trophy, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type CampLeaderboardRow,
  type CampPointsLedgerRow,
  type CampSeason,
  type CampSubmission,
  getActiveCampSeason,
  getCampLeaderboard,
  getMyCampHistory,
  getMyCampStatus,
} from "@/lib/camp";

const statusLabel: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Not approved",
  needs_info: "Needs info",
};

export default function Leaderboard() {
  const [season, setSeason] = useState<CampSeason | null>(null);
  const [leaderboard, setLeaderboard] = useState<CampLeaderboardRow[]>([]);
  const [memberStatus, setMemberStatus] = useState<any>(null);
  const [submissions, setSubmissions] = useState<CampSubmission[]>([]);
  const [ledger, setLedger] = useState<CampPointsLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPoints = useMemo(
    () => ledger.filter((row) => !row.reversed_at).reduce((sum, row) => sum + row.points, 0),
    [ledger],
  );

  useEffect(() => {
    void loadCamp();
  }, []);

  async function loadCamp() {
    setLoading(true);
    setError(null);
    try {
      const active = await getActiveCampSeason();
      setSeason(active);
      if (!active) return;
      const [boardRows, status, history] = await Promise.all([
        getCampLeaderboard(active.id, 50),
        getMyCampStatus(active.id),
        getMyCampHistory(active.id),
      ]);
      setLeaderboard(boardRows);
      setMemberStatus(status);
      setSubmissions(history.submissions);
      setLedger(history.ledger);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camp GPE could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border-[3px] border-black bg-yellow-200 px-4 py-2 text-xs font-black uppercase">
                <Trophy className="h-4 w-4" />
                Camp GPE
              </div>
              <h1 className="gpe-heading text-4xl md:text-6xl">Season Leaderboard</h1>
              <p className="mt-3 max-w-2xl text-sm font-bold text-black/70">
                {season?.name || "Camp GPE"} points are season-specific. Challenge submissions appear in your history after they are saved, and points are added after Team GPE review.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadCamp}>Refresh</Button>
              <Link to="/"><Button variant="outline">Dashboard</Button></Link>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="border-red-500 bg-red-100">
              <CardContent className="py-8 text-sm font-bold text-red-700">{error}</CardContent>
            </Card>
          ) : !season ? (
            <Card>
              <CardContent className="py-8 text-sm font-bold text-black/70">
                No visible Camp GPE season is configured yet.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CalendarDays className="h-5 w-5" />
                      Season
                    </CardTitle>
                    <CardDescription>{season.status}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-2xl font-black">{season.name}</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5" />
                      My Camp Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black">{memberStatus?.status || "Not linked"}</div>
                    <p className="mt-2 text-xs font-bold text-black/60">
                      {memberStatus?.gpe_cabins?.name ? `Cabin: ${memberStatus.gpe_cabins.name}` : "Join Camp GPE from the public Camp page if your account is not linked yet."}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Award className="h-5 w-5" />
                      My Points
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-4xl font-black text-primary">{totalPoints}</CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Leaderboard</CardTitle>
                  <CardDescription>Ranked by reviewed, unreversed points for this Camp season.</CardDescription>
                </CardHeader>
                <CardContent>
                  {leaderboard.length === 0 ? (
                    <div className="py-10 text-center text-sm font-bold text-black/60">
                      No Camp points have been awarded yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaderboard.map((row) => (
                        <div key={row.season_member_id} className="flex items-center justify-between gap-4 rounded-[1.5rem] border-[3px] border-black bg-white p-4">
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="w-10 text-center text-xl font-black">#{row.rank}</div>
                            <Avatar className="h-12 w-12 border-[3px] border-black">
                              <AvatarImage src={row.avatar_url || undefined} />
                              <AvatarFallback className="bg-cyan-200 font-black">
                                {(row.full_name || row.username || row.contact_email).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate font-black">{row.full_name || row.username || row.contact_email}</div>
                              <div className="text-xs font-bold uppercase text-black/60">{row.cabin_name || "No cabin yet"}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-black text-primary">{row.points}</div>
                            <div className="text-xs font-bold uppercase text-black/50">points</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>My Challenge History</CardTitle>
                    <CardDescription>Submissions are reviewed before points appear on the leaderboard.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {submissions.length === 0 ? (
                      <p className="text-sm font-bold text-black/60">No challenge submissions are linked to this Hub account yet.</p>
                    ) : submissions.map((submission) => (
                      <div key={submission.id} className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-black">{submission.challenge_key.replaceAll("_", " ")}</div>
                          <Badge>{statusLabel[submission.review_status] || submission.review_status}</Badge>
                        </div>
                        <div className="mt-2 text-xs font-bold text-black/60">
                          {new Date(submission.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>My Point Ledger</CardTitle>
                    <CardDescription>Corrections and reversals are preserved for auditability.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ledger.length === 0 ? (
                      <p className="text-sm font-bold text-black/60">No reviewed points yet.</p>
                    ) : ledger.map((row) => (
                      <div key={row.id} className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-black">{row.reason}</div>
                          <div className={row.reversed_at ? "font-black text-black/40 line-through" : "font-black text-primary"}>
                            {row.points > 0 ? "+" : ""}{row.points}
                          </div>
                        </div>
                        <div className="mt-2 text-xs font-bold uppercase text-black/60">{row.adjustment_type}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
