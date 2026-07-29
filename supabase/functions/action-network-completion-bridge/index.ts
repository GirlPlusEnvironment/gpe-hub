import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, recordLeadAction, updateFormSubmission } from "../_shared/form-submission.ts";
import { sendLifecycleEmail } from "../_shared/lifecycle-email.ts";
import { createActivity } from "../_shared/neon-activity.ts";
import { resolveOrCreateAccount } from "../_shared/neon-account.ts";
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
};

function awardsFromPoints(points: Json) {
  return ["petition", "camp"].flatMap((key) => {
    const award = points[key];
    if (!award || typeof award !== "object" || Array.isArray(award)) return [];
    const row = award as Json;
    return [{
      rule: String(row.rule || (key === "camp" ? "camp_petition_challenge" : "petition_signature")),
      eventType: String(row.eventType || (key === "camp" ? "CAMP_PETITION_COMPLETED" : "PETITION_SUBMITTED")),
      points: Number(row.points || 0),
      status: String(row.status || "not_applicable"),
      pendingAwardId: String(row.pendingAwardId || "") || undefined,
      transactionId: String(row.transactionId || "") || undefined,
      ledgerId: String(row.ledgerId || "") || undefined
    }];
  });
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
    "?select=id,season_id,action_type_id,title",
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

async function profileByEmail(email: string, neonAccountId: string | null) {
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

async function upsertSeasonMember(args: { seasonId: string; email: string; userId: string | null; neonAccountId: string | null }) {
  if (args.neonAccountId) {
    const byNeon = await supabaseFetch(`gpe_season_members?select=*&season_id=eq.${encodeURIComponent(args.seasonId)}&neon_account_id=eq.${encodeURIComponent(args.neonAccountId)}&limit=1`);
    if (byNeon.ok) {
      const rows = await byNeon.json();
      if (rows[0]) {
        const update = await supabaseFetch(`gpe_season_members?id=eq.${encodeURIComponent(rows[0].id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            user_id: args.userId || rows[0].user_id || null,
            contact_email: rows[0].contact_email || args.email,
            status: rows[0].status || "registered"
          })
        });
        if (!update.ok) throw new Error("Could not update seasonal member.");
        return (await update.json())[0] as { id: string; user_id: string | null };
      }
    }
  }
  const res = await supabaseFetch("gpe_season_members?on_conflict=season_id,contact_email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      season_id: args.seasonId,
      user_id: args.userId,
      neon_account_id: args.neonAccountId,
      contact_email: args.email,
      status: "registered"
    })
  });
  if (!res.ok) throw new Error("Could not create seasonal member.");
  return (await res.json())[0] as { id: string; user_id: string | null };
}

async function finalizePetitionPoints(args: {
  userId: string | null;
  leadActionId: string;
  seasonId: string;
  seasonMemberId: string | null;
  challengeId: string | null;
  campaignSlug: string;
  petitionSlug: string;
  metadata: Json;
}) {
  const res = await supabaseFetch("rpc/service_finalize_petition_points", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: args.userId,
      p_lead_action_id: args.leadActionId,
      p_submission_action_id: null,
      p_season_id: args.seasonId,
      p_season_member_id: args.seasonMemberId,
      p_challenge_id: args.challengeId,
      p_cabin_id: null,
      p_campaign_slug: args.campaignSlug,
      p_petition_slug: args.petitionSlug,
      p_metadata: args.metadata
    })
  });
  if (!res.ok) throw new Error(`Could not finalize petition points. ${(await res.text()).slice(0, 300)}`);
  return await res.json() as Json;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    if (origin) assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

    const body = await readJson(req, 40_000) as Json;
    const email = normalizeEmail(body.email);
    const actionSlug = sanitizeText(body.actionSlug || body.action_slug, 180);
    const actionUrl = sanitizeText(body.actionUrl || body.action_url || body.sourceUrl, 500);
    const sourcePage = sanitizeText(body.sourcePage || body.source_page, 180);
    const completionSignal = sanitizeText(body.completionSignal || body.completion_signal || "dom", 80);
    const completedAt = sanitizeText(body.completedAt || body.completed_at, 80) || new Date().toISOString();

    if (!email) throw new ValidationError("Email is required.");
    if (!actionSlug) throw new ValidationError("Petition action is required.");

    const providerSignatureId = `${actionSlug}:${email}`;
    const idempotencyKey = sanitizeText(req.headers.get("idempotency-key"), 300) ||
      `action-network-dom:${await sha256(providerSignatureId)}`;
    const season = await activeSeason();
    const challenge = await challengeForAction(season.id, actionSlug);

    const { submission, duplicate } = await createFormSubmission({
      idempotencyKey,
      formKey: "action_network_petition",
      email,
      payload: {
        source: "action_network_dom",
        verification_status: "pending_webhook",
        actionSlug,
        actionUrl,
        sourcePage,
        completionSignal,
        completedAt
      }
    });

    let neonAccountId: string | null = null;
    let neonSyncStatus: "pending" | "succeeded" | "failed" = "pending";
    let neonMatchStatus = "pending";
    let neonActivityId: string | null = null;

    try {
      const account = await resolveOrCreateAccount({ email, allowCreate: true });
      neonAccountId = account.neonAccountId || null;
      neonMatchStatus = account.status;
      neonSyncStatus = neonAccountId ? "succeeded" : "pending";
    } catch (error) {
      neonSyncStatus = "failed";
      neonMatchStatus = "failed";
      console.error("action-network-completion-bridge neon account", safeError(error));
    }

    const membership = await resolveMembership({ email, neonAccountId: neonAccountId || undefined }).catch((error) => {
      console.error("action-network-completion-bridge membership", safeError(error));
      return { outcome: "lookup_unavailable", neonAccountId: null } as { outcome: string; neonAccountId: string | null };
    });
    neonAccountId = neonAccountId || membership.neonAccountId || null;

    const profile = await profileByEmail(email, neonAccountId);
    const userId = profile?.id || null;
    const seasonMember = challenge ? await upsertSeasonMember({ seasonId: season.id, email, userId, neonAccountId }) : null;

    if (neonAccountId) {
      try {
        neonActivityId = await createActivity({
          neonAccountId,
          subject: `Action Network petition: ${actionSlug}`,
          type: "petition",
          note: {
            source: "action_network_dom",
            verification_status: "pending_webhook",
            actionSlug,
            actionUrl,
            sourcePage,
            formSubmissionId: submission.id
          }
        });
      } catch (error) {
        console.error("action-network-completion-bridge neon activity", safeError(error));
      }
    }

    const leadActionResult = await recordLeadAction({
      submissionId: String(submission.id),
      email,
      neonAccountId,
      userId,
      actionType: "petition_signature",
      actionSlug,
      provider: "action_network_dom",
      providerActionId: actionSlug,
      providerSignatureId,
      campaignSlug: season.slug,
      sourceUrl: actionUrl || null,
      membershipRequest: null,
      rawPayload: {
        source: "action_network_dom",
        verification_status: "pending_webhook",
        completionSignal,
        sourcePage,
        completedAt,
        duplicate
      },
      neonSyncStatus,
      hubIdentityStatus: userId ? "succeeded" : "pending",
      pointsStatus: "pending_identity",
      neonActivityId,
      seasonId: season.id,
      seasonMemberId: seasonMember?.id || null,
      challengeId: challenge?.id || null,
      completedAt,
      pipelineStatus: {
        petition: "success",
        actionNetwork: "pending_webhook",
        verification: "pending_webhook",
        neon: neonSyncStatus === "succeeded" ? "success" : neonSyncStatus,
        neonMatchStatus,
        neonActivity: neonActivityId ? "success" : neonAccountId ? "pending" : "not_applicable",
        hub: userId ? "success" : "pending",
        camp: challenge ? "pending" : "not_applicable",
        points: userId ? "pending" : "pending_identity",
        automation: "pending"
      }
    });

    const leadActionId = String(leadActionResult?.action?.id || "");
    if (!leadActionId) throw new Error("Could not save petition action.");

    const points = await finalizePetitionPoints({
      userId,
      leadActionId,
      seasonId: season.id,
      seasonMemberId: seasonMember?.id || null,
      challengeId: challenge?.id || null,
      campaignSlug: season.slug,
      petitionSlug: actionSlug,
      metadata: {
        source: "action_network_dom",
        verification_status: "pending_webhook",
        completionSignal,
        formSubmissionId: submission.id,
        neonAccountId,
        neonActivityId,
        membershipOutcome: membership.outcome
      }
    });

    const awardedPoints = Number(points.awardedPoints || points.total || 0);
    await updateFormSubmission(String(submission.id), {
      submission_status: "completed",
      membership_outcome: membership.outcome,
      neon_account_id: neonAccountId,
      neon_sync_status: neonSyncStatus,
      points_status: userId ? (awardedPoints > 0 ? "awarded" : "not_applicable") : "pending_identity",
      points_result: points,
      completed_at: completedAt
    });
    await sendLifecycleEmail({
      templateKey: "action-network-petition-thank-you",
      recipientEmail: email,
      recipientUserId: userId,
      neonAccountId,
      eventType: "petition_completed",
      sourceType: "action_network_dom",
      sourceId: String(submission.id),
      idempotencyKey: `action-network-petition-thank-you:${actionSlug}:${email}`,
      category: "advocacy_followup",
      variables: {
        firstName: names.firstName || "there",
        petitionName: actionSlug,
        campaignName: season.name || season.slug,
        awardedPoints: String(awardedPoints),
        pendingPoints: String(points.pendingPoints || 0),
        hubUrl: "https://members.girlplusenvironment.org"
      }
    }).catch((error) => console.error("action-network-completion-bridge lifecycle email", safeError(error)));

    return jsonResponse({
      ok: true,
      success: true,
      completed: true,
      verificationStatus: "pending_webhook",
      status: "completed",
      submissionId: submission.id,
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
    console.error("action-network-completion-bridge", safeError(error));
    return jsonResponse({
      message: error instanceof ValidationError ? error.message : "Petition completion could not be saved."
    }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
