import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, BadgeCheck, Clock, Loader2, Medal, Search, Shield, Sparkles, Trophy, Users, Zap } from "lucide-react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { UserProfileCard } from "@/components/UserProfileCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ActivityItem,
  BadgeToken,
  CabinCard,
  CampButton,
  CampProgress,
  ChallengeCard,
  CountdownStateCard,
  EmptyState,
  LoadingCampCard,
  MarqueeStrip,
  PodiumCard,
  PrizeCard,
  SectionHeader,
  StatSticker,
  Sticker,
  Tape,
} from "@/components/camp/CampDesign";
import { useAuth } from "@/hooks/useAuth";
import {
  type CampCabinLeaderboardRow,
  type CampChallenge,
  type CampLeaderboardRow,
  type CampPointsLedgerRow,
  type CampRecentActivityRow,
  type CampSeason,
  type CampSeasonMember,
  type CampSubmission,
  getActiveCampSeason,
  getCampCabinLeaderboard,
  getCampLeaderboard,
  getCampRecentActivity,
  getHubCampChallenges,
  getMyCampHistory,
  getMyCampStatus,
} from "@/lib/camp";
import { getLeaderboard } from "@/lib/points";
import { reviewStatusLabel } from "@/lib/review-status";
import { canManageCamp, isAdmin as checkIsAdmin } from "@/lib/roles";

type LeaderboardTab = "all-time" | "seasonal" | "cabins" | "badges";
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

function getRankMedal(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Trophy className="h-5 w-5 text-amber-600" />;
  return <Award className="h-5 w-5 text-muted-foreground" />;
}

function getLevelColor(level: number) {
  return (LEVELS.find((entry) => entry.level === level) ?? LEVELS[0]).color;
}

function daysBetween(target: string | null | undefined) {
  if (!target) return null;
  return Math.ceil((new Date(target).getTime() - Date.now()) / 86400000);
}

function seasonCountdownLabel(season: CampSeason | null) {
  if (!season) return "No active season";
  const startsIn = daysBetween(season.starts_at);
  const endsIn = daysBetween(season.ends_at);
  if (startsIn !== null && startsIn > 0) return `Starts in ${startsIn} day${startsIn === 1 ? "" : "s"}`;
  if (endsIn !== null && endsIn >= 0) return `${endsIn} day${endsIn === 1 ? "" : "s"} left`;
  if (season.ends_at) return "Season complete";
  return "Season active";
}

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function parsePrizes(season: CampSeason | null): Array<{ title: string; description: string }> {
  const prizes = season?.point_rules?.prizes;
  if (!Array.isArray(prizes)) return [];
  return prizes
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title : typeof record.name === "string" ? record.name : "";
      const description = typeof record.description === "string" ? record.description : typeof record.detail === "string" ? record.detail : "";
      if (!title.trim()) return null;
      return { title, description };
    })
    .filter((entry): entry is { title: string; description: string } => Boolean(entry));
}

function rankMovementLabel(_row: CampLeaderboardRow) {
  return "-";
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("all-time");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [mainLeaderboard, setMainLeaderboard] = useState<LeaderboardUser[]>([]);
  const [mainLoading, setMainLoading] = useState(true);
  const [mainError, setMainError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [season, setSeason] = useState<CampSeason | null>(null);
  const [seasonalLeaderboard, setSeasonalLeaderboard] = useState<CampLeaderboardRow[]>([]);
  const [cabinLeaderboard, setCabinLeaderboard] = useState<CampCabinLeaderboardRow[]>([]);
  const [challenges, setChallenges] = useState<CampChallenge[]>([]);
  const [recentActivity, setRecentActivity] = useState<CampRecentActivityRow[]>([]);
  const [memberStatus, setMemberStatus] = useState<CampSeasonMember | null>(null);
  const [submissions, setSubmissions] = useState<CampSubmission[]>([]);
  const [ledger, setLedger] = useState<CampPointsLedgerRow[]>([]);
  const [seasonalLoading, setSeasonalLoading] = useState(false);
  const [seasonalLoaded, setSeasonalLoaded] = useState(false);
  const [seasonalError, setSeasonalError] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState<"member" | "team_gpe" | "admin">("member");

  const seasonalTitle = season?.name || "Current Season";
  const totalSeasonalPoints = useMemo(
    () => ledger.filter((row) => !row.reversed_at).reduce((sum, row) => sum + row.points, 0),
    [ledger],
  );
  const headerCopy = useMemo(() => {
    if (activeTab === "seasonal") return {
      title: "Current Season",
      description: `${seasonalTitle} competition dashboard with live rankings, cabin totals, challenge progress, and reviewed activity.`,
    };
    if (activeTab === "cabins") return {
      title: "Cabin Leaderboard",
      description: "Current-season cabin totals based only on approved and unreversed seasonal points.",
    };
    if (activeTab === "badges") return {
      title: "Badge Board",
      description: "Achievement-style previews based on real points and approved challenge counts.",
    };
    return {
      title: "All-Time Leaderboard",
      description: "Permanent GPE Hub rankings for year-round community participation.",
    };
  }, [activeTab, seasonalTitle]);

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
        setCabinLeaderboard([]);
        setChallenges([]);
        setRecentActivity([]);
        setMemberStatus(null);
        setSubmissions([]);
        setLedger([]);
        setSeasonalLoaded(true);
        return;
      }
      const [boardRows, cabinRows, challengeRows, activityRows, status, history] = await Promise.all([
        getCampLeaderboard(active.id, 50),
        getCampCabinLeaderboard(active.id),
        getHubCampChallenges(active.id),
        getCampRecentActivity(active.id, 12),
        getMyCampStatus(active.id),
        getMyCampHistory(active.id),
      ]);
      setSeasonalLeaderboard(boardRows);
      setCabinLeaderboard(cabinRows);
      setChallenges(challengeRows);
      setRecentActivity(activityRows);
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
    if ((activeTab === "seasonal" || activeTab === "cabins" || activeTab === "badges") && !seasonalLoaded && !seasonalLoading) {
      void loadSeasonalLeaderboard();
    }
  }, [activeTab, loadSeasonalLeaderboard, seasonalLoaded, seasonalLoading]);

  useEffect(() => {
    if (activeTab !== "seasonal" || !seasonalLoaded) return;
    const interval = window.setInterval(() => {
      void loadSeasonalLeaderboard();
    }, 45000);
    return () => window.clearInterval(interval);
  }, [activeTab, loadSeasonalLeaderboard, seasonalLoaded]);

  function openProfile(userId: string) {
    setSelectedUserId(userId);
    setIsProfileOpen(true);
  }

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <div className="mx-auto max-w-6xl space-y-8">
          <SectionHeader
            eyebrow={<Sticker accent="yellow"><Trophy className="mr-2 h-4 w-4" /> Leaderboard</Sticker>}
            title={headerCopy.title}
            description={headerCopy.description}
            action={
              <>
              {accountRole !== "member" ? (
                <Badge className="border-[3px] border-black bg-cyan-200 px-4 py-2 text-black">
                  <Shield className="mr-2 h-4 w-4" />
                  {accountRole === "admin" ? "Admin" : "Team GPE"}
                </Badge>
              ) : null}
              <Link to="/"><CampButton variant="outline">Dashboard</CampButton></Link>
              </>
            }
          />

          <MarqueeStrip>
            All-time rankings - current season - cabin totals - badge previews - reviewed points only
          </MarqueeStrip>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeaderboardTab)}>
            <TabsList className="grid h-auto w-full grid-cols-1 gap-3 rounded-[2rem] border-[4px] border-black bg-white p-3 shadow-gpe-sm sm:grid-cols-2 lg:grid-cols-4">
              <TabsTrigger className="rounded-[1.25rem] border-[3px] border-black py-3 font-black uppercase data-[state=active]:bg-black data-[state=active]:text-white data-[state=inactive]:bg-gpe-yellow" value="all-time">
                All-Time
              </TabsTrigger>
              <TabsTrigger className="rounded-[1.25rem] border-[3px] border-black py-3 font-black uppercase data-[state=active]:bg-black data-[state=active]:text-white data-[state=inactive]:bg-gpe-cyan" value="seasonal">
                Current Season
              </TabsTrigger>
              <TabsTrigger className="rounded-[1.25rem] border-[3px] border-black py-3 font-black uppercase data-[state=active]:bg-black data-[state=active]:text-white data-[state=inactive]:bg-gpe-orange" value="cabins">
                Cabins
              </TabsTrigger>
              <TabsTrigger className="rounded-[1.25rem] border-[3px] border-black py-3 font-black uppercase data-[state=active]:bg-black data-[state=active]:text-white data-[state=inactive]:bg-white" value="badges">
                Badges
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all-time" className="mt-8 space-y-8">
              <MainLeaderboardPanel
                error={mainError}
                isLoading={mainLoading}
                leaderboard={mainLeaderboard}
                currentUserId={user?.id || null}
                onRefresh={loadMainLeaderboard}
                onSelectUser={openProfile}
                setTimeRange={setTimeRange}
                timeRange={timeRange}
              />
            </TabsContent>

            <TabsContent value="seasonal" className="mt-8 space-y-8">
              <SeasonalLeaderboardPanel
                cabinLeaderboard={cabinLeaderboard}
                challenges={challenges}
                error={seasonalError}
                isLoading={seasonalLoading}
                ledger={ledger}
                memberStatus={memberStatus}
                onRefresh={() => {
                  setSeasonalLoaded(false);
                  void loadSeasonalLeaderboard();
                }}
                recentActivity={recentActivity}
                season={season}
                seasonalLeaderboard={seasonalLeaderboard}
                seasonalTitle={seasonalTitle}
                submissions={submissions}
                totalSeasonalPoints={totalSeasonalPoints}
              />
            </TabsContent>
            <TabsContent value="cabins" className="mt-8 space-y-8">
              <CabinsPanel
                cabinLeaderboard={cabinLeaderboard}
                error={seasonalError}
                isLoading={seasonalLoading}
                onRefresh={() => {
                  setSeasonalLoaded(false);
                  void loadSeasonalLeaderboard();
                }}
                season={season}
              />
            </TabsContent>
            <TabsContent value="badges" className="mt-8 space-y-8">
              <BadgesPanel
                leaderboard={seasonalLeaderboard}
                mainLeaderboard={mainLeaderboard}
                season={season}
              />
            </TabsContent>
          </Tabs>

          {accountRole !== "member" ? <TeamAccountHelp /> : null}
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
  currentUserId,
  onRefresh,
  onSelectUser,
  setTimeRange,
  timeRange,
}: {
  error: string | null;
  isLoading: boolean;
  leaderboard: LeaderboardUser[];
  currentUserId: string | null;
  onRefresh: () => void;
  onSelectUser: (userId: string) => void;
  setTimeRange: (range: TimeRange) => void;
  timeRange: TimeRange;
}) {
  const [search, setSearch] = useState("");
  const visibleLeaderboard = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return leaderboard;
    return leaderboard.filter((user) =>
      [user.full_name, user.username]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [leaderboard, search]);
  const podium = visibleLeaderboard.slice(0, 3);

  return (
    <>
      <SectionHeader
        eyebrow={<Sticker accent="pink"><Zap className="mr-2 h-4 w-4" /> Community XP</Sticker>}
        title="Community Leaderboard"
        description="Celebrate members earning general Hub points through posts, comments, listings, messages, and community participation."
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" />
          <input
            aria-label="Search leaderboard members"
            className="h-12 w-full rounded-full border-[4px] border-black bg-white pl-12 pr-4 text-sm font-bold shadow-gpe-sm outline-none focus:ring-4 focus:ring-gpe-cyan"
            placeholder="Search members"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          {(["all", "30d", "7d"] as const).map((range) => (
            <CampButton
              key={range}
              variant={timeRange === range ? "default" : "sticker"}
              onClick={() => setTimeRange(range)}
              className="uppercase tracking-wide"
            >
              {range === "all" ? "All Time" : range === "7d" ? "Week" : "Month"}
            </CampButton>
          ))}
          <CampButton variant="cyan" onClick={onRefresh}>Refresh</CampButton>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <Tape>Global rankings</Tape>
          <CardTitle className="text-xl">Member Rankings</CardTitle>
          <CardDescription>
            {timeRange === "all" && "All-time points from profiles.points."}
            {timeRange === "7d" && "Points earned from point_transactions in the last 7 days."}
            {timeRange === "30d" && "Points earned from point_transactions in the last 30 days."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 py-4 md:grid-cols-3">
              {[0, 1, 2].map((item) => <LoadingCampCard key={item} label="Loading leaderboard" />)}
            </div>
          ) : error ? (
            <EmptyState
              illustration="clipboard"
              title="Leaderboard is resting"
              description={error}
              action={<CampButton variant="outline" onClick={onRefresh}>Try Again</CampButton>}
            />
          ) : visibleLeaderboard.length === 0 ? (
            <EmptyState
              illustration="flag"
              title="No Rankings Yet"
              description="No members match this search or time period."
              action={<CampButton variant="outline" onClick={() => setSearch("")}>Clear Search</CampButton>}
            />
          ) : (
            <div className="space-y-3">
              {podium.length > 0 ? (
                <div className="mb-6 grid gap-4 md:grid-cols-3 md:items-end">
                  {podium.map((user) => (
                    <PodiumCard
                      key={user.id}
                      rank={user.rank}
                      name={user.full_name || user.username || "Unknown"}
                      detail={user.username ? `@${user.username}` : `Level ${user.level}`}
                      points={`${user.points.toLocaleString()} pts`}
                      accent={user.rank === 1 ? "yellow" : user.rank === 2 ? "cyan" : "pink"}
                    />
                  ))}
                </div>
              ) : null}
              {visibleLeaderboard.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-[1.75rem] border-[4px] border-black p-4 text-left shadow-gpe-sm transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-gpe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    user.rank === 1 ? "bg-gpe-yellow" : user.rank === 2 ? "bg-gpe-cyan" : user.rank === 3 ? "bg-[#fbd3d3]" : "bg-white"
                  } ${currentUserId === user.id ? "ring-4 ring-gpe-pink ring-offset-4 ring-offset-[#fbd3d3]" : ""}`}
                  onClick={() => onSelectUser(user.id)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex w-10 items-center justify-center text-center font-header text-2xl">
                      {user.rank <= 3 ? getRankMedal(user.rank) : <span className="font-semibold text-muted-foreground">#{user.rank}</span>}
                    </div>
                    <Avatar className="h-14 w-14 border-[3px] border-black">
                      <AvatarImage src={user.avatar || ""} />
                      <AvatarFallback className="bg-white font-black">
                        {user.full_name?.charAt(0) || user.username?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-black text-foreground">
                          {user.full_name || user.username || "Unknown"}
                        </span>
                        <Badge className={`${getLevelColor(user.level)} border-2 border-black text-xs font-black text-foreground`}>
                          Level {user.level}
                        </Badge>
                        {currentUserId === user.id ? (
                          <Badge className="border-2 border-black bg-gpe-pink text-white">You</Badge>
                        ) : null}
                      </div>
                      {user.username && user.username !== user.full_name ? (
                        <div className="mt-0.5 text-sm text-muted-foreground">@{user.username}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="font-header text-3xl text-black">{user.points}</div>
                    <div className="text-xs font-black uppercase text-black/60">pts</div>
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
            <Tape>XP ladder</Tape>
            <CardTitle className="text-lg">Level Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
              {LEVELS.map((entry) => (
                <div key={entry.level} className="rounded-[1.5rem] border-[4px] border-black bg-white p-4 text-center shadow-gpe-sm">
                  <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-black ${entry.color} text-lg font-black`}>
                    {entry.level}
                  </div>
                  <div className="font-black text-foreground">Level {entry.level}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{entry.threshold.toLocaleString()}+ pts</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Tape>How points work</Tape>
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
  cabinLeaderboard,
  challenges,
  error,
  isLoading,
  ledger,
  memberStatus,
  onRefresh,
  recentActivity,
  season,
  seasonalLeaderboard,
  seasonalTitle,
  submissions,
  totalSeasonalPoints,
}: {
  cabinLeaderboard: CampCabinLeaderboardRow[];
  challenges: CampChallenge[];
  error: string | null;
  isLoading: boolean;
  ledger: CampPointsLedgerRow[];
  memberStatus: CampSeasonMember | null;
  onRefresh: () => void;
  recentActivity: CampRecentActivityRow[];
  season: CampSeason | null;
  seasonalLeaderboard: CampLeaderboardRow[];
  seasonalTitle: string;
  submissions: CampSubmission[];
  totalSeasonalPoints: number;
}) {
  const prizes = parsePrizes(season);
  const activeLedger = ledger.filter((row) => !row.reversed_at);
  const completedChallengeIds = new Set(activeLedger.map((row) => row.challenge_id).filter(Boolean));
  const totalSeasonPoints = seasonalLeaderboard.reduce((sum, row) => sum + row.points, 0);
  const totalActions = seasonalLeaderboard.reduce((sum, row) => sum + (row.approved_challenge_count || 0), 0);
  const myRank = memberStatus ? seasonalLeaderboard.find((row) => row.season_member_id === memberStatus.id) : null;
  const nextRank = myRank ? seasonalLeaderboard.find((row) => row.rank === myRank.rank - 1) : null;
  const pointsToday = activeLedger
    .filter((row) => new Date(row.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, row) => sum + row.points, 0);
  const pointsToNext = myRank && nextRank ? Math.max(0, nextRank.points - myRank.points + 1) : 0;

  if (isLoading) {
    return (
      <div className="grid gap-5 md:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item}>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
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
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="relative overflow-hidden bg-white p-0">
          <CardContent className="p-6 md:p-8">
            <Tape className="absolute right-8 top-5">Current mission</Tape>
            <div className="mb-5 inline-flex rounded-full border-[3px] border-black bg-gpe-yellow px-4 py-2 text-xs font-black uppercase">
              {season.status}
            </div>
            <h2 className="gpe-heading text-4xl md:text-6xl">{seasonalTitle}</h2>
            <p className="mt-4 max-w-2xl text-sm font-bold text-black/70 md:text-base">
              {season.description || "Complete approved actions, help your cabin climb, and track reviewed points as the season unfolds."}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <CountdownCard season={season} />
              <Link to="/camp-gpe/challenges">
                <CampButton variant="secondary" size="lg">Submit Challenge</CampButton>
              </Link>
            </div>
          </CardContent>
        </Card>

        <YourRankCard
          cabin={memberStatus?.gpe_cabins?.name || "No cabin yet"}
          points={myRank?.points ?? totalSeasonalPoints}
          pointsToday={pointsToday}
          pointsToNext={pointsToNext}
          rank={myRank?.rank ?? null}
          seasonName={seasonalTitle}
        />
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatSticker label="Members competing" value={seasonalLeaderboard.length.toLocaleString()} accent="yellow" icon={<Users className="h-14 w-14" />} />
        <StatSticker label="Actions completed" value={totalActions.toLocaleString()} accent="cyan" icon={<BadgeCheck className="h-14 w-14" />} />
        <StatSticker label="Points earned" value={totalSeasonPoints.toLocaleString()} accent="pink" icon={<Zap className="h-14 w-14" />} />
        <StatSticker label="Season clock" value={seasonCountdownLabel(season)} accent="orange" icon={<Clock className="h-14 w-14" />} />
      </div>

      <CabinLeaderboardSection cabinLeaderboard={cabinLeaderboard} />

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <SeasonRankingsCard leaderboard={seasonalLeaderboard} seasonalTitle={seasonalTitle} />
        <RecentActivityFeed activity={recentActivity} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChallengeTracks challenges={challenges} completedChallengeIds={completedChallengeIds} />
        <PrizeSection prizes={prizes} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Tape>Submission history</Tape>
            <CardTitle>My Challenge History</CardTitle>
            <CardDescription>Submissions are reviewed before points appear on the seasonal leaderboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {submissions.length === 0 ? (
              <p className="text-sm font-bold text-black/60">No seasonal challenge submissions are linked to this Hub account yet.</p>
            ) : submissions.map((submission) => (
              <ActivityItem
                key={submission.id}
                title={submission.challenge_key.replaceAll("_", " ")}
                detail={reviewStatusLabel(submission.review_status)}
                timestamp={new Date(submission.created_at).toLocaleString()}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Tape>Point ledger</Tape>
            <CardTitle>My Point Ledger</CardTitle>
            <CardDescription>Corrections and reversals are preserved for auditability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ledger.length === 0 ? (
              <p className="text-sm font-bold text-black/60">No reviewed seasonal points yet.</p>
            ) : ledger.map((row) => (
              <ActivityItem
                key={row.id}
                title={row.reason}
                detail={row.adjustment_type}
                points={<span className={row.reversed_at ? "line-through" : ""}>{row.points > 0 ? "+" : ""}{row.points} pts</span>}
                timestamp={new Date(row.created_at).toLocaleString()}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CountdownCard({ season }: { season: CampSeason }) {
  const startsIn = daysBetween(season.starts_at);
  const endsIn = daysBetween(season.ends_at);
  const detail = startsIn !== null && startsIn > 0
    ? season.starts_at
    : season.ends_at;
  const state = startsIn !== null && startsIn > 0
    ? "starts"
    : season.ends_at && endsIn !== null && endsIn < 0
      ? "completed"
      : endsIn !== null && endsIn <= 3
        ? "ends"
        : "live";
  const progress = season.starts_at && season.ends_at && startsIn !== null && startsIn <= 0
    ? Math.round((Math.max(0, Date.now() - new Date(season.starts_at).getTime()) / Math.max(1, new Date(season.ends_at).getTime() - new Date(season.starts_at).getTime())) * 100)
    : undefined;
  return (
    <CountdownStateCard
      state={state}
      label={state === "completed" ? "Season Complete" : seasonCountdownLabel(season)}
      detail={detail ? new Date(detail).toLocaleString() : "Dates pending"}
      progress={progress}
    />
  );
}

function YourRankCard({
  cabin,
  points,
  pointsToday,
  pointsToNext,
  rank,
  seasonName,
}: {
  cabin: string;
  points: number;
  pointsToday: number;
  pointsToNext: number;
  rank: number | null;
  seasonName: string;
}) {
  return (
    <Card className="bg-black text-white">
      <CardHeader>
        <Tape>Your rank</Tape>
        <CardTitle className="text-white">{rank ? `#${rank}` : "Not ranked yet"}</CardTitle>
        <CardDescription className="text-white/70">{seasonName}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm font-black uppercase">
        <div className="flex items-center justify-between gap-4 border-b-2 border-white/30 pb-3">
          <span>Current season</span>
          <span>{points.toLocaleString()} pts</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-b-2 border-white/30 pb-3">
          <span>Today</span>
          <span>{pointsToday > 0 ? "+" : ""}{pointsToday} pts</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-b-2 border-white/30 pb-3">
          <span>Cabin</span>
          <span>{cabin}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Next rank</span>
          <span>{pointsToNext > 0 ? `${pointsToNext} pts away` : rank ? "Top spot" : "Submit to rank"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CabinLeaderboardSection({ cabinLeaderboard }: { cabinLeaderboard: CampCabinLeaderboardRow[] }) {
  const maxPoints = Math.max(1, ...cabinLeaderboard.map((row) => row.points));
  if (cabinLeaderboard.length === 0) {
    return (
      <EmptyState
        illustration="tent"
        title="Cabins Are Gathering"
        description="Cabin totals will appear after reviewed seasonal points are approved."
      />
    );
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow={<Sticker accent="cyan"><Users className="mr-2 h-4 w-4" /> Cabins</Sticker>}
        title="Cabin Leaderboard"
        description="Current-season cabin totals update from approved Camp point ledger entries."
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cabinLeaderboard.map((row, index) => (
          <CabinCard
            key={row.cabin_id}
            name={`${row.rank}. ${row.cabin_name}`}
            members={`${row.member_count} member${row.member_count === 1 ? "" : "s"}`}
            score={`${row.points.toLocaleString()} pts`}
            progress={Math.round((row.points / maxPoints) * 100)}
            accent={(["pink", "yellow", "cyan", "orange"] as const)[index % 4]}
            description={index === 0 ? "Current cabin leader" : "Climbing with reviewed actions"}
            leader={index === 0 ? "Top cabin" : "Open"}
            topContributors={`${Math.max(0, row.points).toLocaleString()} pts`}
            recentActivity={row.member_count > 0 ? "Active" : "Waiting"}
          />
        ))}
      </div>
    </section>
  );
}

function SeasonRankingsCard({
  leaderboard,
  seasonalTitle,
}: {
  leaderboard: CampLeaderboardRow[];
  seasonalTitle: string;
}) {
  return (
    <Card>
      <CardHeader>
        <Tape>Reviewed points only</Tape>
        <CardTitle>{seasonalTitle} Rankings</CardTitle>
        <CardDescription>Ranked by approved, unreversed points for this seasonal campaign.</CardDescription>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <EmptyState
            illustration="campfire"
            title="No Season Rankings Yet"
            description="The board starts moving after Team GPE approves seasonal actions."
          />
        ) : (
          <div className="space-y-3">
            {leaderboard.map((row) => (
              <div key={row.season_member_id} className={`grid gap-4 rounded-[1.75rem] border-[4px] border-black p-4 shadow-gpe-sm md:grid-cols-[1fr_auto] md:items-center ${row.rank === 1 ? "bg-gpe-yellow" : row.rank === 2 ? "bg-gpe-cyan" : row.rank === 3 ? "bg-[#fbd3d3]" : "bg-white"}`}>
                <div className="flex min-w-0 items-center gap-4">
                  <div className="w-12 text-center font-header text-2xl">#{row.rank}</div>
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
                <div className="flex items-center justify-between gap-5 text-right md:justify-end">
                  <Badge variant="outline" className="bg-white">Move {rankMovementLabel(row)}</Badge>
                  <div>
                    <div className="font-header text-3xl text-black">{row.points.toLocaleString()}</div>
                    <div className="text-xs font-bold uppercase text-black/50">points</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityFeed({ activity }: { activity: CampRecentActivityRow[] }) {
  return (
    <Card>
      <CardHeader>
        <Tape>Live activity</Tape>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Visible approved ledger activity refreshes while this tab is open.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activity.length === 0 ? (
          <p className="text-sm font-bold text-black/60">No visible approved activity yet.</p>
        ) : activity.map((row, index) => {
          const profileName = row.profiles?.full_name || row.profiles?.username || "A member";
          const challengeTitle = row.gpe_challenges?.title || row.reason;
          return (
            <ActivityItem
              key={row.id}
              avatar={
                <Avatar className="h-10 w-10 border-2 border-black">
                  <AvatarImage src={row.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-gpe-yellow font-black">{profileName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              }
              icon={<Sparkles className="h-5 w-5" />}
              title={`${profileName} completed ${challengeTitle}`}
              detail={row.gpe_challenges?.category || row.entry_type || "Approved action"}
              points={<span>+{row.points} pts</span>}
              timestamp={relativeTime(row.created_at)}
              kind={row.gpe_challenges?.category || row.entry_type}
              fresh={index === 0}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

function ChallengeTracks({
  challenges,
  completedChallengeIds,
}: {
  challenges: CampChallenge[];
  completedChallengeIds: Set<string | null | undefined>;
}) {
  const tracks = Object.values(
    challenges.reduce<Record<string, { category: string; total: number; complete: number; points: number }>>((acc, challenge) => {
      const category = challenge.category || "General";
      const current = acc[category] || { category, total: 0, complete: 0, points: 0 };
      current.total += 1;
      current.points += challenge.point_value || 0;
      if (completedChallengeIds.has(challenge.id)) current.complete += 1;
      acc[category] = current;
      return acc;
    }, {}),
  );

  return (
    <Card>
      <CardHeader>
        <Tape>Challenge tracks</Tape>
        <CardTitle>Track Progress</CardTitle>
        <CardDescription>Completed counts use your approved Camp ledger entries.</CardDescription>
      </CardHeader>
      <CardContent>
        {tracks.length === 0 ? (
          <EmptyState
            illustration="clipboard"
            title="No Tracks Yet"
            description="Challenge tracks appear once active seasonal challenges are configured."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {tracks.map((track, index) => (
              <ChallengeCard
                key={track.category}
                accent={(["cyan", "pink", "orange", "yellow"] as const)[index % 4]}
                title={track.category}
                description={`${track.complete} / ${track.total} complete`}
                points={`Up to ${track.points} pts`}
                status={`${Math.round((track.complete / Math.max(1, track.total)) * 100)}%`}
                difficulty={track.total > 3 ? "Medium" : "Easy"}
                estimatedTime="5-15 min"
                progress={Math.round((track.complete / Math.max(1, track.total)) * 100)}
                action={<CampProgress label="Progress" value={track.complete} max={track.total} accent="black" />}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrizeSection({ prizes }: { prizes: Array<{ title: string; description: string }> }) {
  return (
    <Card className="bg-black text-white">
      <CardHeader>
        <Tape>Prizes</Tape>
        <CardTitle className="text-white">Season Rewards</CardTitle>
        <CardDescription className="text-white/70">Configured from the active season point rules.</CardDescription>
      </CardHeader>
      <CardContent>
        {prizes.length === 0 ? (
          <EmptyState
            illustration="badge"
            title="Prize Reveal Coming"
            description="Season rewards can be added through the active campaign point rules."
            className="bg-white text-black"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {prizes.map((prize, index) => (
              <PrizeCard
                key={`${prize.title}-${index}`}
                title={prize.title}
                description={prize.description || "Details coming soon."}
                accent={(["pink", "cyan", "yellow", "orange"] as const)[index % 4]}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CabinsPanel({
  cabinLeaderboard,
  error,
  isLoading,
  onRefresh,
  season,
}: {
  cabinLeaderboard: CampCabinLeaderboardRow[];
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  season: CampSeason | null;
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
  if (error) return <Card><CardContent className="py-8 text-sm font-bold text-red-700">{error}</CardContent></Card>;
  if (!season) return <Card><CardContent className="py-8 text-sm font-bold text-black/60">No active season is configured.</CardContent></Card>;
  return (
    <>
      <SectionHeader
        eyebrow={<Sticker accent="pink"><Users className="mr-2 h-4 w-4" /> Current Season</Sticker>}
        title="Cabin Competition"
        description={`${season.name} cabin totals from approved seasonal ledger entries.`}
        action={<CampButton variant="cyan" onClick={onRefresh}>Refresh</CampButton>}
      />
      <CabinLeaderboardSection cabinLeaderboard={cabinLeaderboard} />
    </>
  );
}

function BadgesPanel({
  leaderboard,
  mainLeaderboard,
  season,
}: {
  leaderboard: CampLeaderboardRow[];
  mainLeaderboard: LeaderboardUser[];
  season: CampSeason | null;
}) {
  const topSeasonMember = leaderboard[0];
  const topHubMember = mainLeaderboard[0];
  const badges = [
    {
      title: "Season Leader",
      description: topSeasonMember ? `${topSeasonMember.full_name || topSeasonMember.username || topSeasonMember.contact_email} leads ${season?.name || "the current season"}.` : "Awarded when seasonal rankings begin.",
      icon: Trophy,
      accent: "yellow" as const,
    },
    {
      title: "Petition Pro",
      description: "Previewed from approved challenge counts until dedicated badge tables are added.",
      icon: BadgeCheck,
      accent: "cyan" as const,
    },
    {
      title: "Hub XP Leader",
      description: topHubMember ? `${topHubMember.full_name || topHubMember.username || "A member"} leads all-time Hub points.` : "Awarded from all-time Hub rankings.",
      icon: Zap,
      accent: "pink" as const,
    },
    {
      title: "Cabin Champion",
      description: "Awarded to members contributing to top cabin totals.",
      icon: Medal,
      accent: "orange" as const,
    },
  ];
  return (
    <>
      <SectionHeader
        eyebrow={<Sticker accent="yellow"><Award className="mr-2 h-4 w-4" /> Badges</Sticker>}
        title="Badge Board"
        description="Reusable badge previews powered by available leaderboard and challenge data."
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {badges.map(({ title, description, icon: Icon, accent }, index) => (
          <BadgeToken
            key={title}
            title={title}
            description={description}
            icon={<Icon className="h-8 w-8" />}
            accent={accent}
            rarity={index === 0 ? "legendary" : index === 1 ? "rare" : "common"}
            status={index === 1 ? "locked" : "earned"}
          />
        ))}
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
