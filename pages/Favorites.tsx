import { JSX, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, Sticker } from "@/components/camp/CampDesign";
import { fetchFavoriteListings } from "@/lib/listings";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { getSortOptions, sortListings, type SortOption } from "@/lib/sorting";
import type { EventListing, FundraiserListing, JobListing, Listing, ResourceListing } from "@/types/listings";
import { gpeCategoryConfig } from "@/lib/gpe";

type FilterCategory = "all" | Listing["category"];

const categories: Array<{ id: FilterCategory; title: string; icon: JSX.Element }> = [
  { id: "all", title: "All", icon: <Heart className="h-5 w-5" /> },
  { id: "jobs", title: "Jobs", icon: <Briefcase className="h-5 w-5" /> },
  { id: "events", title: "Events", icon: <Calendar className="h-5 w-5" /> },
  { id: "fundraisers", title: "Funds", icon: <DollarSign className="h-5 w-5" /> },
  { id: "resources", title: "Resources", icon: <BookOpen className="h-5 w-5" /> },
];

const filterOptions: Record<Listing["category"], string[]> = {
  jobs: ["All", "Full-time", "Part-time", "Contract", "Remote"],
  events: ["All", "Conference", "Workshop", "Festival", "Meetup", "Expo", "Panel"],
  fundraisers: ["All", "Infrastructure", "Education", "Environment", "Legal", "Food Security"],
  resources: ["All", "Toolkit", "Video", "Guide", "Handbook", "Technical Guide", "Database"],
};

const Favorites = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isFavorited, toggleFavorite, isPending } = useFavorites();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("all");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [sortOption, setSortOption] = useState<SortOption>("most_recent");

  const { data: listings = [], isLoading, isError } = useQuery({
    queryKey: ["favorite-listings", profile?.id],
    queryFn: () => fetchFavoriteListings(profile!.id),
    enabled: Boolean(profile?.id),
    staleTime: 1000 * 60 * 5,
  });

  const activeSortOptions = selectedCategory === "all" ? getSortOptions("jobs") : getSortOptions(selectedCategory);

  const favoriteItems = useMemo(() => {
    const inCategory =
      selectedCategory === "all"
        ? listings
        : listings.filter((listing) => listing.category === selectedCategory);

    const query = searchQuery.toLowerCase();

    const filtered = inCategory.filter((listing) => {
      const matchesSearch = `${listing.title} ${listing.description} ${listing.summary ?? ""}`
        .toLowerCase()
        .includes(query);

      if (selectedCategory === "all" || selectedFilter === "All") {
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
  }, [listings, searchQuery, selectedCategory, selectedFilter, sortOption]);

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <SectionHeader
          className="mb-10"
          eyebrow={<Sticker accent="pink"><Heart className="mr-2 h-4 w-4" /> Saved</Sticker>}
          title="My Favorites"
          description="Your saved jobs, events, funding, and resources in one place."
          action={<Link to="/explore"><CampButton variant="yellow">Explore More</CampButton></Link>}
        />

        <section className="gpe-card mb-8 p-5">
          <div className="mb-4 flex flex-wrap gap-3">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSelectedFilter("All");
                  setSortOption("most_recent");
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
                placeholder="Search favorites..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-11"
              />
            </div>
            <select
              value={selectedFilter}
              onChange={(event) => setSelectedFilter(event.target.value)}
              className="gpe-input"
              disabled={selectedCategory === "all"}
            >
              {(selectedCategory === "all" ? ["All"] : filterOptions[selectedCategory]).map((option) => (
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
                {activeSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => <LoadingCampCard key={item} label="Loading favorites" />)}
          </div>
        ) : isError ? (
          <EmptyState
            illustration="clipboard"
            title="Favorites Are Offline"
            description="We could not load your saved items. Try again in a moment."
          />
        ) : favoriteItems.length === 0 ? (
          <EmptyState
            illustration="badge"
            title="No Favorites Yet"
            description="Start exploring and save items you want to revisit."
            action={<Link to="/explore"><CampButton>Explore Listings</CampButton></Link>}
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {favoriteItems.map((listing) => {
              const categoryConfig = gpeCategoryConfig[listing.category];
              return (
                <article
                  key={listing.id}
                  className="gpe-card gpe-hover-lift cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/listing/${listing.id}`)}
                >
                  <div className={`flex h-40 items-center justify-center border-b-[3px] border-black ${categoryConfig.surface}`}>
                    {listing.image ? (
                      <img src={listing.image} alt={listing.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="font-header text-4xl uppercase opacity-30">{categoryConfig.label}</div>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="mb-3 flex items-start justify-between gap-3">
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
                        className="rounded-full p-2 hover:bg-red-100"
                        aria-label="Remove favorite"
                      >
                        <Heart className={`h-5 w-5 ${isFavorited(listing.id) ? "fill-red-500 text-red-500" : "text-black"}`} />
                      </button>
                    </div>
                    <h3 className="font-header text-2xl uppercase">{listing.title}</h3>
                    <p className="mt-3 line-clamp-3 text-sm font-bold text-black/70">
                      {listing.summary || listing.description}
                    </p>
                    <div className="mt-5 border-t-[3px] border-black pt-4 text-sm font-bold text-black/70">
                      {listing.category === "jobs" && (
                        <>
                          <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {(listing as JobListing).location}</div>
                          <div>{(listing as JobListing).jobType}</div>
                        </>
                      )}
                      {listing.category === "events" && (
                        <>
                          <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {(listing as EventListing).date}</div>
                          <div>{(listing as EventListing).location}</div>
                        </>
                      )}
                      {listing.category === "fundraisers" && (
                        <>
                          <div>Goal: {(listing as FundraiserListing).goalAmount}</div>
                          <div>Raised: {(listing as FundraiserListing).currentAmount}</div>
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
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Favorites;
