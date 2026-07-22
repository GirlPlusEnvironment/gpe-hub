import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Calendar,
  Heart,
  Loader2,
  MessageSquare,
  PlusCircle,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  ActivityItem,
  CampButton,
  CampIllustration,
  CampProgress,
  MarqueeStrip,
  PrizeCard,
  SectionHeader,
  SeasonHero,
  StatSticker,
  Sticker,
  Tape,
} from "@/components/camp/CampDesign";
import { useAuth } from "@/hooks/useAuth";
import { fetchAllListings } from "@/lib/listings";
import { fetchPosts } from "@/lib/posts";
import { gpeCategoryConfig } from "@/lib/gpe";
import { getPreferredDisplayName } from "@/lib/auth";
import {
  getActiveCampSeason,
  getHubCampChallenges,
  getMyCampHistory,
  getMyCampStatus,
} from "@/lib/camp";
import { normalizeReviewStatus } from "@/lib/review-status";
import { getEncouragementMessage, getTimeOfDayGreeting, seasonalThemes } from "@/lib/delight";
import { MEMBERSHIP_SYNC_WARNING_STORAGE_KEY } from "@/lib/membership";
import type { Listing } from "@/types/listings";

const quickLinks = [
  { to: "/camp-gpe/challenges", label: "Seasonal Challenges", icon: Trophy, variant: "secondary" as const },
  { to: "/leaderboard", label: "Leaderboard", icon: Zap, variant: "cyan" as const },
  { to: "/submit", label: "Submit New", icon: PlusCircle, variant: "yellow" as const },
  { to: "/messages", label: "Messages", icon: MessageSquare, variant: "outline" as const },
  { to: "/community", label: "Community", icon: Users, variant: "outline" as const },
];

const categoryIcons = {
  jobs: Briefcase,
  events: Calendar,
  fundraisers: Heart,
  resources: BookOpen,
};

const categoryRoutes = {
  jobs: "/explore?category=jobs",
  events: "/explore?category=events",
  fundraisers: "/explore?category=fundraisers",
  resources: "/explore?category=resources",
};

const Index = () => {
  const { profile, user } = useAuth();
  const [membershipWarning, setMembershipWarning] = useState<string | null>(null);

  useEffect(() => {
    const warning = window.localStorage.getItem(MEMBERSHIP_SYNC_WARNING_STORAGE_KEY);
    if (!warning) return;
    setMembershipWarning(warning);
    window.localStorage.removeItem(MEMBERSHIP_SYNC_WARNING_STORAGE_KEY);
  }, []);

  const { data: listings = [], isLoading: listingsLoading, isError: listingsError } = useQuery({
    queryKey: ["dashboard-listings"],
    queryFn: fetchAllListings,
    staleTime: 1000 * 60 * 5,
  });

  const { data: posts = [], isLoading: postsLoading, isError: postsError } = useQuery({
    queryKey: ["dashboard-posts"],
    queryFn: fetchPosts,
    staleTime: 1000 * 60 * 2,
  });

  const { data: activeSeason } = useQuery({
    queryKey: ["dashboard-active-season"],
    queryFn: getActiveCampSeason,
    staleTime: 1000 * 60 * 5,
  });

  const { data: campChallenges = [] } = useQuery({
    queryKey: ["dashboard-camp-challenges", activeSeason?.id],
    queryFn: () => getHubCampChallenges(activeSeason!.id),
    enabled: Boolean(activeSeason?.id),
    staleTime: 1000 * 60 * 5,
  });

  const { data: campStatus } = useQuery({
    queryKey: ["dashboard-camp-status", activeSeason?.id],
    queryFn: () => getMyCampStatus(activeSeason!.id),
    enabled: Boolean(activeSeason?.id),
    staleTime: 1000 * 60 * 2,
  });

  const { data: campHistory } = useQuery({
    queryKey: ["dashboard-camp-history", activeSeason?.id],
    queryFn: () => getMyCampHistory(activeSeason!.id),
    enabled: Boolean(activeSeason?.id),
    staleTime: 1000 * 60 * 2,
  });

  const featuredByCategory = useMemo(() => {
    const categories: Listing["category"][] = ["jobs", "events", "fundraisers", "resources"];
    return categories.map((category) => {
      const match = listings.find((listing) => listing.category === category);
      return { category, listing: match ?? null };
    });
  }, [listings]);

  const welcomeName = getPreferredDisplayName({
    fullName: profile?.full_name,
    username: profile?.username,
    email: user?.email,
  });
  const headingName = welcomeName.split(" ")[0] || "Bestie";
  const totalSeasonPoints = (campHistory?.ledger || [])
    .filter((row) => !row.reversed_at)
    .reduce((sum, row) => sum + row.points, 0);
  const approvedActions = (campHistory?.ledger || []).filter((row) => !row.reversed_at).length;
  const pendingSubmissions = (campHistory?.submissions || []).filter((submission) => normalizeReviewStatus(submission.review_status) === "pending").length;
  const profilePoints = profile?.points || 0;
  const xpGoal = Math.max(100, Math.ceil((profilePoints + 1) / 100) * 100);
  const pointsToNext = Math.max(0, xpGoal - profilePoints);
  const seasonTheme = seasonalThemes.summer_camp;
  const greeting = getTimeOfDayGreeting();
  const encouragement = getEncouragementMessage({
    pointsToNext,
    cabinName: campStatus?.gpe_cabins?.name,
    pendingSubmissions,
    activeChallenges: campChallenges.length,
  });

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main space-y-10">
        <SeasonHero
          title={
            <>
              Welcome Back,
              <br />
              {headingName}
            </>
          }
          seasonName={activeSeason?.name || "GPE Hub"}
          description="Your GPE Hub now works like a mission board: discover opportunities, join the conversation, complete seasonal actions, and track reviewed points."
          actionHref="/camp-gpe/challenges"
          actionLabel="Open Missions"
          stats={[
            { label: "Hub XP", value: profilePoints.toLocaleString(), icon: <Zap className="h-12 w-12" />, accent: "cyan" },
            { label: "Season points", value: totalSeasonPoints.toLocaleString(), icon: <Trophy className="h-12 w-12" />, accent: "yellow" },
            { label: "Pending review", value: pendingSubmissions.toLocaleString(), icon: <Calendar className="h-12 w-12" />, accent: "orange" },
          ]}
        />

        <MarqueeStrip>
          Seasonal missions - community wins - climate justice - member rankings - submit freely - Team GPE reviews
        </MarqueeStrip>

        {membershipWarning && (
          <div className="gpe-card border-[4px] border-black bg-gpe-yellow p-5 text-sm font-black text-black shadow-gpe">
            {membershipWarning}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-[1fr_1fr_0.8fr]">
          <div className="gpe-delight-card">
            <Sticker accent={seasonTheme.heroAccent} rotate="none">{seasonTheme.sticker}</Sticker>
            <p className="mt-4 text-lg font-black leading-snug">{greeting}</p>
          </div>
          <div className="gpe-delight-card bg-white">
            <Sticker accent="cyan" rotate="none">Coach note</Sticker>
            <p className="mt-4 text-lg font-black leading-snug">{encouragement}</p>
          </div>
          <div className="gpe-delight-card bg-gpe-orange">
            <CampIllustration type={seasonTheme.illustration} className="mx-0 h-16 w-16 rounded-[1.25rem]" />
            <p className="mt-4 text-sm font-black uppercase">{seasonTheme.label} theme-ready</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="gpe-card gpe-paper relative p-6 md:p-8">
            <Tape className="absolute right-8 top-4 hidden md:inline-flex">Current season</Tape>
            <SectionHeader
              eyebrow={<Sticker accent="pink">Dashboard Quest Log</Sticker>}
              title="Your Progress"
              description={campStatus?.gpe_cabins?.name ? `Cabin: ${campStatus.gpe_cabins.name}` : "Join or submit for the active season when you are ready."}
            />
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <CampProgress label="Hub XP" value={profilePoints} max={xpGoal} accent="pink" detail={`${profilePoints}/${xpGoal}`} />
              <CampProgress label="Approved season actions" value={approvedActions} max={Math.max(1, campChallenges.length)} accent="cyan" detail={`${approvedActions}/${campChallenges.length || 0}`} />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {quickLinks.map(({ to, label, icon: Icon, variant }) => (
                <Link key={to} to={to}>
                  <CampButton variant={variant}>
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </CampButton>
                </Link>
              ))}
            </div>
          </div>

          <div className="gpe-card bg-black p-6 text-white md:p-8">
            <Tape>Recent activity</Tape>
            <h2 className="mt-4 font-header text-3xl uppercase">Community Buzz</h2>
            <div className="mt-6 space-y-5 rounded-[2rem] border-[4px] border-black bg-white p-5 text-black">
              {postsLoading ? (
                <div className="flex items-center gap-3 font-bold uppercase">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading posts
                </div>
              ) : postsError ? (
                <p className="font-bold text-gpe-yellow">Community feed could not be loaded.</p>
              ) : posts.length === 0 ? (
                <p className="font-bold text-white/70">No community posts yet.</p>
              ) : (
                posts.slice(0, 3).map((post) => (
                  <ActivityItem
                    key={post.id}
                    avatar={(post.user?.full_name || "G").charAt(0).toUpperCase()}
                    title={post.title}
                    detail={post.user?.full_name || "Community member"}
                    timestamp={post.type}
                    points={`${post.likes_count} likes`}
                  />
                ))
              )}
            </div>
            <Link to="/community" className="mt-6 inline-flex">
              <CampButton variant="yellow">Open Community</CampButton>
            </Link>
          </div>
        </section>

        <section>
          <SectionHeader
            eyebrow={<Sticker accent="yellow">Featured Sections</Sticker>}
            title="Explore the Hub"
            description="Fresh opportunities and resources from the existing Hub data."
            action={<Link to="/explore"><CampButton variant="outline">Browse All</CampButton></Link>}
          />
          {listingsLoading ? (
            <div className="gpe-card mt-6 flex items-center justify-center p-12">
              <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              <span className="font-bold uppercase">Loading dashboard</span>
            </div>
          ) : listingsError ? (
            <div className="gpe-card mt-6 p-8">
              <p className="font-bold text-red-600">We could not load the latest listings.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {featuredByCategory.map(({ category, listing }, index) => {
                const Icon = categoryIcons[category];
                const config = gpeCategoryConfig[category];
                const accents = ["cyan", "yellow", "orange", "pink"] as const;

                return (
                  <article key={category} className={`gpe-card gpe-hover-lift p-6 ${index % 2 ? "rotate-1" : "-rotate-1"}`}>
                    <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border-[4px] border-black ${config.surface}`}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <Sticker accent={accents[index]} rotate="none" className="px-3 py-1 text-[10px]">
                      {config.label}
                    </Sticker>
                    {listing ? (
                      <>
                        <h3 className="mt-4 font-header text-2xl uppercase leading-tight">{listing.title}</h3>
                        <p className="mt-3 line-clamp-3 text-sm font-bold text-black/70">
                          {listing.summary || listing.description}
                        </p>
                        <Link to={`/listing/${listing.id}`} className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase underline">
                          View Details <ArrowRight className="h-4 w-4" />
                        </Link>
                      </>
                    ) : (
                      <>
                        <h3 className="mt-4 font-header text-2xl uppercase leading-tight">Nothing posted yet</h3>
                        <Link to={categoryRoutes[category]} className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase underline">
                          Browse {config.label}s <ArrowRight className="h-4 w-4" />
                        </Link>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <PrizeCard title="Merch Moments" description="Seasonal prizes can be featured as Team GPE confirms them." accent="pink" />
          <PrizeCard title="Newsletter Spotlight" description="Celebrate approved member action and community wins." accent="cyan" />
          <PrizeCard title="Achievement Badges" description="Reusable badge visuals are ready for future achievement data." accent="yellow" />
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <StatSticker label="Open challenges" value={campChallenges.length} accent="white" icon={<Trophy className="h-14 w-14" />} />
          <StatSticker label="Season status" value={campStatus?.status || "Not linked"} accent="cyan" icon={<Users className="h-14 w-14" />} />
          <StatSticker label="Profile level" value={profilePoints >= 2000 ? 5 : profilePoints >= 1000 ? 4 : profilePoints >= 500 ? 3 : profilePoints >= 100 ? 2 : 1} accent="orange" icon={<Zap className="h-14 w-14" />} />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
