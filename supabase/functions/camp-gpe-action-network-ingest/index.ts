import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, logSync, recordLeadAction, updateFormSubmission } from "../_shared/form-submission.ts";
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

function requireWebhookSecret(req: Request, origin: string | null) {
  const expected = Deno.env.get("ACTION_NETWORK_WEBHOOK_SECRET") ||
    Deno.env.get("GPE_ACTION_NETWORK_SECRET") ||
    Deno.env.get("ACTION_NETWORK_SECRET");
  if (!expected) {
    throw jsonResponse({ message: "Action Network webhook is not configured." }, 503, origin);
  }
  const auth = req.headers.get("authorization") || "";
  const explicit = req.headers.get("x-action-network-webhook-secret") || req.headers.get("x-gpe-action-network-secret") || "";
  if (auth !== `Bearer ${expected}` && explicit !== expected) {
    throw jsonResponse({ message: "Unauthorized." }, 401, origin);
  }
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
  return sanitizeText(firstValue(body.id, body.submission_id, body.action_network_id, body.uuid), 160) || `${actionSlug}:${email}`;
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
  try {
    if (origin) assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);
    requireWebhookSecret(req, origin);

    const body = await readJson(req, 160_000) as Json;
    const email = extractEmail(body);
    if (!email) throw new ValidationError("Action Network payload is missing email.");
    const actionSlug = extractActionSlug(body);
    if (!actionSlug) throw new ValidationError("Action Network payload is missing action identifier.");
    const names = extractName(body);
    const providerSignatureId = externalId(body, email, actionSlug);
    const domProviderSignatureId = `${actionSlug}:${email}`;
    const domLeadAction = await existingDomLeadAction(domProviderSignatureId);
    const idempotencyKey = await idempotencyKeyFor(body, email, actionSlug);
    const season = await activeSeason();

    const { submission: formSubmission, duplicate } = await createFormSubmission({
      idempotencyKey,
      formKey: "action_network_petition",
      email,
      payload: { source: "action_network", actionSlug, payload: body }
    });
    if (duplicate) {
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

    const challenge = await challengeForAction(season.id, actionSlug);
    let neonAccountId: string | null = null;
    let neonSyncStatus: "pending" | "succeeded" | "failed" = "pending";
    let neonMatchStatus = "pending";
    let neonActivityId: string | null = null;

    try {
      const account = await resolveOrCreateAccount({
        email,
        firstName: names.firstName,
        lastName: names.lastName,
        allowCreate: true
      });
      neonAccountId = account.neonAccountId || null;
      neonMatchStatus = account.status;
      neonSyncStatus = neonAccountId ? "succeeded" : "pending";
      await logSync({
        submissionId: String(formSubmission.id),
        integration: "neon",
        operation: account.status === "created" ? "create_constituent" : "lookup_constituent",
        success: Boolean(neonAccountId),
        responseSummary: `Neon account ${account.status}${neonAccountId ? `: ${neonAccountId}` : ""}`
      });
    } catch (error) {
      neonSyncStatus = "failed";
      await logSync({
        submissionId: String(formSubmission.id),
        integration: "neon",
        operation: "lookup_or_create_constituent",
        success: false,
        errorSummary: safeError(error)
      });
    }

    const membership = await resolveMembership({ email, firstName: names.firstName, lastName: names.lastName }).catch((error) => {
      console.error("action-network membership resolution failed", safeError(error));
      return { outcome: "lookup_unavailable", neonAccountId: null } as { outcome: string; neonAccountId: string | null };
    });
    neonAccountId = neonAccountId || membership.neonAccountId || null;
    const seasonMember = challenge ? await upsertSeasonMember({ seasonId: season.id, email, neonAccountId }) : null;
    const profile = await profileByMembership(email, neonAccountId);
    const userId = seasonMember?.user_id || profile?.id || null;

    if (neonAccountId) {
      try {
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
      } catch (error) {
        await logSync({
          submissionId: String(formSubmission.id),
          integration: "neon",
          operation: "create_petition_activity",
          success: false,
          errorSummary: safeError(error)
        });
      }
    }

    const campSubmission = challenge
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
        status: seasonMember ? "approved" : "needs_information"
      })
      : null;
    if (campSubmission && action) {
      await emit("challenge_submitted", { userId, seasonMemberId: seasonMember?.id || null, seasonId: season.id, submissionId: campSubmission.id, actionId: action.id, payload: { source: "action_network", actionSlug, autoApproved: Boolean(challenge && seasonMember) } });
    }

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
        providerActionId: actionSlug,
        providerPersonId: extractPersonId(body),
        providerSignatureId,
        campaignSlug: season.slug,
        sourceUrl: sanitizeText(firstValue(body.url, body.action_url, body.referrer), 500) || null,
        membershipRequest: null,
        rawPayload: { source: "action_network", actionSlug, payload: body },
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
          camp: challenge ? "pending" : "not_applicable",
          points: userId ? "pending" : "pending_identity",
          automation: "pending"
        }
      });

    let leadActionId = String(leadActionResult?.action?.id || "");
    if (domLeadAction?.id) {
      leadActionId = String(domLeadAction.id);
      await patchLeadAction(leadActionId, {
        form_submission_id: formSubmission.id,
        neon_account_id: neonAccountId,
        user_id: userId,
        provider_action_id: actionSlug,
        provider_person_id: extractPersonId(body),
        campaign_slug: season.slug,
        source_url: sanitizeText(firstValue(body.url, body.action_url, body.referrer), 500) || null,
        neon_sync_status: neonSyncStatus,
        hub_identity_status: userId ? "succeeded" : "pending",
        neon_activity_id: neonActivityId,
        camp_submission_id: campSubmission?.id || null,
        camp_submission_action_id: action?.id || null,
        season_id: season.id,
        season_member_id: seasonMember?.id || null,
        challenge_id: challenge?.id || null,
        raw_payload: { source: "action_network", verified_webhook: true, actionSlug, payload: body },
        pipeline_status: {
          petition: "success",
          actionNetwork: "success",
          verification: "verified",
          priorProvider: "action_network_dom",
          neon: neonSyncStatus === "succeeded" ? "success" : neonSyncStatus,
          neonMatchStatus,
          neonActivity: neonActivityId ? "success" : neonAccountId ? "pending" : "not_applicable",
          hub: userId ? "success" : "pending",
          camp: challenge ? "pending" : "not_applicable",
          points: userId ? "pending" : "pending_identity",
          automation: "pending"
        }
      });
    }
    const points = await finalizePetitionPoints({
      userId,
      leadActionId,
      submissionActionId: action?.id || null,
      seasonId: season.id,
      seasonMemberId: seasonMember?.id || null,
      challengeId: challenge?.id || null,
      campaignSlug: season.slug,
      petitionSlug: actionSlug,
      metadata: {
        source: "action_network",
        formSubmissionId: formSubmission.id,
        campSubmissionId: campSubmission?.id || null,
        submissionActionId: action?.id || null,
        neonAccountId,
        neonActivityId,
        membershipOutcome: membership.outcome
      }
    });

    const awardedPoints = Number(points.awardedPoints || points.total || 0);
    const completedAt = new Date().toISOString();

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
        camp: challenge ? (statusFrom(points.camp) === "awarded" ? "success" : "pending") : "not_applicable",
        automation: "pending"
      }
    });

    await updateFormSubmission(String(formSubmission.id), {
      submission_status: "completed",
      membership_outcome: membership.outcome,
      neon_account_id: neonAccountId,
      neon_sync_status: neonSyncStatus,
      points_status: userId ? (awardedPoints > 0 ? "awarded" : "not_applicable") : "pending_identity",
      points_result: points,
      completed_at: completedAt
    });

    return jsonResponse({
      ok: true,
      status: "completed",
      submissionId: formSubmission.id,
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
      message: "Submission Complete"
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("camp-gpe-action-network-ingest", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Action Network petition could not be processed." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
