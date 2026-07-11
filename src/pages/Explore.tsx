import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Calendar,
  DollarSign,
  BookOpen,
  Search,
  Heart,
  MapPin,
  Clock,
  ArrowUpDown,
} from "lucide-react";
import type { EventListing, FundraiserListing, JobListing, Listing, ResourceListing } from "@/types/listings";
import { fetchAllListings } from "@/lib/listings";
import { useFavorites } from "@/contexts/FavoriteContext";
import { getSortOptions, sortListings, type SortOption } from "@/lib/sorting";

type ListingCategory = Listing["category"];

const categories: Array<{ id: ListingCategory; title: string; icon: JSX.Element }> = [
  { id: "jobs", title: "Jobs", icon: <Briefcase className="h-5 w-5" /> },
  { id: "events", title: "Events", icon: <Calendar className="h-5 w-5" /> },
  { id: "fundraisers", title: "Funding", icon: <DollarSign className="h-5 w-5" /> },
  { id: "resources", title: "Resources", icon: <BookOpen className="h-5 w-5" /> },
];

const filterOptions: Record<ListingCategory, string[]> = {
  jobs: ["All", "Full-time", "Part-time", "Contract", "Remote"],
  events: ["All", "Conference", "Workshop", "Festival", "Meetup", "Expo", "Panel"],
  fundraisers: ["All", "Infrastructure", "Education", "Environment", "Legal", "Food Security"],
  resources: ["All", "Toolkit", "Video", "Guide", "Handbook", "Technical Guide", "Database"],
};

type ListingCardProps = {
  listing: Listing;
  category: ListingCategory;
  isFavorited: boolean;
  isPending: boolean;
  onToggleFavorite: (id: string) => void;
  onCardClick: (id: string) => void;
};

const ListingCard = ({
  listing,
  category,
  isFavorited,
  isPending,
  onToggleFavorite,
  onCardClick,
}: ListingCardProps) => {
  const getCategorySpecificInfo = () => {
    switch (category) {
      case "jobs":
        const job = listing as JobListing;
        return (
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1" />
              {job.location}
            </div>
            <div className="text-sm text-muted-foreground">
              {job.jobType} • {job.experienceLevel}
            </div>
            <div className="text-sm font-medium text-primary">{job.salary}</div>
          </div>
        );
      case "events":
        const event = listing as EventListing;
        return (
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              {event.date}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1" />
              {event.location}
            </div>
            <div className="text-sm font-medium text-primary">{event.cost}</div>
          </div>
        );
      case "fundraisers":
        const fundraiser = listing as FundraiserListing;
          return (
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Goal: {fundraiser.goalAmount}</div>
            <div className="text-sm text-muted-foreground">Raised: {fundraiser.currentAmount}</div>
            <div className="text-sm font-medium text-primary">Deadline: {fundraiser.deadline}</div>
          </div>
        );
      case "resources":
        const resource = listing as ResourceListing;
            return (
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{resource.resourceType}</div>
            <div className="text-sm text-muted-foreground">Topic: {resource.topic}</div>
            <div className="text-sm font-medium text-primary">Level: {resource.difficultyLevel}</div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card
      className="group hover:shadow-lg transition-all duration-200 cursor-pointer"
      onClick={() => onCardClick(listing.id)}
    >
      <div className="relative">
        <img
          src={listing.image}
          alt={listing.title}
          className="w-full h-48 object-cover rounded-t-lg"
          loading="lazy"
        />
        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(listing.id);
          }}
          disabled={isPending}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            className={`h-5 w-5 ${
              isFavorited ? "text-red-500 fill-red-500" : "text-gray-400 hover:text-red-500"
            }`}
          />
        </button>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
          {listing.title}
        </CardTitle>
        <CardDescription className="line-clamp-3 text-sm">
          {listing.summary || listing.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">{getCategorySpecificInfo()}</CardContent>
    </Card>
  );
};

const Explore = () => {
  const navigate = useNavigate();
  const { isFavorited, toggleFavorite, isPending } = useFavorites();

  const [selectedCategory, setSelectedCategory] = useState<ListingCategory>("jobs");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [sortOption, setSortOption] = useState<SortOption>("most_recent");

  const { data: listings = [], isLoading, isError, error } = useQuery({
    queryKey: ["listings"],
    queryFn: fetchAllListings,
    staleTime: 1000 * 60 * 5,
  });

  const listingsByCategory = useMemo(() => {
    const grouped: Record<ListingCategory, Listing[]> = {
      jobs: [],
      events: [],
      fundraisers: [],
      resources: [],
    };

    listings.forEach((listing) => {
      grouped[listing.category].push(listing);
    });

    return grouped;
  }, [listings]);

  const location = useLocation();

  // initialize selectedCategory from query param if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category') as ListingCategory | null;
    if (cat && ['jobs', 'events', 'fundraisers', 'resources'].includes(cat)) {
      setSelectedCategory(cat as ListingCategory);
      setSelectedFilter('All');
      setSortOption('most_recent');
    }
    // only run on mount / when location.search changes
  }, [location.search]);

  const handleCardClick = (listingId: string) => {
    navigate(`/listing/${listingId}`);
  };

  const currentListings = listingsByCategory[selectedCategory] ?? [];

  const filteredListings = useMemo(() => {
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
          return matchesSearch && (listing as EventListing).date === selectedFilter;
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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">Explore Opportunities</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover jobs, events, funding, and resources to support your journey in environmental justice.
            </p>
          </div>

          {isLoading && (
            <div className="flex justify-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading opportunities...</p>
              </div>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-4 py-16">
              <p className="text-red-500 text-sm">
                We couldn’t load the latest listings.{" "}
                Please try again shortly.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSelectedFilter("All");
                  setSortOption("most_recent");
                }}
                className="flex items-center gap-2"
              >
                {category.icon}
                {category.title}
              </Button>
            ))}
          </div>

          {/* Search, Filter, and Sort */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={`Search ${selectedCategory}...`}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={selectedFilter}
              onChange={(event) => setSelectedFilter(event.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-48 min-w-48"
            >
              {filterOptions[selectedCategory].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as SortOption)}
                className="pl-10 pr-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-56 min-w-56 appearance-none"
              >
                {getSortOptions(selectedCategory).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              Showing {filteredListings.length} {selectedCategory}
              {searchQuery && ` matching "${searchQuery}"`}
              {selectedFilter !== "All" && ` in ${selectedFilter}`}
            </p>
          </div>

          {/* Listings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                category={selectedCategory}
                isFavorited={isFavorited(listing.id)}
                isPending={isPending(listing.id)}
                onToggleFavorite={toggleFavorite}
                onCardClick={handleCardClick}
              />
            ))}
          </div>

          {!isLoading && filteredListings.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                No {selectedCategory} found matching your criteria.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedFilter("All");
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            </div>
          )}

          <div className="mt-12 text-center">
            <Link to="/" className="text-primary hover:text-primary/80 underline">
              Back to Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Explore;
