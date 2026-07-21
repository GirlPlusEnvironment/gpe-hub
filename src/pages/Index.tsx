import { useMemo } from "react";
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
  Users,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAllListings } from "@/lib/listings";
import { fetchPosts } from "@/lib/posts";
import { gpeCategoryConfig } from "@/lib/gpe";
import { getPreferredDisplayName } from "@/lib/auth";
import type { Listing } from "@/types/listings";

const quickLinks = [
  { to: "/profile", label: "My Profile", icon: Users, dark: false },
  { to: "/favorites", label: "My Favorites", icon: Heart, dark: false },
  { to: "/submit", label: "Submit New", icon: PlusCircle, dark: true },
  { to: "/messages", label: "Messages", icon: MessageSquare, dark: false },
  { to: "/community", label: "Community", icon: Users, dark: false },
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
  const secondaryIdentity = profile?.username
    ? `@${profile.username}`
    : profile?.full_name
    ? ""
    : welcomeName;

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main space-y-10">
        <section className="gpe-card p-5 sm:p-8 md:p-12">
          <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <h1
                className="gpe-heading leading-[0.95] [font-size:clamp(2.25rem,5vw,4.5rem)]"
                style={{ overflowWrap: "anywhere" }}
              >
                Welcome Back,
                <br />
                {headingName}! 👋
              </h1>
              <p className="mt-5 max-w-2xl break-words text-lg font-bold md:text-2xl">
                Your community hub for jobs, events, funding, resources, group chats, and
                environmental justice conversation.
              </p>
              {secondaryIdentity && (
                <p className="mt-4 break-words text-sm font-bold uppercase tracking-wide text-black/60">
                  {secondaryIdentity}
                </p>
              )}
            </div>
            <div className="gpe-card-sm gpe-pattern relative min-w-0 bg-black p-6 text-white">
              <div className="absolute inset-0 opacity-30 gpe-pattern" />
              <div className="relative min-w-0">
                <p className="gpe-heading break-words text-2xl text-yellow-400">Quick Start</p>
                <ul className="mt-4 space-y-3 text-sm font-bold uppercase">
                  <li>Explore new opportunities</li>
                  <li>Jump into messages and groups</li>
                  <li>Create a post or submission</li>
                  <li>Keep your profile current</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="gpe-section-title mb-6">Featured Right Now</h2>
          {listingsLoading ? (
            <div className="gpe-card flex items-center justify-center p-12">
              <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              <span className="font-bold uppercase">Loading dashboard</span>
            </div>
          ) : listingsError ? (
            <div className="gpe-card p-8">
              <p className="font-bold text-red-600">We couldn&apos;t load the latest listings.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {featuredByCategory.map(({ category, listing }) => {
                const Icon = categoryIcons[category];
                const config = gpeCategoryConfig[category];

                return (
                  <article key={category} className="gpe-card gpe-hover-lift p-6">
                    <span className={`inline-flex max-w-full rounded-full border-[3px] border-black px-3 py-1 text-xs font-bold uppercase sm:px-4 ${config.badge}`}>
                      {config.label}
                    </span>
                    {listing ? (
                      <>
                        <h3 className="mt-4 font-header text-2xl uppercase leading-tight">{listing.title}</h3>
                        <p className="mt-3 line-clamp-3 text-sm font-bold text-black/70">
                          {listing.summary || listing.description}
                        </p>
                        <Link
                          to={`/listing/${listing.id}`}
                          className={`mt-6 inline-flex items-center gap-2 text-sm font-bold uppercase ${config.text}`}
                        >
                          View Details <ArrowRight className="h-4 w-4" />
                        </Link>
                      </>
                    ) : (
                      <div className={`mt-5 rounded-[1.5rem] border-[3px] border-black p-6 ${config.surface}`}>
                        <Icon className="mb-4 h-8 w-8" />
                        <p className="font-bold uppercase">Nothing posted yet</p>
                        <Link to={categoryRoutes[category]} className="mt-3 inline-block text-sm font-bold underline">
                          Browse {config.label}s
                        </Link>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="gpe-section-title mb-6">Quick Links</h2>
          <div className="flex min-w-0 flex-wrap gap-3 sm:gap-4">
            {quickLinks.map(({ to, label, icon: Icon, dark }) => (
              <Link
                key={to}
                to={to}
                className={dark ? "gpe-pill bg-black text-white" : "gpe-pill gpe-shadow-sm hover:bg-pink-100"}
              >
                <span className="flex min-w-0 items-center justify-center gap-2 sm:gap-3">
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </span>
              </Link>
            ))}
            <Link to="/messages" className="gpe-pill gpe-shadow-sm hover:bg-pink-100">
              <span className="flex min-w-0 items-center justify-center gap-2 sm:gap-3">
                <Users className="h-5 w-5 shrink-0" />
                Groups in Messages
              </span>
            </Link>
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="gpe-section-title">Community Buzz</h2>
            <Link className="text-sm font-bold uppercase underline" to="/community">
              Go to Community
            </Link>
          </div>

          {postsLoading ? (
            <div className="gpe-card flex items-center justify-center p-10">
              <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              <span className="font-bold uppercase">Loading posts</span>
            </div>
          ) : postsError ? (
            <div className="gpe-card p-8">
              <p className="font-bold text-red-600">We couldn&apos;t load the community feed.</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="gpe-card p-8">
              <p className="font-bold uppercase">No community posts yet.</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {posts.slice(0, 2).map((post) => (
                <Link
                  key={post.id}
                  to={`/community/post/${post.id}`}
                  className="gpe-card p-6 transition-transform hover:-translate-y-1"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-black bg-[#f7b267] font-bold">
                      {(post.user?.full_name || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold">{post.user?.full_name || "Community member"}</div>
                      <div className="text-xs uppercase text-black/60">{post.type}</div>
                    </div>
                  </div>
                  <h3 className="mt-5 font-header text-2xl uppercase">{post.title}</h3>
                  <p className="mt-3 line-clamp-4 text-sm font-bold text-black/75">{post.description}</p>
                  <div className="mt-5 flex gap-5 text-sm font-bold uppercase text-black/70">
                    <span>{post.likes_count} likes</span>
                    <span>{post.comments_count} comments</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
