import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, logSync, recordLeadAction, updateFormSubmission } from "../_shared/form-submission.ts";
import { sendLifecycleEmail } from "../_shared/lifecycle-email.ts";
import { resolveOrCreateAccount } from "../_shared/neon-account.ts";
import { createActivity } from "../_shared/neon-activity.ts";
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

type AuthResult = {
  ok: boolean;
  mode: "configured_secret" | "unsigned_osdi_compat" | "missing_secret" | "invalid_secret";
  message: string;
};

function diagnostic(stage: string, details: Json = {}) {
  console.log(JSON.stringify({
    component: "camp-gpe-action-network-ingest",
    stage,
    ...details
  }));
}

function productionUrl(candidate: string, fallback: string) {
  if (!/^https:\/\//i.test(candidate)) return fallback;
  if (/localhost|127\.0\.0\.1|supabase\.co\/functions|staging|example\.com/i.test(candidate)) return fallback;
  return candidate;
}

function isRecord(value: unknown): value is Json {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function looksLikeActionNetworkWebhook(raw: unknown) {
  const envelope = Array.isArray(raw) ? raw[0] : raw;
  if (!isRecord(envelope)) return false;
  return Boolean(
    envelope["osdi:signature"] ||
    envelope["action_network:action"] ||
    envelope["osdi:outreach"] ||
    envelope["osdi:submission"] ||
    envelope.idempotency_key
  );
}

function hasActionNetworkLink(raw: unknown) {
  const { body, rawEnvelope } = unwrapActionNetworkPayload(raw);
  const links = [nestedRecord(rawEnvelope._links), nestedRecord(body._links)];
  for (const linkGroup of links) {
    for (const linkName of ["self", "osdi:petition", "osdi:advocacy_campaign", "osdi:person"]) {
      const href = hrefFromLink(linkGroup[linkName]);
      if (/^https:\/\/actionnetwork\.org\/(?:api\/v2|petitions|letters)\//i.test(href)) return true;
    }
  }
  return false;
}

function unwrapActionNetworkPayload(raw: unknown) {
  const envelope = Array.isArray(raw) ? raw[0] : raw;
  const record = isRecord(envelope) ? envelope : {};
  const payload = record["osdi:signature"] || record["action_network:action"] || record["osdi:outreach"] || record["osdi:submission"] || record;
  const body = isRecord(payload) ? payload : {};
  return {
    body: {
      ...body,
      idempotency_key: body.idempotency_key || record.idempotency_key,
      "action_network:sponsor": body["action_network:sponsor"] || record["action_network:sponsor"]
    },
    rawEnvelope: record
  };
}

function authenticateWebhook(req: Request, raw: unknown): AuthResult {
  const expected = Deno.env.get("ACTION_NETWORK_WEBHOOK_SECRET") ||
    Deno.env.get("GPE_ACTION_NETWORK_WEBHOOK_SECRET") ||
    Deno.env.get("GPE_ACTION_NETWORK_SECRET") ||
    Deno.env.get("ACTION_NETWORK_SECRET");
  const auth = req.headers.get("authorization") || "";
  const explicit = req.headers.get("x-action-network-webhook-secret") || req.headers.get("x-gpe-action-network-secret") || "";
  if (expected) {
    const ok = auth === `Bearer ${expected}` || explicit === expected;
    return ok
      ? { ok: true, mode: "configured_secret", message: "Webhook authenticated with configured secret." }
      : { ok: false, mode: "invalid_secret", message: "Webhook secret did not match." };
  }
  if (!req.headers.get("origin") && looksLikeActionNetworkWebhook(raw) && hasActionNetworkLink(raw)) {
    return {
      ok: true,
      mode: "unsigned_osdi_compat",
      message: "Accepted unsigned Action Network OSDI webhook with Action Network links because no webhook secret is configured."
    };
  }
  return { ok: false, mode: "missing_secret", message: "Action Network webhook secret is not configured." };
}

function requireWebhookSecret(req: Request, raw: unknown, origin: string | null) {
  const result = authenticateWebhook(req, raw);
  diagnostic("authentication_result", { ok: result.ok, mode: result.mode, message: result.message });
  if (result.ok) {
    if (result.mode === "unsigned_osdi_compat") {
      console.warn("Action Network webhook accepted in unsigned OSDI compatibility mode. Configure ACTION_NETWORK_WEBHOOK_SECRET.");
    }
    return result;
  }
  const status = result.mode === "invalid_secret" ? 401 : 503;
  throw jsonResponse({ message: result.message, stage: "authentication", authMode: result.mode }, status, origin);
}

function queryActionSlug(req: Request) {
  const url = new URL(req.url);
  return sanitizeText(url.searchParams.get("action_slug") || url.searchParams.get("actionSlug") || url.searchParams.get("petition_slug") || "", 180);
}

function hrefFromLink(value: unknown) {
  return isRecord(value) ? sanitizeText(value.href, 500) : "";
}

function slugFromActionNetworkUrl(raw: string) {
  const match = raw.match(/actionnetwork\.org\/(?:petitions|letters)\/([^/?#]+)/i);
  return sanitizeText(match?.[1] || "", 180);
}

function idFromActionNetworkApiUrl(raw: string) {
  const match = raw.match(/actionnetwork\.org\/api\/v2\/(?:petitions|advocacy_campaigns|forms|submissions|outreaches)\/([^/?#]+)/i);
  return sanitizeText(match?.[1] || "", 180);
}

function actionIdentifiers(body: Json) {
  return (Array.isArray(body.identifiers) ? body.identifiers : [])
    .map((value) => sanitizeText(value, 180).replace(/^action_network:/, ""))
    .filter(Boolean);
}

async function registryForActionSlug(actionSlug: string) {
  if (!actionSlug) return null;
  const res = await supabaseFetch([
    "gpe_form_registry?select=slug,title,provider_action_id,campaign_slug,status,metadata",
    "provider=eq.action_network",
    `or=(slug.eq.${encodeURIComponent(actionSlug)},provider_action_id.eq.${encodeURIComponent(actionSlug)})`,
    "limit=1"
  ].join("&"));
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] as Json | undefined || null;
}

async function registryForBody(body: Json, actionSlug: string) {
  const candidates = new Set<string>();
  if (actionSlug) candidates.add(actionSlug);
  for (const identifier of actionIdentifiers(body)) candidates.add(identifier);
  const links = nestedRecord(body._links);
  for (const linkName of ["osdi:petition", "osdi:advocacy_campaign", "self"]) {
    const href = hrefFromLink(links[linkName]);
    const slug = slugFromActionNetworkUrl(href);
    const id = idFromActionNetworkApiUrl(href);
    if (slug) candidates.add(slug);
    if (id) candidates.add(id);
  }
  for (const candidate of candidates) {
    const registry = await registryForActionSlug(candidate);
    if (registry) return registry;
  }
  return null;
}

function sourceUrlFromPayload(body: Json) {
  const links = nestedRecord(body._links);
  return sanitizeText(firstValue(
    body.url,
    body.action_url,
    body.referrer,
    hrefFromLink(links["osdi:petition"]),
    hrefFromLink(links["osdi:advocacy_campaign"]),
    hrefFromLink(links.self)
  ), 500);
}

function shouldCreateReview(challenge: ChallengeRow | null) {
  if (!challenge) return false;
  return challenge.requires_review || challenge.requires_proof || !challenge.auto_approve;
}

function reviewStatusForChallenge(challenge: ChallengeRow | null, linked: boolean): "pending" | "duplicate" | "needs_information" | "approved" {
  if (!challenge || !linked) return "needs_information";
  return shouldCreateReview(challenge) ? "pending" : "approved";
}

async function sendPetitionLifecycleEmail(args: {
  email: string;
  firstName: string;
  userId: string | null;
  neonAccountId: string | null;
  actionSlug: string;
  petitionName: string;
  campaignName: string;
  points: Json;
  sourceId: string;
  membershipOutcome: string;
  actionUrl?: string | null;
}) {
  const hasActiveMembership =
    args.membershipOutcome === "active_member_existing_hub_user" ||
    args.membershipOutcome === "active_member_needs_hub_invite";
  const hasLinkedHubProfile = Boolean(args.userId);
  const membershipPending = args.membershipOutcome === "lookup_unavailable";
  const hubUrl = "https://members.girlplusenvironment.org/";
  const membershipUrl = "https://www.girlplusenvironment.org/become-a-member";
  const primaryCtaLabel = hasActiveMembership || hasLinkedHubProfile ? "Access the Hub" : "Become a Member";
  const primaryCtaUrl = hasActiveMembership || hasLinkedHubProfile ? hubUrl : membershipUrl;
  const petitionFollowupCopy = membershipPending
    ? "Check your inbox for membership confirmation before using Hub access links. You can still keep taking action today."
    : hasActiveMembership || hasLinkedHubProfile
      ? "Access jobs, resources, funding opportunities, mentors, events, and community created for Black + Brown femmes in climate."
      : "Explore more ways to get involved with Girl Plus Environment. GPE Hub access is available after membership is active.";
  return await sendLifecycleEmail({
    templateKey: "action-network-petition-thank-you",
    recipientEmail: args.email,
    recipientUserId: args.userId,
    neonAccountId: args.neonAccountId,
    eventType: "petition_completed",
    sourceType: "action_network",
    sourceId: args.sourceId,
    idempotencyKey: `action-network-petition-thank-you:${args.actionSlug}:${args.email}`,
    category: "advocacy_followup",
    variables: {
      firstName: args.firstName || "there",
      petitionName: args.petitionName,
      campaignName: args.campaignName,
      awardedPoints: String(Number(args.points.awardedPoints || args.points.total || 0)),
      pendingPoints: String(Number(args.points.pendingPoints || 0)),
      petitionFollowupCopy,
      primaryCtaLabel,
      primaryCtaUrl,
      moreActionsUrl: productionUrl(String(args.actionUrl || ""), "https://www.girlplusenvironment.org/take-action"),
      resourcesUrl: "https://www.girlplusenvironment.org/resources"
    }
  });
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

function statusFrom(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? String((value as Json).status || "")
    : "";
}

function awardsFromPoints(points: Json) {
  const awards = [];
  const petition = points.petition as Json | undefined;
  if (petition && typeof petition === "object" && !Array.isArray(petition)) {
    awards.push({
      rule: String(petition.rule || "petition_signature"),
      eventType: String(petition.eventType || "PETITION_SUBMITTED"),
      points: Number(petition.points || 0),
      status: String(petition.status || "not_applicable")
    });
  }
  const camp = points.camp as Json | undefined;
  if (camp && typeof camp === "object" && !Array.isArray(camp)) {
    awards.push({
      rule: String(camp.rule || "camp_petition_challenge"),
      eventType: String(camp.eventType || "CAMP_PETITION_COMPLETED"),
      points: Number(camp.points || 0),
      status: String(camp.status || "not_applicable")
    });
  }
  return awards;
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
  return sanitizeText(firstValue(body.idempotency_key, body.id, body.submission_id, body.action_network_id, body.uuid, body.identifiers), 160) || `${actionSlug}:${email}`;
}

function extractPersonId(body: Json) {
  const person = nestedRecord(body.person || body.person_data || body.supporter);
  return sanitizeText(firstValue(body.person_id, body.personId, person.id, person.uuid, person.action_network_id), 180) || null;
}

async function idempotencyKeyFor(body: Json, email: string, actionSlug: string) {
  const source = `action-network:${externalId(body, email, actionSlug)}`;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const hash = Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `action-network:${hash}`;
}

async function activeSeason() {
  const slug = Deno.env.get("ACTIVE_SEASON_SLUG") || Deno.env.get("ACTIVE_CAMP_SEASON_SLUG") || "";
  const path = slug
    ? `gpe_seasons?select=id,slug,name&slug=eq.${encodeURIComponent(slug)}&limit=1`
    : "gpe_seasons?select=id,slug,name&status=eq.active&is_visible=eq.true&order=starts_at.desc&limit=1";
  const res = await supabaseFetch(path);
  if (!res.ok) throw new Error("Could not load active seasonal challenge.");
  const rows = await res.json();
  if (!rows[0]) throw new Error("No active seasonal challenge is configured.");
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
  if (!res.ok) throw new Error("Could not match Action Network action to seasonal challenge.");
  const rows = await res.json();
  return (rows[0] || null) as ChallengeRow | null;
}

async function profileByMembership(email: string, neonAccountId: string | null) {
  if (neonAccountId) {
    const byNeon = await supabaseFetch(`profiles?select=id,email,neon_account_id&neon_account_id=eq.${encodeURIComponent(neonAccountId)}&limit=1`);
    if (byNeon.ok) {
      const rows = await byNeon.json();
      if (rows[0]) return rows[0] as { id: string; email: string | null; neon_account_id: string | null };
    }
  }

  const byEmail = await supabaseFetch(`profiles?select=id,email,neon_account_id&email=ilike.${encodeURIComponent(email)}&limit=1`);
  if (!byEmail.ok) return null;
  const rows = await byEmail.json();
  return rows[0] as { id: string; email: string | null; neon_account_id: string | null } | undefined || null;
}

async function upsertSeasonMember(params: { seasonId: string; email: string; neonAccountId: string | null }) {
  const profile = await profileByMembership(params.email, params.neonAccountId);
  if (params.neonAccountId) {
    const byNeon = await supabaseFetch(`gpe_season_members?select=*&season_id=eq.${encodeURIComponent(params.seasonId)}&neon_account_id=eq.${encodeURIComponent(params.neonAccountId)}&limit=1`);
    if (byNeon.ok) {
      const rows = await byNeon.json();
      if (rows[0]) {
        const update = await supabaseFetch(`gpe_season_members?id=eq.${encodeURIComponent(rows[0].id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            user_id: profile?.id || rows[0].user_id || null,
            contact_email: rows[0].contact_email || params.email,
            status: rows[0].status || "registered"
          })
        });
        if (!update.ok) throw new Error("Could not link petition action to seasonal member record.");
        const updatedRows = await update.json();
        return updatedRows[0] as { id: string; user_id: string | null };
      }
    }
  }

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
  if (!res.ok) throw new Error("Could not link petition action to seasonal member record.");
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

async function createSubmissionAction(params: { submissionId: string; challenge: ChallengeRow | null; actionSlug: string; status: "pending" | "duplicate" | "needs_information" | "approved" }) {
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

async function finalizePetitionPoints(params: {
  userId: string | null;
  leadActionId: string | null;
  submissionActionId: string | null;
  seasonId: string | null;
  seasonMemberId: string | null;
  challengeId: string | null;
  campaignSlug: string | null;
  petitionSlug: string;
  metadata: Json;
}) {
  if (!params.leadActionId) {
    return { status: "failed", awardedPoints: 0, total: 0, message: "No lead action was available for point finalization." };
  }
  const res = await supabaseFetch("rpc/service_finalize_petition_points", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: params.userId,
      p_lead_action_id: params.leadActionId,
      p_submission_action_id: params.submissionActionId,
      p_season_id: params.seasonId,
      p_season_member_id: params.seasonMemberId,
      p_challenge_id: params.challengeId,
      p_cabin_id: null,
      p_campaign_slug: params.campaignSlug,
      p_petition_slug: params.petitionSlug,
      p_metadata: params.metadata
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Could not finalize petition points. ${text}`.trim());
  }
  return await res.json() as Json;
}

async function patchLeadAction(id: string | null, patch: Json) {
  if (!id) return;
  await supabaseFetch(`lead_actions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch)
  }).catch((error) => console.error("action-network lead action patch failed", safeError(error)));
}

async function existingDomLeadAction(providerSignatureId: string) {
  const res = await supabaseFetch([
    "lead_actions?select=*",
    "provider=eq.action_network_dom",
    `provider_signature_id=eq.${encodeURIComponent(providerSignatureId)}`,
    "limit=1"
  ].join("&"));
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] as Json | undefined || null;
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
  const stage = { current: "initial" };
  let syncSubmissionId: string | null = null;
  try {
    stage.current = "cors";
    if (origin) assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

    stage.current = "webhook_received";
    const rawBody = await readJson(req, 160_000) as unknown;
    diagnostic("webhook_received", {
      method: req.method,
      contentType: req.headers.get("content-type") || "",
      hasOrigin: Boolean(origin),
      osdiEnvelope: looksLikeActionNetworkWebhook(rawBody)
    });

    stage.current = "authentication";
    const authResult = requireWebhookSecret(req, rawBody, origin);
    const { body, rawEnvelope } = unwrapActionNetworkPayload(rawBody);

    stage.current = "payload_validation";
    const email = extractEmail(body);
    if (!email) throw new ValidationError("Action Network payload is missing email.");
    const registry = await registryForBody(body, queryActionSlug(req) || extractActionSlug(body));
    diagnostic("petition_mapping_found", {
      mapped: Boolean(registry),
      registrySlug: registry?.slug || null,
      providerActionId: registry?.provider_action_id || null
    });

    const actionSlug = sanitizeText(
      queryActionSlug(req) ||
      extractActionSlug(body) ||
      registry?.provider_action_id ||
      registry?.slug ||
      "",
      180
    );
    if (!actionSlug) throw new ValidationError("Action Network payload is missing action identifier.");
    const names = extractName(body);
    const providerSignatureId = externalId(body, email, actionSlug);
    const domProviderSignatureId = `${actionSlug}:${email}`;
    const domLeadAction = await existingDomLeadAction(domProviderSignatureId);
    const idempotencyKey = await idempotencyKeyFor(body, email, actionSlug);

    stage.current = "active_season";
    const season = await activeSeason();
    const campaignSlug = sanitizeText(registry?.campaign_slug, 180) || season.slug;
    const providerActionId = sanitizeText(registry?.provider_action_id, 180) || actionSlug;
    const petitionName = sanitizeText(registry?.title, 180) || actionSlug;
    const campaignName = season.name || campaignSlug;

    stage.current = "form_submission";
    const { submission: formSubmission, duplicate } = await createFormSubmission({
      idempotencyKey,
      formKey: "action_network_petition",
      email,
      payload: { source: "action_network", actionSlug, authMode: authResult.mode, payload: body, envelope: rawEnvelope }
    });
    syncSubmissionId = String(formSubmission.id);
    await logSync({
      submissionId: syncSubmissionId,
      integration: "pipeline",
      operation: duplicate ? "submission_duplicate" : "submission_received",
      success: true,
      responseSummary: `action=${actionSlug}; auth=${authResult.mode}`
    });
    if (duplicate) {
      diagnostic("duplicate_webhook_replay", { submissionId: formSubmission.id, actionSlug, email });
      const existingActionRes = await supabaseFetch(`lead_actions?select=id,user_id,camp_submission_action_id,season_id,season_member_id,challenge_id,campaign_slug,action_slug,points_result,completed_at,occurred_at&form_submission_id=eq.${encodeURIComponent(String(formSubmission.id))}&limit=1`);
      const existingActions = existingActionRes.ok ? await existingActionRes.json() : [];
      const existingAction = existingActions[0] as Json | undefined;
      let duplicatePoints = (formSubmission.points_result || existingAction?.points_result || {}) as Json;
      if (existingAction?.id) {
        duplicatePoints = await finalizePetitionPoints({
          userId: String(existingAction.user_id || "") || null,
          leadActionId: String(existingAction.id),
          submissionActionId: String(existingAction.camp_submission_action_id || "") || null,
          seasonId: String(existingAction.season_id || "") || null,
          seasonMemberId: String(existingAction.season_member_id || "") || null,
          challengeId: String(existingAction.challenge_id || "") || null,
          campaignSlug: String(existingAction.campaign_slug || "") || null,
          petitionSlug: String(existingAction.action_slug || actionSlug),
          metadata: {
            source: "action_network",
            duplicateReplay: true,
            formSubmissionId: formSubmission.id
          }
        }).catch(() => duplicatePoints);
      }
      return jsonResponse({
        ok: true,
        duplicate: true,
        status: "completed",
        submissionId: formSubmission.id,
        leadActionId: existingAction?.id || null,
        completedAt: existingAction?.completed_at || formSubmission.completed_at || formSubmission.updated_at || formSubmission.created_at || new Date().toISOString(),
        awardedPoints: Number(duplicatePoints.awardedPoints || duplicatePoints.total || 0),
        pendingPoints: Number(duplicatePoints.pendingPoints || 0),
        awards: awardsFromPoints(duplicatePoints),
        points: duplicatePoints,
        message: "Submission Complete"
      }, 200, origin);
    }

    stage.current = "challenge_mapping";
    const challenge = await challengeForAction(season.id, actionSlug);
    diagnostic("challenge_mapping_found", {
      mapped: Boolean(challenge),
      actionSlug,
      challengeId: challenge?.id || null,
      requiresReview: challenge?.requires_review ?? null,
      requiresProof: challenge?.requires_proof ?? null,
      autoApprove: challenge?.auto_approve ?? null,
      pointValue: challenge?.point_value ?? null
    });
    let neonAccountId: string | null = null;
    let neonSyncStatus: "pending" | "succeeded" | "failed" = "pending";
    let neonMatchStatus = "pending";
    let neonActivityId: string | null = null;

    try {
      stage.current = "neon_constituent_lookup";
      const account = await resolveOrCreateAccount({
        email,
        firstName: names.firstName,
        lastName: names.lastName,
        allowCreate: true
      });
      neonAccountId = account.neonAccountId || null;
      neonMatchStatus = account.status;
      neonSyncStatus = neonAccountId ? "pending" : "failed";
      await logSync({
        submissionId: String(formSubmission.id),
        integration: "neon",
        operation: account.status === "created" ? "create_constituent" : "lookup_constituent",
        success: Boolean(neonAccountId),
        responseSummary: `Neon account ${account.status}${neonAccountId ? `: ${neonAccountId}` : ""}`
      });
      diagnostic("neon_constituent_found", { found: Boolean(neonAccountId), status: account.status, neonAccountId });
    } catch (error) {
      neonSyncStatus = "failed";
      diagnostic("neon_constituent_found", { found: false, error: safeError(error) });
      await logSync({
        submissionId: String(formSubmission.id),
        integration: "neon",
        operation: "lookup_or_create_constituent",
        success: false,
        errorSummary: safeError(error)
      });
    }

    stage.current = "membership_lookup";
    const membership = await resolveMembership({ email, firstName: names.firstName, lastName: names.lastName }).catch((error) => {
      console.error("action-network membership resolution failed", safeError(error));
      return { outcome: "lookup_unavailable", neonAccountId: null } as { outcome: string; neonAccountId: string | null };
    });
    neonAccountId = neonAccountId || membership.neonAccountId || null;
    const seasonMember = challenge ? await upsertSeasonMember({ seasonId: season.id, email, neonAccountId }) : null;
    const profile = await profileByMembership(email, neonAccountId);
    const userId = seasonMember?.user_id || profile?.id || null;
    diagnostic("hub_member_found", {
      found: Boolean(userId),
      membershipOutcome: membership.outcome,
      seasonMemberId: seasonMember?.id || null,
      profileId: profile?.id || null
    });

    if (neonAccountId) {
      try {
        stage.current = "neon_activity";
        neonActivityId = await createActivity({
          neonAccountId,
          subject: `Action Network petition: ${actionSlug}`,
          type: "petition",
          note: {
            source: "action_network",
            actionSlug,
            campaignSlug: season.slug,
            challengeId: challenge?.id || null,
            formSubmissionId: formSubmission.id
          }
        });
        neonSyncStatus = "succeeded";
        await logSync({
          submissionId: String(formSubmission.id),
          integration: "neon",
          operation: "create_petition_activity",
          success: true,
          responseSummary: `activity=${neonActivityId}`
        });
      } catch (error) {
        neonSyncStatus = "failed";
        await logSync({
          submissionId: String(formSubmission.id),
          integration: "neon",
          operation: "create_petition_activity",
          success: false,
          errorSummary: safeError(error)
        });
      }
    } else {
      neonSyncStatus = "failed";
      await logSync({
        submissionId: String(formSubmission.id),
        integration: "neon",
        operation: "create_petition_activity",
        success: false,
        errorSummary: "Skipped because no Neon account ID was available."
      });
    }

    const needsReview = shouldCreateReview(challenge);
    stage.current = "review_creation";
    const campSubmission = challenge && needsReview
      ? await createCampSubmission({
        formSubmissionId: String(formSubmission.id),
        seasonId: season.id,
        seasonMemberId: seasonMember?.id || null,
        userId,
        neonAccountId,
        email,
        actionSlug,
        body
      })
      : null;
    const action = campSubmission
      ? await createSubmissionAction({
        submissionId: campSubmission.id,
        challenge,
        actionSlug,
        status: reviewStatusForChallenge(challenge, Boolean(seasonMember))
      })
      : null;
    diagnostic(action ? "review_created" : "review_skipped", {
      actionSlug,
      challengeId: challenge?.id || null,
      requiresReview: challenge?.requires_review ?? null,
      requiresProof: challenge?.requires_proof ?? null,
      autoApprove: challenge?.auto_approve ?? null,
      campSubmissionId: campSubmission?.id || null,
      submissionActionId: action?.id || null
    });
    if (campSubmission && action) {
      await emit("challenge_submitted", { userId, seasonMemberId: seasonMember?.id || null, seasonId: season.id, submissionId: campSubmission.id, actionId: action.id, payload: { source: "action_network", actionSlug, autoApproved: Boolean(challenge && seasonMember) } });
    }

    stage.current = "lead_action_creation";
    const leadActionResult = domLeadAction?.id
      ? { lead: null, action: domLeadAction }
      : await recordLeadAction({
        submissionId: String(formSubmission.id),
        email,
        firstName: names.firstName,
        lastName: names.lastName,
        neonAccountId,
        userId,
        actionType: "petition_signature",
        actionSlug,
        provider: "action_network",
        providerActionId,
        providerPersonId: extractPersonId(body),
        providerSignatureId,
        campaignSlug,
        sourceUrl: sourceUrlFromPayload(body) || null,
        membershipRequest: null,
        rawPayload: { source: "action_network", actionSlug, authMode: authResult.mode, payload: body, envelope: rawEnvelope },
        neonSyncStatus,
        hubIdentityStatus: userId ? "succeeded" : "pending",
        pointsStatus: userId ? "not_applicable" : "pending_identity",
        neonActivityId,
        campSubmissionId: campSubmission?.id || null,
        campSubmissionActionId: action?.id || null,
        seasonId: season.id,
        seasonMemberId: seasonMember?.id || null,
        challengeId: challenge?.id || null,
        pipelineStatus: {
          petition: "success",
          actionNetwork: "success",
          neon: neonSyncStatus === "succeeded" ? "success" : neonSyncStatus,
          neonMatchStatus,
          neonActivity: neonActivityId ? "success" : neonAccountId ? "pending" : "not_applicable",
          hub: userId ? "success" : "pending",
          camp: challenge ? (needsReview ? "pending" : "not_applicable") : "not_applicable",
          points: userId ? "pending" : "pending_identity",
          automation: "pending"
        }
      });

    let leadActionId = String(leadActionResult?.action?.id || "");
    diagnostic("lead_action_created", { leadActionId, reusedDomLeadAction: Boolean(domLeadAction?.id) });
    if (domLeadAction?.id) {
      leadActionId = String(domLeadAction.id);
      await patchLeadAction(leadActionId, {
        form_submission_id: formSubmission.id,
        neon_account_id: neonAccountId,
        user_id: userId,
        provider_action_id: providerActionId,
        provider_person_id: extractPersonId(body),
        campaign_slug: campaignSlug,
        source_url: sourceUrlFromPayload(body) || null,
        neon_sync_status: neonSyncStatus,
        hub_identity_status: userId ? "succeeded" : "pending",
        neon_activity_id: neonActivityId,
        camp_submission_id: campSubmission?.id || null,
        camp_submission_action_id: action?.id || null,
        season_id: season.id,
        season_member_id: seasonMember?.id || null,
        challenge_id: challenge?.id || null,
        raw_payload: { source: "action_network", verified_webhook: true, actionSlug, authMode: authResult.mode, payload: body, envelope: rawEnvelope },
        pipeline_status: {
          petition: "success",
          actionNetwork: "success",
          verification: "verified",
          priorProvider: "action_network_dom",
          neon: neonSyncStatus === "succeeded" ? "success" : neonSyncStatus,
          neonMatchStatus,
          neonActivity: neonActivityId ? "success" : neonAccountId ? "pending" : "not_applicable",
          hub: userId ? "success" : "pending",
          camp: challenge ? (needsReview ? "pending" : "not_applicable") : "not_applicable",
          points: userId ? "pending" : "pending_identity",
          automation: "pending"
        }
      });
    }

    stage.current = "point_event_generation";
    let points: Json;
    try {
      points = await finalizePetitionPoints({
        userId,
        leadActionId,
        submissionActionId: action?.id || null,
        seasonId: season.id,
        seasonMemberId: seasonMember?.id || null,
        challengeId: challenge?.id || null,
        campaignSlug,
        petitionSlug: actionSlug,
        metadata: {
          source: "action_network",
          authMode: authResult.mode,
          formSubmissionId: formSubmission.id,
          campSubmissionId: campSubmission?.id || null,
          submissionActionId: action?.id || null,
          neonAccountId,
          neonActivityId,
          membershipOutcome: membership.outcome
        }
      });
      await logSync({
        submissionId: String(formSubmission.id),
        integration: "points",
        operation: "finalize_petition_points",
        success: true,
        responseSummary: `status=${String(points.status || "unknown")}; awarded=${String(points.awardedPoints || 0)}; pending=${String(points.pendingPoints || 0)}`
      });
    } catch (error) {
      await logSync({
        submissionId: String(formSubmission.id),
        integration: "points",
        operation: "finalize_petition_points",
        success: false,
        errorSummary: safeError(error)
      });
      throw error;
    }
    diagnostic("points_awarded", {
      leadActionId,
      status: points.status || null,
      awardedPoints: Number(points.awardedPoints || points.total || 0),
      pendingPoints: Number(points.pendingPoints || 0)
    });

    const awardedPoints = Number(points.awardedPoints || points.total || 0);
    const completedAt = new Date().toISOString();

    stage.current = "leaderboard_update";
    await patchLeadAction(leadActionId, {
      completed_at: completedAt,
      neon_activity_id: neonActivityId,
      neon_sync_status: neonSyncStatus,
      pipeline_status: {
        petition: "success",
        actionNetwork: "success",
        neon: neonSyncStatus === "succeeded" ? "success" : neonSyncStatus,
        neonMatchStatus,
        neonActivity: neonActivityId ? "success" : neonAccountId ? "pending" : "not_applicable",
        hub: userId ? "success" : "pending",
        points: awardedPoints > 0 ? "success" : "pending_identity",
        camp: challenge ? (needsReview ? (statusFrom(points.camp) === "awarded" ? "success" : "pending") : "not_applicable") : "not_applicable",
        automation: "pending"
      }
    });
    diagnostic("leaderboard_updated", { leadActionId, userId, seasonMemberId: seasonMember?.id || null });

    stage.current = "form_submission_update";
    const formSubmissionStatus = neonActivityId ? "created" : neonAccountId ? "neon_sync_failed" : "neon_account_unresolved";
    await updateFormSubmission(String(formSubmission.id), {
      submission_status: neonActivityId ? "completed" : "partial_failure",
      membership_outcome: membership.outcome,
      neon_account_id: neonAccountId,
      neon_sync_status: neonSyncStatus,
      points_status: userId ? (awardedPoints > 0 ? "awarded" : "not_applicable") : "pending_identity",
      points_result: points,
      completed_at: completedAt,
      submission_payload: {
        source: "action_network",
        actionSlug,
        authMode: authResult.mode,
        formSubmissionStatus,
        formRecordId: neonActivityId,
        formRecordError: neonActivityId ? null : "Neon petition Activity was not created.",
        payload: body,
        envelope: rawEnvelope
      }
    });

    stage.current = "lifecycle_email";
    const petitionEmailResult = await sendPetitionLifecycleEmail({
      email,
      firstName: names.firstName,
      userId,
      neonAccountId,
      actionSlug,
      petitionName,
      campaignName,
      points,
      sourceId: leadActionId || String(formSubmission.id),
      membershipOutcome: membership.outcome,
      actionUrl: isRecord(registry?.metadata) ? sanitizeText(registry.metadata.actionUrl || registry.metadata.url, 500) : null
    }).then((result) => {
      diagnostic("lifecycle_email_queued", { email, actionSlug, leadActionId, status: result.status, deliveryId: result.deliveryId || null });
      void logSync({
        submissionId: String(formSubmission.id),
        integration: "email",
        operation: "resend_petition_confirmation",
        success: Boolean(result.ok && ["sent", "already_sent"].includes(String(result.status))),
        responseSummary: `status=${String(result.status || "unknown")}; delivery=${String(result.deliveryId || "")}`
      });
      return result;
    }).catch((error) => {
      diagnostic("lifecycle_email_failed", { email, actionSlug, error: safeError(error) });
      void logSync({
        submissionId: String(formSubmission.id),
        integration: "email",
        operation: "resend_petition_confirmation",
        success: false,
        errorSummary: safeError(error)
      });
      return { ok: false, status: "failed", deliveryId: null };
    });
    await logSync({
      submissionId: String(formSubmission.id),
      integration: "pipeline",
      operation: neonActivityId && Boolean(petitionEmailResult.ok) ? "completed" : "completed_with_warnings",
      success: Boolean(neonActivityId && petitionEmailResult.ok),
      responseSummary: `neon=${neonSyncStatus}; points=${String(points.status || "unknown")}; email=${String(petitionEmailResult.status || "unknown")}`
    });

    return jsonResponse({
      ok: true,
      status: "completed",
      submissionId: formSubmission.id,
      formSubmissionStatus,
      formRecordId: neonActivityId,
      formRecordError: neonActivityId ? null : "Neon petition Activity was not created.",
      campSubmissionId: campSubmission?.id || null,
      submissionActionId: action?.id || null,
      leadActionId,
      actionSlug,
      challengeMatched: Boolean(challenge),
      memberLinked: Boolean(userId),
      completedAt,
      awardedPoints,
      pendingPoints: Number(points.pendingPoints || 0),
      awards: awardsFromPoints(points),
      points,
      petitionEmailAccepted: Boolean(petitionEmailResult.ok && ["sent", "already_sent"].includes(String(petitionEmailResult.status))),
      petitionEmailStatus: petitionEmailResult.status,
      petitionEmailDeliveryId: petitionEmailResult.deliveryId || null,
      message: "Submission Complete"
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof ValidationError ? error.message : "Action Network petition could not be processed.";
    if (syncSubmissionId) {
      await logSync({
        submissionId: syncSubmissionId,
        integration: "pipeline",
        operation: `failed:${stage.current}`,
        success: false,
        errorSummary: safeError(error)
      });
      await updateFormSubmission(syncSubmissionId, {
        submission_status: "partial_failure",
        last_error_summary: safeError(error)
      }).catch(() => undefined);
    }
    console.error("camp-gpe-action-network-ingest", JSON.stringify({ stage: stage.current, error: safeError(error) }));
    return jsonResponse({ message, stage: stage.current, error: safeError(error) }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
