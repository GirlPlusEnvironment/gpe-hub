import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ListingDetail from "@/components/ListingDetail";
import { fetchListingById } from "@/lib/listings";
import { useFavorites } from "@/contexts/FavoriteContext";

const ListingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isFavorited, toggleFavorite, isPending } = useFavorites();

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => fetchListingById(id as string),
    enabled: Boolean(id),
  });

  const handleBack = () => {
    navigate("/explore");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading listing details...</p>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Listing Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The listing you&apos;re looking for doesn&apos;t exist or was removed.
          </p>
          <button
            onClick={() => navigate("/explore")}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Back to Explore
          </button>
        </div>
      </div>
    );
  }

  return (
    <ListingDetail
      listing={listing}
      onBack={handleBack}
      isFavorited={isFavorited(listing.id)}
      isPending={isPending(listing.id)}
      onToggleFavorite={toggleFavorite}
    />
  );
};

export default ListingDetailPage;

