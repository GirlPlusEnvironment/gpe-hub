import { JSX, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDown,
  BookOpen,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  Heart,
  MapPin,
  Search,
  UsersRound,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, Sticker } from "@/components/camp/CampDesign";
import { fetchAllListings } from "@/lib/listings";
import { useFavorites } from "@/hooks/useFavorites";
import { getSortOptions, sortListings, type SortOption } from "@/lib/sorting";
import type { EventListing, FundraiserListing, JobListing, Listing, ResourceListing } from "@/types/listings";
import { gpeCategoryConfig } from "@/lib/gpe";
import { fetchMentorshipListings, mentorshipBadge, toListText, type MentorshipListing } from "@/lib/mentorship";

type ListingCategory = Listing["category"];
type ExploreCategory = ListingCategory | "mentorship";

const categories: Array<{ id: ExploreCategory; title: string; icon: JSX.Element }> = [
  { id: "jobs", title: "Jobs", icon: <Briefcase className="h-5 w-5" /> },
  { id: "events", title: "Events", icon: <Calendar className="h-5 w-5" /> },
  { id: "fundraisers", title: "Funds", icon: <DollarSign className="h-5 w-5" /> },
  { id: "resources", title: "Resources", icon: <BookOpen className="h-5 w-5" /> },
  { id: "mentorship", title: "Mentorship", icon: <UsersRound className="h-5 w-5" /> },
];

const filterOptions: Record<ExploreCategory, string[]> = {
  jobs: ["All", "Full-time", "Part-time", "Contract", "Remote"],
  events: ["All", "Conference", "Workshop", "Festival", "Meetup", "Expo", "Panel"],
  fundraisers: ["All", "Infrastructure", "Education", "Environment", "Legal", "Food Security"],
  resources: ["All", "Toolkit", "Video", "Guide", "Handbook", "Technical Guide", "Database"],
  mentorship: ["All", "Mentor offers", "Mentor requests", "Remote", "Local", "Open only"],
};

const listingPlaceholder = {
  jobs: <Briefcase className="h-16 w-16 opacity-30" />,
  events: <Calendar className="h-16 w-16 opacity-30" />,
  fundraisers: <DollarSign className="h-16 w-16 opacity-30" />,
  resources: <BookOpen className="h-16 w-16 opacity-30" />,
  mentorship: <UsersRound className="h-16 w-16 opacity-30" />,
};

const Explore = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isFavorited, toggleFavorite, isPending } = useFavorites();

  const [selectedCategory, setSelectedCategory] = useState<ExploreCategory>("jobs");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [sortOption, setSortOption] = useState<SortOption>("most_recent");

  const { data: listings = [], isLoading, isError } = useQuery({
    queryKey: ["listings"],
    queryFn: fetchAllListings,
    staleTime: 1000 * 60 * 5,
  });

  const { data: mentorshipListings = [], isLoading: mentorshipLoading, isError: mentorshipError } = useQuery({
    queryKey: ["mentorship-listings"],
    queryFn: fetchMentorshipListings,
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get("category") as ExploreCategory | null;
    if (cat && ["jobs", "events", "fundraisers", "resources", "mentorship"].includes(cat)) {
      setSelectedCategory(cat);
      setSelectedFilter("All");
      setSortOption("most_recent");
    }
  }, [location.search]);

  const currentListings = useMemo(
    () => selectedCategory === "mentorship" ? [] : listings.filter((listing) => listing.category === selectedCategory),
    [listings, selectedCategory],
  );

  const filteredMentorshipListings = useMemo(() => {
    if (selectedCategory !== "mentorship") return [];
    const query = searchQuery.trim().toLowerCase();
    return mentorshipListings.filter((listing) => {
      const haystack = [
        listing.display_name,
        listing.headline,
        listing.intro,
        listing.location,
        listing.availability,
        listing.career_stage,
        listing.remote_preference,
        ...listing.topics,
        ...listing.climate_focus,
      ].join(" ").toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const matchesFilter =
        selectedFilter === "All" ||
        (selectedFilter === "Mentor offers" && listing.listing_type === "mentor_offer") ||
        (selectedFilter === "Mentor requests" && listing.listing_type === "mentor_request") ||
        (selectedFilter === "Remote" && listing.remote_preference === "remote") ||
        (selectedFilter === "Local" && listing.remote_preference === "local") ||
        (selectedFilter === "Open only" && listing.status === "published");
      return matchesSearch && matchesFilter;
    });
  }, [mentorshipListings, searchQuery, selectedCategory, selectedFilter]);

  const filteredListings = useMemo(() => {
    if (selectedCategory === "mentorship") return [];
    const filtered = currentListings.filter((listing) => {
      const haystack = `${listing.title} ${listing.description} ${listing.summary ?? ""}`.toLowerCase();
      const matchesSearch = haystack.includes(searchQuery.toLowerCase());

      if (selectedFilter === "All") {
        return matchesSearch;
      }

      switch (selectedCategory) {
        case "jobs":
          return matchesSearch && (listing as JobListing).jobType === selectedFilter;
        case "events":
          return matchesSearch && (listing as EventListing).eventType === selectedFilter;
        case "fundraisers":
          return matchesSearch && (listing.tags ?? []).includes(selectedFilter);
        case "resources":
          return matchesSearch && (listing as ResourceListing).resourceType === selectedFilter;
        default:
          return matchesSearch;
      }
    });

    return sortListings(filtered, sortOption);
  }, [currentListings, searchQuery, selectedFilter, selectedCategory, sortOption]);

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <SectionHeader
          className="mb-10"
          eyebrow={<Sticker accent="cyan"><Search className="mr-2 h-4 w-4" /> Explore</Sticker>}
          title="Explore Hub"
          description="Browse jobs, events, funding opportunities, and resources using the real Supabase data already powering the app."
          action={<CampButton variant="yellow" onClick={() => navigate("/submit")}>Submit Resource</CampButton>}
        />

        <section className="gpe-card sticky top-4 z-30 mb-10 flex flex-col gap-5 bg-white/90 p-5 backdrop-blur">
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSelectedFilter("All");
                  setSortOption("most_recent");
                  navigate(`/explore?category=${category.id}`, { replace: true });
                }}
              >
                {category.icon}
                {category.title}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_220px_260px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={`Search ${selectedCategory}...`}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-11"
              />
            </div>
            <select
              value={selectedFilter}
              onChange={(event) => setSelectedFilter(event.target.value)}
              className="gpe-input"
            >
              {filterOptions[selectedCategory].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as SortOption)}
                className="gpe-input pl-11"
              >
              {(selectedCategory === "mentorship" ? [{ value: "most_recent", label: "Newest" }] : getSortOptions(selectedCategory)).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {selectedCategory === "mentorship" ? (
          <MentorshipGrid
            listings={filteredMentorshipListings}
            isLoading={mentorshipLoading}
            isError={mentorshipError}
            onOpen={(listing) => navigate(`/mentorship/${listing.id}`, { state: { from: `${location.pathname}${location.search}` } })}
          />
        ) : isLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => <LoadingCampCard key={item} label="Loading listings" />)}
          </div>
        ) : isError ? (
          <EmptyState
            illustration="megaphone"
            title="Explore Board Is Offline"
            description="We could not load the latest listings. Try refreshing in a moment."
          />
        ) : filteredListings.length === 0 ? (
          <EmptyState
            illustration={selectedCategory === "events" ? "sun" : selectedCategory === "jobs" ? "flag" : "clipboard"}
            title="No Results Found"
            description="Try adjusting your search or filters."
            action={
              <CampButton
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedFilter("All");
                }}
              >
                Clear Filters
              </CampButton>
            }
          />
        ) : (
          <>
            <p className="mb-6 text-sm font-bold uppercase text-black/70">
              Showing {filteredListings.length} {selectedCategory}
            </p>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredListings.map((listing) => {
                const categoryConfig = gpeCategoryConfig[listing.category];
                const detailPath =
                  listing.category === "jobs"
                    ? `/jobs/${listing.id}`
                    : listing.category === "resources"
                    ? (listing as ResourceListing).resourceType === "Toolkit"
                      ? `/toolkits/${listing.id}`
                      : `/resources/${listing.id}`
                    : listing.category === "fundraisers"
                    ? `/funding/${listing.id}`
                    : listing.category === "events"
                    ? `/events/${listing.id}`
                    : `/listing/${listing.id}`;
                return (
                  <article
                    key={listing.id}
                    className="gpe-card gpe-hover-lift cursor-pointer overflow-hidden"
                    onClick={() => navigate(detailPath, { state: { from: `${location.pathname}${location.search}` } })}
                  >
                    <div className={`flex h-48 items-center justify-center border-b-[3px] border-black ${categoryConfig.surface}`}>
                      {listing.image ? (
                        <img src={listing.image} alt={listing.title} className="h-full w-full object-cover" />
                      ) : (
                        listingPlaceholder[listing.category]
                      )}
                    </div>
                    <div className="p-6">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <span className={`rounded-full border-[3px] border-black px-4 py-1 text-xs font-bold uppercase ${categoryConfig.badge}`}>
                          {categoryConfig.label}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFavorite(listing.id);
                          }}
                          disabled={isPending(listing.id)}
                          className="rounded-full p-2 hover:bg-pink-100"
                          aria-label={isFavorited(listing.id) ? "Remove favorite" : "Add favorite"}
                        >
                          <Heart
                            className={`h-5 w-5 ${isFavorited(listing.id) ? "fill-red-500 text-red-500" : "text-black"}`}
                          />
                        </button>
                      </div>
                      <h3 className="font-header text-2xl uppercase leading-tight">{listing.title}</h3>
                      <p className="mt-3 line-clamp-3 text-sm font-bold text-black/70">
                        {listing.summary || listing.description}
                      </p>
                      <div className="mt-6 space-y-2 border-t-[3px] border-black pt-5 text-sm font-bold text-black/70">
                        {listing.category === "jobs" && (
                          <>
                            <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {(listing as JobListing).location}</div>
                            <div>{(listing as JobListing).jobType} • {(listing as JobListing).salary}</div>
                          </>
                        )}
                        {listing.category === "events" && (
                          <>
                            <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {(listing as EventListing).date}</div>
                            <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {(listing as EventListing).location}</div>
                          </>
                        )}
                        {listing.category === "fundraisers" && (
                          <>
                            <div>Goal: {(listing as FundraiserListing).goalAmount}</div>
                            <div>Deadline: {(listing as FundraiserListing).deadline}</div>
                          </>
                        )}
                        {listing.category === "resources" && (
                          <>
                            <div>{(listing as ResourceListing).resourceType}</div>
                            <div>Topic: {(listing as ResourceListing).topic}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

function MentorshipGrid({
  listings,
  isLoading,
  isError,
  onOpen,
}: {
  listings: MentorshipListing[];
  isLoading: boolean;
  isError: boolean;
  onOpen: (listing: MentorshipListing) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => <LoadingCampCard key={item} label="Loading mentorship" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        illustration="megaphone"
        title="Mentorship Is Offline"
        description="Mentorship listings could not be loaded. Try refreshing in a moment."
      />
    );
  }

  if (listings.length === 0) {
    return (
      <EmptyState
        illustration="notebook"
        title="No Mentorship Listings"
        description="Try another search, or submit a mentorship request or offer."
      />
    );
  }

  return (
    <>
      <p className="mb-6 text-sm font-bold uppercase text-black/70">
        Showing {listings.length} mentorship listings
      </p>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {listings.map((listing) => (
          <article key={listing.id} className="gpe-card gpe-hover-lift overflow-hidden">
            <div className="flex h-44 items-center justify-center border-b-[3px] border-black bg-gpe-cyan">
              {listing.profile_image_url || listing.profiles?.avatar_url ? (
                <img
                  src={listing.profile_image_url || listing.profiles?.avatar_url || ""}
                  alt={listing.display_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UsersRound className="h-16 w-16 opacity-60" />
              )}
            </div>
            <div className="p-6">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full border-[3px] border-black bg-gpe-yellow px-4 py-1 text-xs font-bold uppercase">
                  {mentorshipBadge(listing)}
                </span>
                <span className="rounded-full border-[3px] border-black bg-white px-4 py-1 text-xs font-bold uppercase">
                  {listing.status}
                </span>
              </div>
              <h3 className="font-header text-2xl uppercase leading-tight">{listing.headline}</h3>
              <p className="mt-2 text-sm font-bold text-black/70">{listing.display_name}</p>
              <p className="mt-3 line-clamp-3 text-sm font-bold text-black/70">
                {listing.intro || listing.support_needed || listing.mentor_areas || "Mentorship details available on the listing page."}
              </p>
              <div className="mt-5 space-y-2 border-t-[3px] border-black pt-4 text-sm font-bold text-black/70">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {listing.location || listing.remote_preference}</div>
                <div>{toListText(listing.topics)}</div>
                <div>{listing.availability || "Availability open"}</div>
              </div>
              <Button type="button" className="mt-6 w-full" onClick={() => onOpen(listing)}>
                View Details
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default Explore;
