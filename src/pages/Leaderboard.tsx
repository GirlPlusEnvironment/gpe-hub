import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, CalendarDays, Loader2, Shield, Trophy, Users, Zap } from "lucide-react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { UserProfileCard } from "@/components/UserProfileCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type CampLeaderboardRow,
  type CampPointsLedgerRow,
  type CampSeason,
  type CampSeasonMember,
  type CampSubmission,
  getActiveCampSeason,
  getCampLeaderboard,
  getMyCampHistory,
  getMyCampStatus,
} from "@/lib/camp";
import { getLeaderboard } from "@/lib/points";
import { canManageCamp, isAdmin as checkIsAdmin } from "@/lib/roles";

type LeaderboardTab = "main" | "seasonal";
type TimeRange = "all" | "7d" | "30d";

type LeaderboardUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar?: string;
  points: number;
  level: number;
  rank: number;
};

const LEVELS = [
  { level: 1, threshold: 0, color: "bg-gray-200" },
  { level: 2, threshold: 100, color: "bg-blue-200" },
  { level: 3, threshold: 500, color: "bg-green-200" },
  { level: 4, threshold: 1000, color: "bg-purple-200" },
  { level: 5, threshold: 2000, color: "bg-amber-300" },
];

const statusLabel: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Not approved",
  needs_info: "Needs info",
};

function getRankMedal(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Trophy className="h-5 w-5 text-amber-600" />;
  return <Award className="h-5 w-5 text-muted-foreground" />;
}

function getLevelColor(level: number) {
  return (LEVELS.find((entry) => entry.level === level) ?? LEVELS[0]).color;
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("main");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [mainLeaderboard, setMainLeaderboard] = useState<LeaderboardUser[]>([]);
  const [mainLoading, setMainLoading] = useState(true);
  const [mainError, setMainError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [season, setSeason] = useState<CampSeason | null>(null);
  const [seasonalLeaderboard, setSeasonalLeaderboard] = useState<CampLeaderboardRow[]>([]);
  const [memberStatus, setMemberStatus] = useState<CampSeasonMember | null>(null);
  const [submissions, setSubmissions] = useState<CampSubmission[]>([]);
  const [ledger, setLedger] = useState<CampPointsLedgerRow[]>([]);
  const [seasonalLoading, setSeasonalLoading] = useState(false);
  const [seasonalLoaded, setSeasonalLoaded] = useState(false);
  const [seasonalError, setSeasonalError] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState<"member" | "team_gpe" | "admin">("member");

  const seasonalTitle = season?.name || "Camp GPE";
  const totalSeasonalPoints = useMemo(
    () => ledger.filter((row) => !row.reversed_at).reduce((sum, row) => sum + row.points, 0),
    [ledger],
  );

  const loadRole = useCallback(async () => {
    try {
      if (await checkIsAdmin()) setAccountRole("admin");
      else if (await canManageCamp()) setAccountRole("team_gpe");
      else setAccountRole("member");
    } catch {
      setAccountRole("member");
    }
  }, []);

  const loadMainLeaderboard = useCallback(async () => {
    setMainLoading(true);
    setMainError(null);
    try {
      const data = await getLeaderboard(timeRange, 10);
      setMainLeaderboard(data);
    } catch (err) {
      setMainError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    } finally {
      setMainLoading(false);
    }
  }, [timeRange]);

  const loadSeasonalLeaderboard = useCallback(async () => {
    setSeasonalLoading(true);
    setSeasonalError(null);
    try {
      const active = await getActiveCampSeason();
      setSeason(active);
      if (!active) {
        setSeasonalLeaderboard([]);
        setMemberStatus(null);
        setSubmissions([]);
        setLedger([]);
        setSeasonalLoaded(true);
        return;
      }
      const [boardRows, status, history] = await Promise.all([
        getCampLeaderboard(active.id, 50),
        getMyCampStatus(active.id),
        getMyCampHistory(active.id),
      ]);
      setSeasonalLeaderboard(boardRows);
      setMemberStatus(status as CampSeasonMember | null);
      setSubmissions(history.submissions);
      setLedger(history.ledger);
      setSeasonalLoaded(true);
    } catch (err) {
      setSeasonalError(err instanceof Error ? err.message : "Seasonal leaderboard could not be loaded.");
    } finally {
      setSeasonalLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMainLeaderboard();
  }, [loadMainLeaderboard]);

  useEffect(() => {
    void loadRole();
  }, [loadRole]);

  useEffect(() => {
    if (activeTab === "seasonal" && !seasonalLoaded && !seasonalLoading) {
      void loadSeasonalLeaderboard();
    }
  }, [activeTab, loadSeasonalLeaderboard, seasonalLoaded, seasonalLoading]);

  function openProfile(userId: string) {
    setSelectedUserId(userId);
    setIsProfileOpen(true);
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
                Leaderboard
              </div>
              <h1 className="gpe-heading text-4xl md:text-6xl">GPE Leaderboard</h1>
              <p className="mt-3 max-w-2xl text-sm font-bold text-black/70">
                Track year-round GPE Hub participation and seasonal campaign rankings in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {accountRole !== "member" ? (
                <Badge className="border-[3px] border-black bg-cyan-200 px-4 py-2 text-black">
                  <Shield className="mr-2 h-4 w-4" />
                  {accountRole === "admin" ? "Admin" : "Team GPE"}
                </Badge>
              ) : null}
              <Link to="/"><Button variant="outline">Dashboard</Button></Link>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeaderboardTab)}>
            <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-[1.5rem] border-[3px] border-black bg-white p-2 sm:grid-cols-2">
              <TabsTrigger className="rounded-[1rem] py-3 font-black uppercase data-[state=active]:bg-black data-[state=active]:text-white" value="main">
                Main Leaderboard
              </TabsTrigger>
              <TabsTrigger className="rounded-[1rem] py-3 font-black uppercase data-[state=active]:bg-black data-[state=active]:text-white" value="seasonal">
                Seasonal Leaderboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="main" className="mt-8 space-y-8">
              <MainLeaderboardPanel
                error={mainError}
                isLoading={mainLoading}
                leaderboard={mainLeaderboard}
                onRefresh={loadMainLeaderboard}
                onSelectUser={openProfile}
                setTimeRange={setTimeRange}
                timeRange={timeRange}
              />
            </TabsContent>

            <TabsContent value="seasonal" className="mt-8 space-y-8">
              <SeasonalLeaderboardPanel
                error={seasonalError}
                isLoading={seasonalLoading}
                ledger={ledger}
                memberStatus={memberStatus}
                onRefresh={() => {
                  setSeasonalLoaded(false);
                  void loadSeasonalLeaderboard();
                }}
                season={season}
                seasonalLeaderboard={seasonalLeaderboard}
                seasonalTitle={seasonalTitle}
                submissions={submissions}
                totalSeasonalPoints={totalSeasonalPoints}
              />
            </TabsContent>
          </Tabs>

          <TeamAccountHelp />
        </div>
      </main>
      <Footer />

      {selectedUserId ? (
        <UserProfileCard userId={selectedUserId} open={isProfileOpen} onOpenChange={setIsProfileOpen} />
      ) : null}
    </div>
  );
}

function MainLeaderboardPanel({
  error,
  isLoading,
  leaderboard,
  onRefresh,
  onSelectUser,
  setTimeRange,
  timeRange,
}: {
  error: string | null;
  isLoading: boolean;
  leaderboard: LeaderboardUser[];
  onRefresh: () => void;
  onSelectUser: (userId: string) => void;
  setTimeRange: (range: TimeRange) => void;
  timeRange: TimeRange;
}) {
  return (
    <>
      <div className="text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Zap className="h-8 w-8 text-primary" />
          <h2 className="gpe-heading text-3xl md:text-5xl">Community Leaderboard</h2>
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <p className="mx-auto max-w-2xl text-base font-bold text-black/70">
          Celebrate members earning general Hub points through posts, comments, listings, messages, and community participation.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {(["all", "30d", "7d"] as const).map((range) => (
          <Button
            key={range}
            variant={timeRange === range ? "default" : "outline"}
            onClick={() => setTimeRange(range)}
            className="uppercase tracking-wide"
          >
            {range === "all" ? "All Time" : range === "7d" ? "This Week" : "This Month"}
          </Button>
        ))}
        <Button variant="outline" onClick={onRefresh}>Refresh</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Member Rankings</CardTitle>
          <CardDescription>
            {timeRange === "all" && "All-time points from profiles.points."}
            {timeRange === "7d" && "Points earned from point_transactions in the last 7 days."}
            {timeRange === "30d" && "Points earned from point_transactions in the last 30 days."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="mb-2 font-bold text-destructive">Failed to load leaderboard</p>
              <p className="text-sm font-bold text-muted-foreground">{error}</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-black/60">
              No general rankings are available for this time period.
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-[1.5rem] border-[3px] border-black bg-white p-4 text-left transition-colors hover:bg-pink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => onSelectUser(user.id)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex w-8 items-center justify-center text-center">
                      {user.rank <= 3 ? getRankMedal(user.rank) : <span className="font-semibold text-muted-foreground">#{user.rank}</span>}
                    </div>
                    <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                      <AvatarImage src={user.avatar || ""} />
                      <AvatarFallback className="bg-primary/10">
                        {user.full_name?.charAt(0) || user.username?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-foreground">
                          {user.full_name || user.username || "Unknown"}
                        </span>
                        <Badge className={`${getLevelColor(user.level)} text-xs font-semibold text-foreground`}>
                          Level {user.level}
                        </Badge>
                      </div>
                      {user.username && user.username !== user.full_name ? (
                        <div className="mt-0.5 text-sm text-muted-foreground">@{user.username}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-2xl font-bold text-primary">{user.points}</div>
                    <div className="text-xs text-muted-foreground">pts</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Level Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
              {LEVELS.map((entry) => (
                <div key={entry.level} className="rounded-[1.5rem] border-[3px] border-black bg-white p-4 text-center">
                  <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${entry.color} text-lg font-bold`}>
                    {entry.level}
                  </div>
                  <div className="font-semibold text-foreground">Level {entry.level}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{entry.threshold.toLocaleString()}+ pts</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How to Earn Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["+1", "Like a Post", "Appreciate community content"],
                ["+1", "Favorite a Listing", "Save listings you are interested in"],
                ["+2", "Leave a Comment", "Share your thoughts and insights"],
                ["+10", "Create a Post", "Contribute new discussions"],
                ["+3", "Make a Submission", "Create a listing on the explore page"],
                ["+1", "Send Messages", "Talk with other Hub members"],
              ].map(([points, title, description]) => (
                <div key={title} className="flex items-start gap-3">
                  <Badge className="mt-1 bg-primary text-primary-foreground">{points}</Badge>
                  <div>
                    <div className="font-medium">{title}</div>
                    <div className="text-sm text-muted-foreground">{description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SeasonalLeaderboardPanel({
  error,
  isLoading,
  ledger,
  memberStatus,
  onRefresh,
  season,
  seasonalLeaderboard,
  seasonalTitle,
  submissions,
  totalSeasonalPoints,
}: {
  error: string | null;
  isLoading: boolean;
  ledger: CampPointsLedgerRow[];
  memberStatus: CampSeasonMember | null;
  onRefresh: () => void;
  season: CampSeason | null;
  seasonalLeaderboard: CampLeaderboardRow[];
  seasonalTitle: string;
  submissions: CampSubmission[];
  totalSeasonalPoints: number;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500 bg-red-100">
        <CardContent className="py-8 text-sm font-bold text-red-700">{error}</CardContent>
      </Card>
    );
  }

  if (!season) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seasonal Leaderboard</CardTitle>
          <CardDescription>Season rankings are not available yet.</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-sm font-bold text-black/70">
          No active seasonal campaign is configured yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="gpe-heading text-3xl md:text-5xl">Seasonal Leaderboard</h2>
          <p className="mt-3 max-w-2xl text-sm font-bold text-black/70">
            {seasonalTitle} points are campaign-specific. Submissions appear in your history after they are saved, and points are added after Team GPE review.
          </p>
        </div>
        <Button variant="outline" onClick={onRefresh}>Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5" />
              Season
            </CardTitle>
            <CardDescription>{season.status}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-black">{seasonalTitle}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              My Season Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{memberStatus?.status || "Not linked"}</div>
            <p className="mt-2 text-xs font-bold text-black/60">
              {memberStatus?.gpe_cabins?.name ? `Cabin: ${memberStatus.gpe_cabins.name}` : "Join the current seasonal campaign from the public campaign page if your account is not linked yet."}
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
          <CardContent className="text-4xl font-black text-primary">{totalSeasonalPoints}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{seasonalTitle} Rankings</CardTitle>
          <CardDescription>Ranked by reviewed, unreversed points for this seasonal campaign.</CardDescription>
        </CardHeader>
        <CardContent>
          {seasonalLeaderboard.length === 0 ? (
            <div className="py-10 text-center text-sm font-bold text-black/60">
              Season rankings are not available yet.
            </div>
          ) : (
            <div className="space-y-3">
              {seasonalLeaderboard.map((row) => (
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
            <CardDescription>Submissions are reviewed before points appear on the seasonal leaderboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {submissions.length === 0 ? (
              <p className="text-sm font-bold text-black/60">No seasonal challenge submissions are linked to this Hub account yet.</p>
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
              <p className="text-sm font-bold text-black/60">No reviewed seasonal points yet.</p>
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
  );
}

function TeamAccountHelp() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Team Account Access
        </CardTitle>
        <CardDescription>Team permissions are backend-managed through Supabase roles.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm font-bold text-black/70">
        <p>To upgrade a member to a Team GPE account:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Open Supabase for the GPE Hub project.</li>
          <li>Find the member in the <code>profiles</code> table by email or user ID.</li>
          <li>Insert a row in <code>user_roles</code> with <code>user_id</code> set to that profile ID and <code>role</code> set to <code>team_gpe</code>.</li>
          <li>Set <code>granted_by</code> to the granting admin profile ID when available and leave <code>revoked_at</code> empty.</li>
          <li>Ask the member to refresh or sign out and back in.</li>
          <li>Confirm the Team GPE badge and Camp Admin navigation appear.</li>
        </ol>
        <p>
          Admin accounts use the same <code>user_roles.role</code> field with <code>admin</code>. The browser checks <code>has_role</code>, <code>can_manage_camp</code>, and <code>is_admin</code>; backend RLS and RPC policies still enforce access.
        </p>
      </CardContent>
    </Card>
  );
}
