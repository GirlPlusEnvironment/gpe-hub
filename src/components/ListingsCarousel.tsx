import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Briefcase, Calendar, DollarSign, BookOpen } from "lucide-react";
import type { Listing } from "@/types/listings";
import { fetchAllListings } from "@/lib/listings";

const categoryMeta: Record<Listing["category"], { label: string; icon: JSX.Element }> = {
  jobs: { label: "Jobs", icon: <Briefcase className="h-4 w-4" /> },
  events: { label: "Events", icon: <Calendar className="h-4 w-4" /> },
  fundraisers: { label: "Funding", icon: <DollarSign className="h-4 w-4" /> },
  resources: { label: "Resources", icon: <BookOpen className="h-4 w-4" /> },
};

const CATEGORY_ORDER: Listing["category"][] = ["jobs", "events", "fundraisers", "resources"];
function getListingTimestamp(l: Listing): number {
  const c: any =
    (l as any).createdAt ?? (l as any).created_at ??
    (l as any).postedAt ?? (l as any).posted_at ??
    (l as any).updatedAt ?? (l as any).updated_at ??
    (l as any).date ?? (l as any).startDate ?? (l as any).deadline;

  if (!c) return 0;
  if (typeof c === "number") return c;
  const t = Date.parse(c);
  return Number.isNaN(t) ? 0 : t;
}
const RECENT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function useGroupedListings(list: Listing[]) {
  return useMemo(() => {
    const cutoff = Date.now() - RECENT_DAYS * DAY_MS;
    const recentOnly = list.filter((l) => getListingTimestamp(l) >= cutoff);
    const sorted = [...recentOnly].sort(
      (a, b) => getListingTimestamp(b) - getListingTimestamp(a)
    );
    const grouped: Record<Listing["category"], Listing[]> = {
      jobs: [],
      events: [],
      fundraisers: [],
      resources: [],
    };
    sorted.forEach((l) => grouped[l.category].push(l));
    (Object.keys(grouped) as Listing["category"][]).forEach((key) => {
      grouped[key] = grouped[key].slice(0, 12);
    });

    return grouped;
  }, [list]);
}

export default function RecentListingsCarousel() {
  const { data: listings = [], isLoading, isError } = useQuery({
    queryKey: ["listings"],
    queryFn: fetchAllListings,
    staleTime: 5 * 60 * 1000,
  });

  const grouped = useGroupedListings(listings);
  const [active, setActive] = useState<Listing["category"]>("jobs");

  return (
    <section className="container mx-auto px-4 py-10">
      {/* Heading */}
      <div className="mb-6 flex flex-col items-center text-center gap-2">
        <h2 className="text-2xl md:text-3xl font-bold text-primary">Latest from the Community</h2>
        <p className="text-sm text-muted-foreground">Recent jobs, events, funding, and resources.</p>
        <div className="mt-2">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/explore">View all</Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        {CATEGORY_ORDER.map((cat) => (
          <Button
            key={cat}
            variant={active === cat ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setActive(cat)}
          >
            {categoryMeta[cat].icon}
            {categoryMeta[cat].label}
          </Button>
        ))}
      </div>

      {/* Loading / Error / Empty states */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      {isError && (
        <p className="text-center text-sm text-red-500 py-8">
          Couldn't load the latest listings. Try again shortly.
        </p>
      )}

      {!isLoading && !isError && (
        <CarouselStrip
          items={grouped[active]}
          emptyLabel={`No recent ${categoryMeta[active].label.toLowerCase()} in the last ${RECENT_DAYS} days.`}
        />
      )}
    </section>
  );
}

function CarouselStrip({ items, emptyLabel }: { items: Listing[]; emptyLabel: string }) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (dir: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({
      left: (dir === "left" ? -1 : 1) * Math.floor(el.clientWidth * 0.9),
      behavior: "smooth",
    });
  };

  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center">{emptyLabel}</p>;
  }

  return (
    <div className="relative">
      {/* Left Arrow */}
      <button
        aria-label="Scroll left"
        onClick={() => scrollBy("left")}
        className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 rounded-full border bg-background/80 shadow backdrop-blur md:grid place-items-center hover:bg-background"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Right Arrow */}
      <button
        aria-label="Scroll right"
        onClick={() => scrollBy("right")}
        className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 rounded-full border bg-background/80 shadow backdrop-blur md:grid place-items-center hover:bg-background"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto scroll-smooth px-14 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] snap-x snap-mandatory"
        style={{ scrollbarWidth: "none" as any }}
      >
        {items.map((l) => (
          <Link key={l.id} to={`/listing/${String(l.id)}`} className="block">
            <Card className="min-w-[260px] max-w-[260px] flex-shrink-0 cursor-pointer hover:shadow-lg transition snap-start">
              <div className="relative">
                <img
                  src={l.image}
                  alt={l.title}
                  className="h-40 w-full rounded-t-lg object-cover"
                  loading="lazy"
                />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="line-clamp-1 text-base">{l.title}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">
                  {l.summary || l.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {categoryMeta[l.category].label}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
