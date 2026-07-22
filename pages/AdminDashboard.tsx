import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/roles";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, StatSticker, Sticker, Tape } from "@/components/camp/CampDesign";

type Listing = {
  id: string;
  title?: string | null;
  description?: string | null;
  created_at?: string;
  is_removed: boolean;
};

type FlagRow = {
  id: string;
  listing_id: string;
  reason: string | null;
  flagged_at: string;
  resolved: boolean;
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const flagsByListing = useMemo(() => {
    const map = new Map<string, FlagRow[]>();
    for (const f of flags) {
      if (!map.has(f.listing_id)) map.set(f.listing_id, []);
      map.get(f.listing_id)!.push(f);
    }
    return map;
  }, [flags]);

  async function checkAdmin() {
    return isAdmin();
  }

  async function loadData() {
    setError(null);

    // Admin sees removed + not removed because RLS policy allows admins
    const { data: listingsData, error: lErr } = await supabase
      .from("listings")
      .select("id,title,description,created_at,is_removed")
      .order("created_at", { ascending: false })
      .limit(200);

    if (lErr) throw lErr;
    setListings((listingsData ?? []) as Listing[]);

    // Flags: admin-only table
    const { data: flagsData, error: fErr } = await supabase
      .from("listing_flags")
      .select("id,listing_id,reason,flagged_at,resolved")
      .order("flagged_at", { ascending: false })
      .limit(500);

    if (fErr) throw fErr;
    setFlags((flagsData ?? []) as FlagRow[]);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const ok = await checkAdmin();
        setAllowed(ok);
        if (ok) await loadData();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function flagListing(listingId: string) {
    const reason = prompt("Reason for flag (optional)?") ?? null;
    setError(null);
    const { error } = await supabase.rpc("flag_listing", {
      p_listing_id: listingId,
      p_reason: reason,
    });
    if (error) return setError(error.message);
    await loadData();
  }

  async function resolveFlags(listingId: string) {
    setError(null);
    const { error } = await supabase.rpc("resolve_flags_for_listing", {
      p_listing_id: listingId,
    });
    if (error) return setError(error.message);
    await loadData();
  }

  async function removeListing(listingId: string) {
    if (!confirm("Remove this listing from the hub?")) return;
    setError(null);
    const { error } = await supabase.rpc("remove_listing", { p_listing_id: listingId });
    if (error) return setError(error.message);
    await loadData();
  }

  async function restoreListing(listingId: string) {
    setError(null);
    const { error } = await supabase.rpc("restore_listing", { p_listing_id: listingId });
    if (error) return setError(error.message);
    await loadData();
  }

  if (loading) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main">
          <div className="grid gap-4 md:grid-cols-3">
            <LoadingCampCard label="Loading admin dashboard" />
            <LoadingCampCard label="Loading admin dashboard" />
            <LoadingCampCard label="Loading admin dashboard" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main">
          <EmptyState
            illustration="badge"
            title="Admin Access Required"
            description="You do not have access to this moderation dashboard."
            action={<Link to="/"><CampButton variant="outline">Back to Dashboard</CampButton></Link>}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main space-y-6">
      <SectionHeader
        eyebrow={<Sticker accent="yellow">Admin</Sticker>}
        title="Admin Hub"
        description="Moderate listings, resolve flags, and restore removed records."
        action={
          <>
            <Link to="/"><CampButton variant="outline">Back to Home</CampButton></Link>
            <CampButton variant="cyan" onClick={loadData}>Refresh</CampButton>
          </>
        }
      />


      {error && (
        <div className="rounded-[1.5rem] border-[3px] border-red-500 bg-red-100 p-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatSticker label="Listings" value={listings.length.toLocaleString()} accent="yellow" />
        <StatSticker label="Open flags" value={flags.filter((flag) => !flag.resolved).length.toLocaleString()} accent="cyan" />
        <StatSticker label="Removed" value={listings.filter((listing) => listing.is_removed).length.toLocaleString()} accent="orange" />
      </div>

      <div className="gpe-card overflow-hidden p-0">
        <Tape className="m-4">Listing queue</Tape>
        <div className="hidden grid-cols-12 gap-3 bg-black px-4 py-3 text-xs font-bold uppercase text-white md:grid">
          <div className="col-span-4">Post</div>
          <div className="col-span-3">Flags</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>

        <div className="divide-y-[3px] divide-black">
          {listings.map((l) => {
            const listingFlags = flagsByListing.get(l.id) ?? [];
            const openFlags = listingFlags.filter((f) => !f.resolved);
            return (
              <div key={l.id} className="grid gap-4 px-4 py-4 md:grid-cols-12 md:items-start md:gap-3">
                <div className="md:col-span-4">
                  <div className="font-black">{l.title ?? "Untitled"}</div>
                  {l.description && (
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {l.description}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">{l.id}</div>
                </div>

                <div className="md:col-span-3">
                  <div className="text-sm">
                    <span className="font-medium">{openFlags.length}</span>{" "}
                    <span className="text-muted-foreground">open</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="font-medium">{listingFlags.length}</span>{" "}
                    <span className="text-muted-foreground">total</span>
                  </div>
                  {openFlags[0]?.reason && (
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      Latest: {openFlags[0].reason}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  {l.is_removed ? (
                    <span className="inline-flex items-center rounded-full border-[2px] border-black bg-red-100 px-3 py-1 text-xs font-black text-red-800">
                      Removed
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border-[2px] border-black bg-green-100 px-3 py-1 text-xs font-black text-green-800">
                      Visible
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap justify-start gap-2 md:col-span-3 md:justify-end">
                    <Button variant="outline" size="sm" onClick={() => flagListing(l.id)}>
                      Flag
                    </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={openFlags.length === 0}
                    onClick={() => resolveFlags(l.id)}
                    title={openFlags.length === 0 ? "No open flags" : "Resolve open flags"}
                  >
                    Resolve
                  </Button>

                  {!l.is_removed ? (
                    <Button variant="outline" size="sm" onClick={() => removeListing(l.id)}>
                      Remove
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => restoreListing(l.id)}>
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {listings.length === 0 && (
            <div className="p-4">
              <EmptyState
                illustration="clipboard"
                title="No Listings Found"
                description="There are no listing records in this moderation view."
              />
            </div>
          )}
        </div>
      </div>
      </main>
      <Footer />
    </div>
  );
}
