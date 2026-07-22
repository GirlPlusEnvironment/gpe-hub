import { createContext } from "react";

export type FavoriteContextType = {
  favoritedListings: Set<string>;
  isFavorited: (listingId: string) => boolean;
  toggleFavorite: (listingId: string) => Promise<void>;
  isPending: (listingId: string) => boolean;
};

export const FavoriteContext = createContext<FavoriteContextType | undefined>(undefined);
