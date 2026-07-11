import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Calendar, DollarSign, BookOpen } from "lucide-react";
import type { Listing } from "@/types/listings";

interface ListingMessageCardProps {
  listing: Listing;
}

const categoryMeta: Record<Listing["category"], { label: string; icon: JSX.Element }> = {
  jobs: { label: "Jobs", icon: <Briefcase className="h-4 w-4" /> },
  events: { label: "Events", icon: <Calendar className="h-4 w-4" /> },
  fundraisers: { label: "Funding", icon: <DollarSign className="h-4 w-4" /> },
  resources: { label: "Resources", icon: <BookOpen className="h-4 w-4" /> },
};

const ListingMessageCard = ({ listing }: ListingMessageCardProps) => {
  return (
    <Link 
      to={`/listing/${listing.id}`} 
      className="block" 
      onClick={(e) => e.stopPropagation()}
    >
      <Card className="min-w-[260px] max-w-[400px] cursor-pointer border bg-card transition hover:shadow-lg">
        <div className="relative">
          <img
            src={listing.image}
            alt={listing.title}
            className="h-40 w-full rounded-t-lg object-cover"
            loading="lazy"
          />
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="line-clamp-2 break-words text-base leading-tight">{listing.title}</CardTitle>
          <CardDescription className="line-clamp-3 break-words text-xs">
            {listing.summary || listing.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
            {categoryMeta[listing.category].icon}
            {categoryMeta[listing.category].label}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ListingMessageCard;
