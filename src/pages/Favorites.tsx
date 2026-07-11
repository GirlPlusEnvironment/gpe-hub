import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MapPin, Clock, Briefcase, Calendar, DollarSign, BookOpen, Search, ArrowUpDown } from "lucide-react";
import type { EventListing, FundraiserListing, JobListing, Listing, ResourceListing } from "@/types/listings";
import { fetchFavoriteListings } from "@/lib/listings";
import { useFavorites } from "@/contexts/FavoriteContext";
import { useAuth } from "@/contexts/AuthContext";
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
      case "jobs": {
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
      }
      case "events": {
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
      }
      case "fundraisers": {
        const fundraiser = listing as FundraiserListing;
        return (
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Goal: {fundraiser.goalAmount}</div>
            <div className="text-sm text-muted-foreground">Raised: {fundraiser.currentAmount}</div>
            <div className="text-sm font-medium text-primary">Deadline: {fundraiser.deadline}</div>
          </div>
        );
      }
      case "resources": {
        const resource = listing as ResourceListing;
        return (
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{resource.resourceType}</div>
            <div className="text-sm text-muted-foreground">Topic: {resource.topic}</div>
            <div className="text-sm font-medium text-primary">Level: {resource.difficultyLevel}</div>
          </div>
        );
      }
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

const Favorites = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { favoritedListings, isFavorited, toggleFavorite, isPending } = useFavorites();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ListingCategory>("jobs");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [sortOption, setSortOption] = useState<SortOption>("most_recent");

  const { data: listings = [], isLoading, isError, error } = useQuery({
    queryKey: ["favorite-listings", profile?.id],
    queryFn: () => fetchFavoriteListings(profile!.id),
    enabled: Boolean(profile?.id),
    staleTime: 1000 * 60 * 5,
  });

  const favoriteItems = useMemo(() => {
    const inCategory = listings.filter((l) => l.category === selectedCategory);

    const q = searchQuery.toLowerCase();
    const matchesSearch = (l: Listing) =>
      `${l.title} ${l.description} ${l.summary ?? ""}`.toLowerCase().includes(q);

    const matchesFilter = (l: Listing) => {
      if (selectedFilter === "All") return true;
      switch (selectedCategory) {
        case "jobs":
          return (l as JobListing).jobType === selectedFilter;
        case "events":
          return (l as EventListing).eventType === selectedFilter || (l as EventListing).date === selectedFilter;
        case "fundraisers":
          return (l.tags ?? []).includes(selectedFilter);
        case "resources":
          return (l as ResourceListing).resourceType === selectedFilter;
        default:
          return true;
      }
    };

    const filtered = inCategory.filter((l) => matchesSearch(l) && matchesFilter(l));
    return sortListings(filtered, sortOption);
  }, [listings, selectedCategory, selectedFilter, searchQuery, sortOption]);

  const handleCardClick = (listingId: string) => {
    navigate(`/listing/${listingId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">Your Favorites</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Quick access to items you’ve saved.
            </p>
          </div>

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

          {isLoading && (
            <div className="flex justify-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading favorites...</p>
              </div>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-4 py-16">
              <p className="text-red-500 text-sm">
                We couldn’t load your favorites. Please try again shortly.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}

{!isLoading && favoriteItems.length === 0 && (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
                <Heart className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No favorites yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                {listings.length > 0 
                  ? `You haven't saved any ${selectedCategory} yet. Browse and heart items to save them here.`
                  : "Start exploring and save items you're interested in by clicking the heart icon."
                }
              </p>
              <Link to="/explore">
                <Button className="gap-2">
                  <Search className="h-4 w-4" />
                  Explore Listings
                </Button>
              </Link>
            </div>
          )}

          {favoriteItems.length > 0 && (
            <>
              <div className="mb-6">
                <p className="text-sm text-muted-foreground">
                  Showing {favoriteItems.length} {selectedCategory}
                  {searchQuery && ` matching "${searchQuery}"`}
                  {selectedFilter !== "All" && ` in ${selectedFilter}`}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favoriteItems.map((listing) => (
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
            </>
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

export default Favorites;


