import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFavoriteListingIds, addFavoriteListing, removeFavoriteListing } from "@/lib/listings";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import useDeepCompareEffect from "use-deep-compare-effect";

interface FavoriteContextType {
  favoritedListings: Set<string>;
  isFavorited: (listingId: string) => boolean;
  toggleFavorite: (listingId: string) => Promise<void>;
  isPending: (listingId: string) => boolean;
}

const FavoriteContext = createContext<FavoriteContextType | undefined>(undefined);

interface FavoriteProviderProps {
  children: ReactNode;
}

export const FavoriteProvider = ({ children }: FavoriteProviderProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [favoritedListings, setFavoritedListings] = useState<Set<string>>(new Set());
  const [pendingFavorites, setPendingFavorites] = useState<Set<string>>(new Set());

  const { data: favoriteIds = [] } = useQuery({
    queryKey: ["favorite-listing-ids", profile?.id],
    queryFn: () => fetchFavoriteListingIds(profile!.id),
    enabled: Boolean(profile?.id),
    staleTime: 1000 * 60,
  });

  // Sync favorite IDs from query to local state
  useDeepCompareEffect(() => {
    if (favoriteIds) {
      setFavoritedListings(new Set(favoriteIds));
    }
  }, [favoriteIds]);

  // Clear favorites when user logs out
  useEffect(() => {
    if (!profile?.id) {
      setFavoritedListings(new Set());
      setPendingFavorites(new Set());
    }
  }, [profile?.id]);

  const isFavorited = useCallback((listingId: string): boolean => {
    return favoritedListings.has(listingId);
  }, [favoritedListings]);

  const isPending = useCallback((listingId: string): boolean => {
    return pendingFavorites.has(listingId);
  }, [pendingFavorites]);

  const toggleFavorite = useCallback(async (listingId: string): Promise<void> => {
    if (!profile?.id) {
      toast({
        title: "Sign in required",
        description: "Log in to save favorites.",
      });
      return;
    }

    if (pendingFavorites.has(listingId)) {
      return;
    }

    const wasFavorited = favoritedListings.has(listingId);

    // Optimistic update
    setFavoritedListings((previous) => {
      const next = new Set(previous);
      if (wasFavorited) {
        next.delete(listingId);
      } else {
        next.add(listingId);
      }
      return next;
    });

    setPendingFavorites((previous) => new Set(previous).add(listingId));

    try {
      if (wasFavorited) {
        await removeFavoriteListing(profile.id, listingId);
      } else {
        await addFavoriteListing(profile.id, listingId);
      }
      
      // Invalidate the favorites query to ensure cache is updated
      await queryClient.invalidateQueries({
        queryKey: ["favorite-listing-ids", profile.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["favorite-listings", profile.id],
      });
    } catch (error) {
      console.error("Favorite toggle failed", error);
      
      // Revert optimistic update
      setFavoritedListings((previous) => {
        const next = new Set(previous);
        if (wasFavorited) {
          next.add(listingId);
        } else {
          next.delete(listingId);
        }
        return next;
      });

      toast({
        title: "Something went wrong",
        description: "We couldn't update your favorites. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPendingFavorites((previous) => {
        const next = new Set(previous);
        next.delete(listingId);
        return next;
      });
    }
  }, [profile?.id, toast, queryClient, pendingFavorites, favoritedListings]);

  const value = useMemo<FavoriteContextType>(() => ({
    favoritedListings,
    isFavorited,
    toggleFavorite,
    isPending,
  }), [favoritedListings, isFavorited, toggleFavorite, isPending]);

  return (
    <FavoriteContext.Provider value={value}>
      {children}
    </FavoriteContext.Provider>
  );
};

export const useFavorites = (): FavoriteContextType => {
  const context = useContext(FavoriteContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoriteProvider");
  }
  return context;
};
