import { supabase, supabaseUrl } from "@/lib/supabaseClient";

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

type FunctionErrorBody = {
  ok?: boolean;
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  error?: string;
  error_description?: string;
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

function errorMessageFromBody(body: FunctionErrorBody | null, fallback: string) {
  const parts = [
    body?.message,
    body?.error_description,
    body?.error,
    body?.code ? `Code: ${body.code}` : null,
    body?.details ? `Details: ${body.details}` : null,
    body?.hint ? `Hint: ${body.hint}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : fallback;
}

async function invokeHubFunction<T>(functionName: string, body: unknown, headers: Record<string, string> = {}) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) throw new Error("Sign in before submitting to the Hub.");

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const parsed = text
    ? (() => {
        try {
          return JSON.parse(text) as T & FunctionErrorBody;
        } catch {
          return { message: text } as T & FunctionErrorBody;
        }
      })()
    : null;
  if (!response.ok) {
    throw new Error(errorMessageFromBody(parsed, `${functionName} returned HTTP ${response.status}.`));
  }

  return parsed as T;
}

export async function submitHubListingForReview(args: {
  draftStorageKey: string;
  listing: HubListingPayload;
}) {
  const idempotencyKey = currentIdempotencyKey(args.draftStorageKey);
  const data = await invokeHubFunction<HubListingSubmissionResult>(
    "hub-listing-submit",
    {
      idempotencyKey,
      listing: args.listing,
    },
    {
      "idempotency-key": idempotencyKey,
    },
  );

  if (!data?.ok || !data.listingId) throw new Error(data?.message || "Listing could not be submitted.");
  return data;
}

export async function reviewHubListing(args: {
  listingId: string;
  decision: "approve" | "reject";
  points?: number | null;
  notes?: string | null;
}) {
  const data = await invokeHubFunction<{
    ok?: boolean;
    status?: string;
    pointsAwarded?: number;
    pointsPending?: number;
    message?: string;
  }>("hub-listing-review", args);

  if (!data?.ok) throw new Error(data?.message || "Review action failed.");
  return data;
}
