import { supabase } from "@/lib/supabaseClient";

type HubListingPayload = {
  category: "jobs" | "events" | "fundraisers" | "resources";
  title: string;
  summary?: string | null;
  description?: string | null;
  image_url?: string | null;
  location?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

type HubListingSubmissionResult = {
  ok?: boolean;
  duplicate?: boolean;
  listingId?: string;
  submissionId?: string;
  leadActionId?: string | null;
  status?: string;
  suggestedPoints?: number;
  message?: string;
};

function idempotencyStorageKey(draftStorageKey: string) {
  return `${draftStorageKey}:idempotency`;
}

function currentIdempotencyKey(draftStorageKey: string) {
  const key = idempotencyStorageKey(draftStorageKey);
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

export function clearListingSubmissionIdempotency(draftStorageKey: string) {
  localStorage.removeItem(idempotencyStorageKey(draftStorageKey));
}

export async function submitHubListingForReview(args: {
  draftStorageKey: string;
  listing: HubListingPayload;
}) {
  const idempotencyKey = currentIdempotencyKey(args.draftStorageKey);
  const { data, error } = await supabase.functions.invoke<HubListingSubmissionResult>("hub-listing-submit", {
    body: {
      idempotencyKey,
      listing: args.listing,
    },
    headers: {
      "idempotency-key": idempotencyKey,
    },
  });

  if (error) throw new Error(error.message || "Listing could not be submitted.");
  if (!data?.ok || !data.listingId) throw new Error(data?.message || "Listing could not be submitted.");
  return data;
}

export async function reviewHubListing(args: {
  listingId: string;
  decision: "approve" | "reject";
  points?: number | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    status?: string;
    pointsAwarded?: number;
    pointsPending?: number;
    message?: string;
  }>("hub-listing-review", {
    body: args,
  });

  if (error) throw new Error(error.message || "Review action failed.");
  if (!data?.ok) throw new Error(data?.message || "Review action failed.");
  return data;
}
