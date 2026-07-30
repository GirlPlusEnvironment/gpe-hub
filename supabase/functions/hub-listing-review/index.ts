import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { recordLeadAction, recordPointEventForLeadAction, updateFormSubmission } from "../_shared/form-submission.ts";
import { normalizeEmail, safeError, sanitizeText, supabaseFetch } from "../_shared/neon-membership.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type AuthUser = { id: string; email: string };
type ListingCategory = "jobs" | "events" | "fundraisers" | "resources";

const CATEGORY_RULES: Record<ListingCategory, { actionType: string; eventType: string; ruleKey: string }> = {
  jobs: { actionType: "job_submission", eventType: "JOB_APPROVED", ruleKey: "job_approved" },
  events: { actionType: "event_submission", eventType: "EVENT_SUBMITTED", ruleKey: "event_submitted" },
  fundraisers: { actionType: "funding_submission", eventType: "OPPORTUNITY_APPROVED", ruleKey: "opportunity_approved" },
  resources: { actionType: "resource_submission", eventType: "RESOURCE_APPROVED", ruleKey: "resource_approved" },
};

function serviceHeaders(extra: HeadersInit = {}): HeadersInit {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Supabase service role key is not configured.");
  return { "Content-Type": "application/json", "apikey": key, "Authorization": `Bearer ${key}`, ...extra };
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

async function assertAdmin(userId: string) {
  const res = await supabaseFetch("rpc/is_admin", {
    method: "POST",
    body: JSON.stringify({ check_user_id: userId }),
  });
  if (!res.ok || !await res.json().catch(() => false)) throw new Error("Only admins can review Hub submissions.");
}

async function activeMembership(profileId: string) {
  const res = await supabaseFetch("rpc/profile_has_active_membership", {
    method: "POST",
    body: JSON.stringify({ p_profile_id: profileId }),
  });
  return res.ok ? Boolean(await res.json().catch(() => false)) : false;
}

async function loadListing(listingId: string) {
  const res = await supabaseFetch(`listings?select=*&id=eq.${encodeURIComponent(listingId)}&limit=1`);
  if (!res.ok) throw new Error("Could not load listing.");
  const rows = await res.json();
  return rows[0] as Record<string, unknown> | undefined;
}

async function loadProfile(profileId: string) {
  const res = await supabaseFetch(`profiles?select=id,email,first_name,last_name,neon_account_id&id=eq.${encodeURIComponent(profileId)}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return rows[0] as Record<string, unknown> | undefined || null;
}

async function suggestedPoints(ruleKey: string) {
  const res = await supabaseFetch(`hub_point_rules?select=point_value&action_type=eq.${encodeURIComponent(ruleKey)}&active=eq.true&limit=1`);
  if (!res.ok) return 0;
  const rows = await res.json().catch(() => []);
  return Number(rows[0]?.point_value || 0);
}

function categoryConfig(category: unknown) {
  const key = String(category || "") as ListingCategory;
  const config = CATEGORY_RULES[key];
  if (!config) throw new Error("Unsupported listing category.");
  return config;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });

  try {
    assertAllowedOrigin(origin);
    if (req.method !== "POST") return jsonResponse({ ok: false, message: "Method not allowed." }, 405, origin);
    const user = await authenticatedUser(req);
    if (!user) return jsonResponse({ ok: false, message: "Sign in before reviewing submissions." }, 401, origin);
    await assertAdmin(user.id);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const listingId = sanitizeText(body.listingId, 80);
    const decision = sanitizeText(body.decision, 40);
    const notes = sanitizeText(body.notes, 1000);
    const requestedPoints = typeof body.points === "number" ? Math.max(0, Math.round(body.points)) : null;
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) throw new Error("Valid listing id is required.");
    if (!["approve", "reject"].includes(decision)) throw new Error("Review decision must be approve or reject.");

    const listing = await loadListing(listingId);
    if (!listing) throw new Error("Listing not found.");
    const config = categoryConfig(listing.category);
    const profileId = String(listing.submitted_by || "");
    const profile = profileId ? await loadProfile(profileId) : null;
    const email = normalizeEmail(profile?.email || "");
    const existingMetadata = (listing.metadata || {}) as Record<string, unknown>;
    const review = (existingMetadata.hub_action_review || {}) as Record<string, unknown>;
    const submissionId = sanitizeText(existingMetadata.hub_form_submission_id || review.form_submission_id, 80);
    const leadActionId = sanitizeText(review.lead_action_id, 80);
    const points = requestedPoints ?? await suggestedPoints(config.ruleKey);

    if (decision === "reject") {
      const rejectedMetadata = {
        ...existingMetadata,
        hub_action_review: {
          ...review,
          status: "rejected",
          rejected_at: new Date().toISOString(),
          rejected_by: user.id,
          reviewer_notes: notes || null,
          suggested_points: points,
          point_event_status: "not_created",
        },
      };
      await supabaseFetch(`listings?id=eq.${encodeURIComponent(listingId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ metadata: rejectedMetadata }),
      });
      if (submissionId) {
        await updateFormSubmission(submissionId, {
          submission_status: "rejected",
          points_status: "not_applicable",
          points_result: { status: "rejected", points: 0, reason: notes || "Rejected by Team GPE." },
        }).catch(() => undefined);
      }
      return jsonResponse({ ok: true, status: "rejected", listingId, pointsAwarded: 0 }, 200, origin);
    }

    if (!profile || !email) throw new Error("The submitter profile could not be resolved.");
    let leadAction: Record<string, unknown> | null = leadActionId ? { id: leadActionId, user_id: profileId } : null;
    if (!leadAction) {
      const recorded = await recordLeadAction({
        submissionId: submissionId || null,
        email,
        firstName: sanitizeText(profile.first_name, 120),
        lastName: sanitizeText(profile.last_name, 120),
        neonAccountId: profile.neon_account_id ? String(profile.neon_account_id) : null,
        userId: profileId,
        actionType: config.actionType,
        actionSlug: `hub-${listing.category}-submission`,
        provider: "hub",
        providerActionId: listingId,
        sourceUrl: `https://members.girlplusenvironment.org/listing/${listingId}`,
        pointsStatus: "requires_review",
        pointsResult: { status: "requires_review", rule: config.ruleKey, points },
        rawPayload: { listingId, listing },
        pipelineStatus: { content: "requires_review", points: "requires_review" },
      });
      leadAction = recorded?.action || null;
    }

    const memberActive = await activeMembership(profileId);
    let pointsResult: Record<string, unknown>;
    if (memberActive) {
      pointsResult = await recordPointEventForLeadAction({
        eventType: config.eventType,
        email,
        leadAction,
        lead: null,
        source: "hub_listing_review",
        sourceId: listingId,
        metadata: {
          listingId,
          listingCategory: listing.category,
          reviewerId: user.id,
          reviewerNotes: notes || null,
          suggestedPoints: points,
          ruleKey: config.ruleKey,
        },
      }) as Record<string, unknown>;
    } else {
      pointsResult = {
        status: "pending_membership",
        rule: config.ruleKey,
        points,
        awardedPoints: 0,
        pendingPoints: points,
        reason: "active_membership_required",
      };
    }

    const approvedMetadata = {
      ...existingMetadata,
      hub_action_review: {
        ...review,
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        reviewer_notes: notes || null,
        suggested_points: points,
        approved_points: pointsResult.status === "awarded" ? Number(pointsResult.awardedPoints || points) : 0,
        point_event_status: pointsResult.status,
        point_event_id: pointsResult.pointEventId || null,
        point_transaction_id: pointsResult.transactionId || null,
        lead_action_id: leadAction?.id || null,
      },
    };

    await supabaseFetch(`listings?id=eq.${encodeURIComponent(listingId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "published", metadata: approvedMetadata }),
    });

    if (submissionId) {
      await updateFormSubmission(submissionId, {
        submission_status: "completed",
        points_status: pointsResult.status || "not_applicable",
        points_result: pointsResult,
      }).catch(() => undefined);
    }

    return jsonResponse({
      ok: true,
      status: pointsResult.status || "not_applicable",
      listingId,
      pointEventId: pointsResult.pointEventId || null,
      transactionId: pointsResult.transactionId || null,
      pointsAwarded: Number(pointsResult.awardedPoints || 0),
      pointsPending: Number(pointsResult.pendingPoints || 0),
      pointsResult,
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("hub-listing-review", safeError(error));
    return jsonResponse({ ok: false, message: safeError(error) || "Review action failed." }, 400, origin);
  }
});
