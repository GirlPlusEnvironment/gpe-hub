import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, logSync, updateFormSubmission } from "../_shared/form-submission.ts";
import { type Json, resolveMembership, safeError, supabaseFetch } from "../_shared/neon-membership.ts";
import { normalizeEmail, readJson, sanitizeText, ValidationError } from "../_shared/validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type ChallengeRow = {
  id: string;
  season_id: string;
  action_type_id: string | null;
  title: string;
  point_value: number | null;
  requires_review: boolean;
  requires_proof: boolean;
  auto_approve: boolean;
};

function requireWebhookSecret(req: Request) {
  const expected = Deno.env.get("ACTION_NETWORK_WEBHOOK_SECRET");
  if (!expected) throw new Error("Action Network webhook secret is not configured.");
  const auth = req.headers.get("authorization") || "";
  const explicit = req.headers.get("x-action-network-webhook-secret") || req.headers.get("x-gpe-action-network-secret") || "";
  if (auth !== `Bearer ${expected}` && explicit !== expected) throw new Response(JSON.stringify({ message: "Unauthorized." }), { status: 401, headers: { "Content-Type": "application/json" } });
}

function firstValue(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      const nested = firstValue(...value);
      if (nested) return nested;
    } else if (value && typeof value === "object") {
      const record = value as Json;
      const nested = firstValue(record.address, record.email, record.value, record.href, record.id, record.slug, record.title);
      if (nested) return nested;
    } else {
      const text = sanitizeText(value, 500);
      if (text) return text;
    }
  }
  return "";
}

function nestedRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function extractEmail(body: Json) {
  const person = (body.person || body.person_data || body.supporter || {}) as Json;
  return normalizeEmail(firstValue(
    body.email,
    person.email,
    person.email_address,
    person.email_addresses,
    (body.email_addresses as unknown) || ""
  ));
}

function extractName(body: Json) {
  const person = (body.person || body.person_data || body.supporter || {}) as Json;
  return {
    firstName: sanitizeText(firstValue(body.firstName, body.first_name, person.first_name, person.firstName, person.given_name), 120),
    lastName: sanitizeText(firstValue(body.lastName, body.last_name, person.last_name, person.lastName, person.family_name), 120)
  };
}

function extractActionSlug(body: Json) {
  const action = nestedRecord(body.action);
  const petition = nestedRecord(body.petition);
  const form = nestedRecord(body.form);
  const candidates = [
    body.actionSlug,
    body.action_slug,
    body.petition_slug,
    body.letter_slug,
    action.slug,
    action.name,
    petition.slug,
    petition.name,
    form.slug,
    form.name,
    action.url,
    action.href,
    petition.url,
    petition.href,
    form.url,
    form.href,
    body.url,
    body.action_url,
    body.referrer
  ];
  const raw = firstValue(...candidates);
  const match = raw.match(/actionnetwork\.org\/(?:petitions|letters)\/([^/?#]+)/i);
  return sanitizeText(match?.[1] || raw, 160);
}

function externalId(body: Json, email: string, actionSlug: string) {
  return sanitizeText(firstValue(body.id, body.submission_id, body.action_network_id, body.uuid), 160) || `${actionSlug}:${email}`;
}

async function idempotencyKeyFor(body: Json, email: string, actionSlug: string) {
  const source = `action-network:${externalId(body, email, actionSlug)}`;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const hash = Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `action-network:${hash}`;
}

async function activeSeason() {
  const slug = Deno.env.get("ACTIVE_CAMP_SEASON_SLUG") || "camp-gpe-2026";
  const res = await supabaseFetch(`gpe_seasons?select=id,slug,name&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  if (!res.ok) throw new Error("Could not load active Camp GPE season.");
  const rows = await res.json();
  if (!rows[0]) throw new Error("Active Camp GPE season is not configured.");
  return rows[0] as { id: string; slug: string; name: string };
}

async function challengeForAction(seasonId: string, actionSlug: string) {
  const res = await supabaseFetch([
    "gpe_challenges",
    "?select=id,season_id,action_type_id,title,point_value,requires_review,requires_proof,auto_approve",
    `&season_id=eq.${encodeURIComponent(seasonId)}`,
    "&external_source=eq.action_network",
    `&external_action_slug=eq.${encodeURIComponent(actionSlug)}`,
    "&is_active=eq.true",
    "&limit=1"
  ].join(""));
  if (!res.ok) throw new Error("Could not match Action Network action to Camp challenge.");
  const rows = await res.json();
  return (rows[0] || null) as ChallengeRow | null;
}

async function profileByEmail(email: string) {
  const res = await supabaseFetch(`profiles?select=id,email&email=eq.${encodeURIComponent(email)}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] as { id: string; email: string } | undefined || null;
}

async function upsertSeasonMember(params: { seasonId: string; email: string; neonAccountId: string | null }) {
  const profile = await profileByEmail(params.email);
  const res = await supabaseFetch("gpe_season_members?on_conflict=season_id,contact_email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      season_id: params.seasonId,
      user_id: profile?.id || null,
      neon_account_id: params.neonAccountId,
      contact_email: params.email,
      status: "registered"
    })
  });
  if (!res.ok) throw new Error("Could not link petition action to Camp season member.");
  const rows = await res.json();
  return rows[0] as { id: string; user_id: string | null };
}

async function createCampSubmission(params: {
  formSubmissionId: string;
  seasonId: string;
  seasonMemberId: string | null;
  userId: string | null;
  neonAccountId: string | null;
  email: string;
  actionSlug: string;
  body: Json;
}) {
  const res = await supabaseFetch("gpe_camp_challenge_submissions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      form_submission_id: params.formSubmissionId,
      season_id: params.seasonId,
      season_member_id: params.seasonMemberId,
      user_id: params.userId,
      neon_account_id: params.neonAccountId,
      contact_email: params.email,
      challenge_key: params.actionSlug,
      submitted_payload: { source: "action_network", actionSlug: params.actionSlug, payload: params.body },
      proof_links: [],
      review_status: params.seasonMemberId ? "pending" : "needs_info",
      member_link_status: params.seasonMemberId ? "linked" : "pending_reconciliation"
    })
  });
  if (!res.ok) throw new Error("Could not save Camp petition submission.");
  const rows = await res.json();
  return rows[0] as { id: string };
}

async function createSubmissionAction(params: { submissionId: string; challenge: ChallengeRow | null; actionSlug: string; status: "pending" | "duplicate" | "needs_information" }) {
  const res = await supabaseFetch("gpe_camp_submission_actions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      submission_id: params.submissionId,
      challenge_id: params.challenge?.id || null,
      action_type_id: params.challenge?.action_type_id || null,
      other_description: params.challenge ? null : `Action Network action: ${params.actionSlug}`,
      proof_urls: [],
      requested_points: params.challenge?.point_value ?? null,
      review_status: params.status
    })
  });
  if (!res.ok) throw new Error("Could not save Camp petition action.");
  const rows = await res.json();
  return rows[0] as { id: string };
}

async function emit(eventType: string, args: { userId: string | null; seasonMemberId: string | null; seasonId: string; submissionId: string; actionId: string; payload?: Json }) {
  await supabaseFetch("rpc/emit_gpe_notification", {
    method: "POST",
    body: JSON.stringify({
      p_event_type: eventType,
      p_user_id: args.userId,
      p_membership_id: args.seasonMemberId,
      p_season_id: args.seasonId,
      p_submission_id: args.submissionId,
      p_submission_action_id: args.actionId,
      p_payload: args.payload || {}
    })
  }).catch(() => undefined);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    if (origin) assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);
    requireWebhookSecret(req);

    const body = await readJson(req, 160_000) as Json;
    const email = extractEmail(body);
    if (!email) throw new ValidationError("Action Network payload is missing email.");
    const actionSlug = extractActionSlug(body);
    if (!actionSlug) throw new ValidationError("Action Network payload is missing action identifier.");
    const names = extractName(body);
    const idempotencyKey = await idempotencyKeyFor(body, email, actionSlug);
    const season = await activeSeason();

    const { submission: formSubmission, duplicate } = await createFormSubmission({
      idempotencyKey,
      formKey: "action_network_petition",
      email,
      payload: { source: "action_network", actionSlug, payload: body }
    });
    if (duplicate) return jsonResponse({ ok: true, duplicate: true, submissionId: formSubmission.id }, 200, origin);

    const challenge = await challengeForAction(season.id, actionSlug);
    const membership = await resolveMembership({ email, firstName: names.firstName, lastName: names.lastName });
    const canLinkMember = membership.outcome === "active_member_existing_hub_user" || membership.outcome === "active_member_needs_hub_invite";
    const seasonMember = canLinkMember ? await upsertSeasonMember({ seasonId: season.id, email, neonAccountId: membership.neonAccountId }) : null;
    const campSubmission = await createCampSubmission({
      formSubmissionId: String(formSubmission.id),
      seasonId: season.id,
      seasonMemberId: seasonMember?.id || null,
      userId: seasonMember?.user_id || null,
      neonAccountId: membership.neonAccountId,
      email,
      actionSlug,
      body
    });
    const action = await createSubmissionAction({
      submissionId: campSubmission.id,
      challenge,
      actionSlug,
      status: challenge && seasonMember ? "pending" : "needs_information"
    });
    await emit("challenge_submitted", { userId: seasonMember?.user_id || null, seasonMemberId: seasonMember?.id || null, seasonId: season.id, submissionId: campSubmission.id, actionId: action.id, payload: { source: "action_network", actionSlug } });

    const status = "pending";
    await emit("challenge_needs_review", {
      userId: seasonMember?.user_id || null,
      seasonMemberId: seasonMember?.id || null,
      seasonId: season.id,
      submissionId: campSubmission.id,
      actionId: action.id,
      payload: { reason: challenge ? "team_review_required" : "unmatched_challenge" }
    });

    await updateFormSubmission(String(formSubmission.id), {
      submission_status: "requires_manual_review",
      membership_outcome: membership.outcome,
      neon_account_id: membership.neonAccountId,
      neon_sync_status: "skipped"
    });

    return jsonResponse({
      ok: true,
      status,
      submissionId: formSubmission.id,
      campSubmissionId: campSubmission.id,
      submissionActionId: action.id,
      actionSlug,
      challengeMatched: Boolean(challenge),
      memberLinked: Boolean(seasonMember),
      awardedPoints: 0,
      message: "Your action was received for Team GPE review. Approved actions will be added to your points."
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("camp-gpe-action-network-ingest", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Action Network petition could not be processed." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
