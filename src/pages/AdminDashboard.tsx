import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Link } from "react-router-dom";

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
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) throw sessionErr;
    const user = sessionData.session?.user;
    if (!user) return false;

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profErr) throw profErr;
    return profile?.role === "admin";
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
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.");
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
    return <div className="p-6 text-sm text-muted-foreground">Loading admin…</div>;
  }

  if (!allowed) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don’t have access to this page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
     <div className="flex items-end justify-between gap-4">
  <div>
    <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
    <p className="text-sm text-muted-foreground">
      Moderate listings (flag / remove / restore).
    </p>
  </div>

  <div className="flex gap-2">
    <Link to="/" className="px-3 py-2 rounded-xl border text-sm hover:bg-muted">
      Back to Home
    </Link>

    <button
      className="px-3 py-2 rounded-xl border text-sm hover:bg-muted"
      onClick={loadData}
    >
      Refresh
    </button>
  </div>
</div>


      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-2xl border overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-medium text-muted-foreground bg-muted/30">
          <div className="col-span-4">Post</div>
          <div className="col-span-3">Flags</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>

        <div className="divide-y">
          {listings.map((l) => {
            const listingFlags = flagsByListing.get(l.id) ?? [];
            const openFlags = listingFlags.filter((f) => !f.resolved);
            return (
              <div key={l.id} className="grid grid-cols-12 gap-3 px-4 py-3 items-start">
                <div className="col-span-4">
                  <div className="font-medium">{l.title ?? "Untitled"}</div>
                  {l.description && (
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {l.description}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">{l.id}</div>
                </div>

                <div className="col-span-3">
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

                <div className="col-span-2">
                  {l.is_removed ? (
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs bg-red-500/15 text-red-200 border border-red-500/20">
                      Removed
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs bg-emerald-500/15 text-emerald-200 border border-emerald-500/20">
                      Visible
                    </span>
                  )}
                </div>

                <div className="col-span-3 flex justify-end gap-2">
                  <button
                    className="px-3 py-1.5 rounded-xl border text-sm hover:bg-muted"
                    onClick={() => flagListing(l.id)}
                  >
                    Flag
                  </button>

                  <button
                    className="px-3 py-1.5 rounded-xl border text-sm hover:bg-muted"
                    disabled={openFlags.length === 0}
                    onClick={() => resolveFlags(l.id)}
                    title={openFlags.length === 0 ? "No open flags" : "Resolve open flags"}
                  >
                    Resolve
                  </button>

                  {!l.is_removed ? (
                    <button
                      className="px-3 py-1.5 rounded-xl border text-sm hover:bg-muted"
                      onClick={() => removeListing(l.id)}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      className="px-3 py-1.5 rounded-xl border text-sm hover:bg-muted"
                      onClick={() => restoreListing(l.id)}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {listings.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">No listings found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
