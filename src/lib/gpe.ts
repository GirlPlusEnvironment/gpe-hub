import type { Listing } from "@/types/listings";

type ListingCategory = Listing["category"];

export const gpeCategoryConfig: Record<
  ListingCategory,
  {
    label: string;
    badge: string;
    surface: string;
    text: string;
  }
> = {
  jobs: {
    label: "Job",
    badge: "bg-gpe-jobs text-black",
    surface: "bg-cyan-100",
    text: "text-cyan-700",
  },
  events: {
    label: "Event",
    badge: "bg-gpe-events text-black",
    surface: "bg-yellow-100",
    text: "text-yellow-700",
  },
  fundraisers: {
    label: "Funding",
    badge: "bg-gpe-funding text-black",
    surface: "bg-green-100",
    text: "text-green-700",
  },
  resources: {
    label: "Resource",
    badge: "bg-gpe-resources text-black",
    surface: "bg-purple-100",
    text: "text-purple-700",
  },
};
