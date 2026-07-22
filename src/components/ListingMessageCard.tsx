import { Link } from "react-router-dom";
import { Briefcase, Calendar, DollarSign, BookOpen } from "lucide-react";
import type { Listing } from "@/types/listings";
import { Sticker } from "@/components/camp/CampDesign";

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
      className="block max-w-full" 
      onClick={(e) => e.stopPropagation()}
    >
      <article className="gpe-card-sm gpe-hover-lift w-full min-w-0 max-w-[400px] cursor-pointer overflow-hidden">
        <div className="relative">
          <img
            src={listing.image}
            alt={listing.title}
            className="h-40 w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="p-4 pb-2">
          <h4 className="line-clamp-2 break-words font-header text-base uppercase leading-tight">{listing.title}</h4>
          <p className="mt-2 line-clamp-3 break-words text-xs font-bold text-black/65">
            {listing.summary || listing.description}
          </p>
        </div>
        <div className="p-4 pt-0">
          <Sticker accent="yellow" rotate="none" className="gap-1 px-2 py-1 text-[10px]">
            {categoryMeta[listing.category].icon}
            {categoryMeta[listing.category].label}
          </Sticker>
        </div>
      </article>
    </Link>
  );
};

export default ListingMessageCard;
