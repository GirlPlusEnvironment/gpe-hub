import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ListingDetail from "@/components/ListingDetail";
import { fetchListingById } from "@/lib/listings";
import { useFavorites } from "@/hooks/useFavorites";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CampButton, EmptyState, LoadingCampCard } from "@/components/camp/CampDesign";

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

  if (isError || !listing) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main flex min-h-[70vh] items-center justify-center">
          <EmptyState
            illustration="clipboard"
            title="Listing Not Found"
            description="The listing you are looking for does not exist or was removed."
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
        />
      </main>
      <Footer />
    </div>
  );
};

export default ListingDetailPage;
