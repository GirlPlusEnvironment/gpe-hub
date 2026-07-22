import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ListingDetail from "@/components/ListingDetail";
import { fetchAllListings, fetchListingById } from "@/lib/listings";
import { useFavorites } from "@/hooks/useFavorites";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CampButton, EmptyState, LoadingCampCard } from "@/components/camp/CampDesign";
import type { Listing } from "@/types/listings";

type ListingDetailPageProps = {
  expectedCategory?: Listing["category"];
  expectedResourceType?: string;
  routeLabel?: string;
};

const categoryExplorePath: Record<Listing["category"], string> = {
  jobs: "/explore?category=jobs",
  events: "/explore?category=events",
  fundraisers: "/explore?category=fundraisers",
  resources: "/explore?category=resources",
};

const ListingDetailPage = ({ expectedCategory, expectedResourceType, routeLabel }: ListingDetailPageProps) => {
  const { id, jobId, resourceId, fundingId, eventId, toolkitId, opportunityId } = useParams<{
    id?: string;
    jobId?: string;
    resourceId?: string;
    fundingId?: string;
    eventId?: string;
    toolkitId?: string;
    opportunityId?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isFavorited, toggleFavorite, isPending } = useFavorites();
  const listingId = jobId || resourceId || fundingId || eventId || toolkitId || opportunityId || id;

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => fetchListingById(listingId as string),
    enabled: Boolean(listingId),
  });

  const { data: allListings = [] } = useQuery({
    queryKey: ["listings"],
    queryFn: fetchAllListings,
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(listing),
  });

  const relatedListings = useMemo(() => {
    if (!listing) return [];
    const tagSet = new Set((listing.tags ?? []).map((tag) => tag.toLowerCase()));
    const org = "company" in listing
      ? listing.company
      : "organizer" in listing
      ? listing.organizer
      : "author" in listing
      ? listing.author
      : "";
    const topic = "topic" in listing ? listing.topic : "";
    return allListings
      .filter((candidate) => candidate.id !== listing.id && candidate.category === listing.category)
      .sort((a, b) => {
        const aScore = (a.tags ?? []).filter((tag) => tagSet.has(tag.toLowerCase())).length;
        const bScore = (b.tags ?? []).filter((tag) => tagSet.has(tag.toLowerCase())).length;
        const aOrg = "company" in a ? a.company : "organizer" in a ? a.organizer : "author" in a ? a.author : "";
        const bOrg = "company" in b ? b.company : "organizer" in b ? b.organizer : "author" in b ? b.author : "";
        const aTopic = "topic" in a ? a.topic : "";
        const bTopic = "topic" in b ? b.topic : "";
        const aBoost = (org && aOrg === org ? 2 : 0) + (topic && aTopic === topic ? 2 : 0);
        const bBoost = (org && bOrg === org ? 2 : 0) + (topic && bTopic === topic ? 2 : 0);
        return bScore + bBoost - (aScore + aBoost);
      })
      .slice(0, 3);
  }, [allListings, listing]);

  const handleBack = () => {
    const fallback = listing ? categoryExplorePath[listing.category] : "/explore";
    const from = typeof location.state?.from === "string" && location.state.from.startsWith("/explore")
      ? location.state.from
      : fallback;
    navigate(from);
  };

  if (isLoading) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-xl">
            <LoadingCampCard label="Loading listing details" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const resourceTypeMismatch =
    expectedResourceType &&
    listing &&
    listing.category === "resources" &&
    listing.resourceType !== expectedResourceType;

  if (isError || !listing || (expectedCategory && listing.category !== expectedCategory) || resourceTypeMismatch) {
    const label = routeLabel
      || (expectedCategory === "jobs" ? "Job"
        : expectedCategory === "resources" && expectedResourceType ? expectedResourceType
        : expectedCategory === "resources" ? "Resource"
        : expectedCategory === "fundraisers" ? "Funding"
        : expectedCategory === "events" ? "Event"
        : "Listing");
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main flex min-h-[70vh] items-center justify-center">
          <EmptyState
            illustration="clipboard"
            title={`${label} Not Found`}
            description={`The ${label.toLowerCase()} you are looking for does not exist, was removed, or is no longer available.`}
            action={<CampButton onClick={() => navigate("/explore")}>Back to Explore</CampButton>}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <ListingDetail
          listing={listing}
          onBack={handleBack}
          isFavorited={isFavorited(listing.id)}
          isPending={isPending(listing.id)}
          onToggleFavorite={toggleFavorite}
          relatedListings={relatedListings}
        />
      </main>
      <Footer />
    </div>
  );
};

export default ListingDetailPage;
