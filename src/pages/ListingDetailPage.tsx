import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ListingDetail from "@/components/ListingDetail";
import { fetchListingById } from "@/lib/listings";
import { useFavorites } from "@/contexts/FavoriteContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
          <div className="gpe-card p-10 text-center">
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-[6px] border-black border-t-transparent" />
            <p className="mt-4 font-bold uppercase text-black/70">Loading listing details...</p>
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
          <div className="gpe-card p-10 text-center">
            <h1 className="gpe-heading text-4xl">Listing Not Found</h1>
            <p className="mt-4 font-bold text-black/70">
              The listing you&apos;re looking for doesn&apos;t exist or was removed.
            </p>
            <button onClick={() => navigate("/explore")} className="gpe-pill mt-6 bg-black text-white">
              Back to Explore
            </button>
          </div>
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
