import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, recordLeadAction, updateFormSubmission } from "../_shared/form-submission.ts";
import { normalizeEmail, safeError, sanitizeText, supabaseFetch } from "../_shared/neon-membership.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type AuthUser = {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
};

type ListingCategory = "jobs" | "events" | "fundraisers" | "resources";

const CATEGORY_RULES: Record<ListingCategory, {
  actionType: string;
  eventType: string;
  ruleKey: string;
  label: string;
}> = {
  jobs: {
    actionType: "job_submission",
    eventType: "JOB_APPROVED",
    ruleKey: "job_approved",
    label: "job listing",
  },
  events: {
    actionType: "event_submission",
    eventType: "EVENT_SUBMITTED",
    ruleKey: "event_submitted",
    label: "event",
  },
  fundraisers: {
    actionType: "funding_submission",
    eventType: "OPPORTUNITY_APPROVED",
    ruleKey: "opportunity_approved",
    label: "funding opportunity",
  },
  resources: {
    actionType: "resource_submission",
    eventType: "RESOURCE_APPROVED",
    ruleKey: "resource_approved",
    label: "resource",
  },
};

function serviceHeaders(extra: HeadersInit = {}): HeadersInit {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Supabase service role key is not configured.");
  return {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    ...extra,
  };
}

async function authenticatedUser(req: Request): Promise<AuthUser | null> {
  const token = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!token || !base) return null;
  const res = await fetch(`${base}/auth/v1/user`, { headers: serviceHeaders({ Authorization: `Bearer ${token}` }) });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null) as AuthUser | null;
  return user?.id && user.email ? { ...user, email: normalizeEmail(user.email) } : null;
}

async function profileForUser(userId: string) {
  const res = await supabaseFetch(`profiles?select=id,email,first_name,last_name,full_name,username,neon_account_id&id=eq.${encodeURIComponent(userId)}&limit=1`);
  if (!res.ok) throw new Error("Could not load Hub profile.");
  const rows = await res.json();
  return rows[0] as Record<string, unknown> | undefined;
}

async function suggestedPoints(ruleKey: string) {
  const res = await supabaseFetch(`hub_point_rules?select=point_value&action_type=eq.${encodeURIComponent(ruleKey)}&active=eq.true&limit=1`);
  if (!res.ok) return 0;
  const rows = await res.json().catch(() => []);
  return Number(rows[0]?.point_value || 0);
}

async function listingById(listingId: string) {
  const res = await supabaseFetch(`listings?select=id,status,metadata&id=eq.${encodeURIComponent(listingId)}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return rows[0] || null;
}

function stringValue(record: Record<string, unknown>, key: string, max = 500) {
  return sanitizeText(record[key], max);
}

function validateListing(input: Record<string, unknown>) {
  const category = String(input.category || "") as ListingCategory;
  if (!CATEGORY_RULES[category]) throw new Error("Unsupported listing category.");
  if (!stringValue(input, "title", 220)) throw new Error("Title is required.");
  return category;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });

  try {
    assertAllowedOrigin(origin);
    if (req.method !== "POST") return jsonResponse({ ok: false, message: "Method not allowed." }, 405, origin);

    const user = await authenticatedUser(req);
    if (!user) return jsonResponse({ ok: false, message: "Sign in before submitting to the Hub." }, 401, origin);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const idempotencyKey = sanitizeText(body.idempotencyKey || req.headers.get("idempotency-key"), 180);
    const listing = (body.listing || {}) as Record<string, unknown>;
    const category = validateListing(listing);
    if (!idempotencyKey) return jsonResponse({ ok: false, message: "Submission idempotency key is required." }, 400, origin);

    const profile = await profileForUser(user.id);
    if (!profile) return jsonResponse({ ok: false, message: "A Hub profile is required before submitting." }, 403, origin);

    const config = CATEGORY_RULES[category];
    const points = await suggestedPoints(config.ruleKey);
    const profileEmail = normalizeEmail(profile.email || user.email);
    const { submission, duplicate } = await createFormSubmission({
      idempotencyKey,
      formKey: `hub_${config.actionType}`,
      email: profileEmail,
      payload: {
        listing,
        category,
        submittedBy: user.id,
        suggestedPoints: points,
        ruleKey: config.ruleKey,
        eventType: config.eventType,
      },
    });

    const existingListingId = String(((submission.submission_payload || {}) as Record<string, unknown>).listingId || "");
    if (duplicate && existingListingId) {
      const existingListing = await listingById(existingListingId);
      if (existingListing) {
        return jsonResponse({
          ok: true,
          duplicate: true,
          listingId: existingListingId,
          status: "requires_review",
          suggestedPoints: points,
          message: `Your ${config.label} is already in review. If approved, you will earn ${points} points.`,
        }, 200, origin);
      }
    }

    const metadata = {
      ...((listing.metadata || {}) as Record<string, unknown>),
      hub_form_submission_id: submission.id,
      hub_action_review: {
        status: "requires_review",
        requires_review: true,
        suggested_points: points,
        rule_key: config.ruleKey,
        event_type: config.eventType,
        submitted_at: new Date().toISOString(),
      },
    };

    const insert = await supabaseFetch("listings", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        category,
        title: stringValue(listing, "title", 220),
        summary: stringValue(listing, "summary", 500) || null,
        description: stringValue(listing, "description", 5000) || null,
        image_url: stringValue(listing, "image_url", 1000) || null,
        location: stringValue(listing, "location", 220) || null,
        tags: Array.isArray(listing.tags) ? listing.tags.map((tag) => sanitizeText(tag, 80)).filter(Boolean) : [],
        status: "pending_review",
        moderation_status: "pending_review",
        submitted_by: user.id,
        metadata,
      }),
    });
    if (!insert.ok) throw new Error(`Could not create listing: ${(await insert.text()).slice(0, 400)}`);
    const listingRow = (await insert.json())[0] as Record<string, unknown>;

    const lead = await recordLeadAction({
      submissionId: String(submission.id),
      email: profileEmail,
      firstName: stringValue(profile, "first_name", 120),
      lastName: stringValue(profile, "last_name", 120),
      neonAccountId: profile.neon_account_id ? String(profile.neon_account_id) : null,
      userId: user.id,
      actionType: config.actionType,
      actionSlug: `hub-${category}-submission`,
      provider: "hub",
      providerActionId: String(listingRow.id),
      sourceUrl: `https://members.girlplusenvironment.org/listing/${listingRow.id}`,
      pointsStatus: "requires_review",
      pointsResult: {
        status: "requires_review",
        rule: config.ruleKey,
        points,
        eventType: config.eventType,
        source: "hub_listing_submission",
        sourceId: listingRow.id,
      },
      rawPayload: { listing, listingId: listingRow.id },
      pipelineStatus: { content: "requires_review", points: "requires_review" },
    });

    await updateFormSubmission(String(submission.id), {
      submission_status: "requires_manual_review",
      submission_payload: {
        listing,
        category,
        listingId: listingRow.id,
        leadActionId: lead?.action?.id || null,
        suggestedPoints: points,
        ruleKey: config.ruleKey,
        eventType: config.eventType,
      },
      points_status: "requires_review",
      points_result: {
        status: "requires_review",
        rule: config.ruleKey,
        points,
        listingId: listingRow.id,
        leadActionId: lead?.action?.id || null,
      },
    });

    await supabaseFetch(`listings?id=eq.${encodeURIComponent(String(listingRow.id))}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        metadata: {
          ...metadata,
          hub_action_review: {
            ...(metadata.hub_action_review as Record<string, unknown>),
            lead_action_id: lead?.action?.id || null,
          },
        },
      }),
    }).catch(() => undefined);

    return jsonResponse({
      ok: true,
      duplicate: false,
      listingId: listingRow.id,
      submissionId: submission.id,
      leadActionId: lead?.action?.id || null,
      status: "requires_review",
      suggestedPoints: points,
      message: `Submitted for review. If approved, you will earn ${points} points.`,
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("hub-listing-submit", safeError(error));
    return jsonResponse({ ok: false, message: safeError(error) || "Listing could not be submitted." }, 400, origin);
  }
});
