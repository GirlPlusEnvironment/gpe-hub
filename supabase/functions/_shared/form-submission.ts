import { type Json, getEnv, safeError, supabaseFetch } from "./neon-membership.ts";
import { normalizeEmail, sanitizeText } from "./validation.ts";

export type SubmissionInput = {
  idempotencyKey: string;
  formKey: string;
  schemaVersion?: number;
  email: string;
  payload: Json;
  membershipRequest?: Json | null;
  honeypot?: string;
};

export async function getExistingSubmission(idempotencyKey: string) {
  const res = await supabaseFetch(`gpe_form_submissions?select=*&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`);
  if (!res.ok) throw new Error("Could not check existing form submission.");
  const rows = await res.json();
  return rows[0] || null;
}

export async function createFormSubmission(input: SubmissionInput) {
  const existing = await getExistingSubmission(input.idempotencyKey);
  if (existing) return { submission: existing, duplicate: true };
  const res = await supabaseFetch("gpe_form_submissions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      form_key: input.formKey,
      schema_version: input.schemaVersion || 1,
      email_normalized: normalizeEmail(input.email),
      submission_payload: input.payload,
      membership_request: input.membershipRequest || null,
      honeypot_value: sanitizeText(input.honeypot, 250) || null,
      submission_status: input.honeypot ? "requires_manual_review" : "received"
    })
  });
  if (!res.ok) throw new Error("Could not save form submission.");
  return { submission: (await res.json())[0], duplicate: false };
}

export async function updateFormSubmission(id: string, patch: Json) {
  await supabaseFetch(`gpe_form_submissions?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch)
  });
}

export function membershipChoiceFromRequest(request: Json | null | undefined) {
  if (!request) return "not_offered";
  const record = request as Record<string, unknown>;
  if (record.alreadyMember === true || record.choice === "already_member") return "already_member";
  if (record.requested === true && record.consent === true) return "accepted";
  if (record.choice === "skipped") return "skipped";
  if (record.choice === "declined") return "declined";
  return "unknown";
}

export async function recordLeadAction(args: {
  submissionId?: string | null;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  neonAccountId?: string | null;
  userId?: string | null;
  actionType: string;
  actionSlug: string;
  provider: string;
  providerActionId?: string | null;
  providerPersonId?: string | null;
  providerSignatureId?: string | null;
  campaignSlug?: string | null;
  sourceUrl?: string | null;
  membershipRequest?: Json | null;
  rawPayload?: Json | null;
  neonSyncStatus?: string;
  hubIdentityStatus?: string;
  pointsStatus?: string;
  pointsResult?: Json | null;
  neonActivityId?: string | null;
  campSubmissionId?: string | null;
  campSubmissionActionId?: string | null;
  seasonId?: string | null;
  seasonMemberId?: string | null;
  challengeId?: string | null;
  completedAt?: string | null;
  pipelineStatus?: Json | null;
}) {
  const email = normalizeEmail(args.email);
  if (!email) return null;
  const membershipChoice = membershipChoiceFromRequest(args.membershipRequest);
  const membership = (args.membershipRequest || {}) as Record<string, unknown>;
  const canonical = (membership.canonicalMembership || membership) as Record<string, unknown>;
  const upsert = await supabaseFetch("constituent_leads?on_conflict=email_normalized", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      email_normalized: email,
      first_name: sanitizeText(args.firstName, 120) || null,
      last_name: sanitizeText(args.lastName, 120) || null,
      phone: sanitizeText(args.phone, 80) || null,
      postal_code: sanitizeText(args.postalCode, 40) || null,
      city: sanitizeText(args.city, 120) || null,
      state: sanitizeText(args.state, 80) || null,
      action_network_person_id: sanitizeText(args.providerPersonId, 160) || null,
      neon_account_id: args.neonAccountId || null,
      hub_profile_id: args.userId || null,
      source: sanitizeText(args.sourceUrl || args.actionSlug, 500) || null,
      membership_interest: membershipChoice,
      eligibility_affirmed: canonical.eligibilityAffirmed === true,
      consent_email: canonical.emailConsent === true,
      consent_sms: canonical.smsConsent === true,
      account_state: args.userId ? "hub_linked" : "lead",
      membership_state: membershipChoice === "accepted" ? "pending" : "nonmember",
      hub_access: args.userId ? "linked" : "restricted",
      metadata: {
        latestActionSlug: args.actionSlug,
        latestCampaignSlug: args.campaignSlug || null,
        canonicalMembership: canonical || null
      }
    })
  });
  if (!upsert.ok) throw new Error("Could not save constituent lead.");
  const lead = (await upsert.json())[0] as Record<string, unknown>;
  const leadId = String(lead.id);
  const action = await supabaseFetch("lead_actions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      lead_id: leadId,
      user_id: args.userId || null,
      action_type: args.actionType,
      action_slug: args.actionSlug,
      provider: args.provider,
      provider_action_id: args.providerActionId || null,
      provider_person_id: args.providerPersonId || null,
      provider_signature_id: args.providerSignatureId || null,
      form_submission_id: args.submissionId || null,
      campaign_slug: args.campaignSlug || null,
      source_url: args.sourceUrl || null,
      membership_choice: membershipChoice,
      neon_sync_status: args.neonSyncStatus || "not_attempted",
      hub_identity_status: args.hubIdentityStatus || "not_attempted",
      points_status: args.pointsStatus || "not_applicable",
      points_result: args.pointsResult || {},
      neon_activity_id: args.neonActivityId || null,
      camp_submission_id: args.campSubmissionId || null,
      camp_submission_action_id: args.campSubmissionActionId || null,
      season_id: args.seasonId || null,
      season_member_id: args.seasonMemberId || null,
      challenge_id: args.challengeId || null,
      completed_at: args.completedAt || null,
      pipeline_status: args.pipelineStatus || {},
      raw_payload: args.rawPayload || {}
    })
  });
  if (!action.ok && !args.submissionId && !args.providerSignatureId) throw new Error("Could not save lead action.");
  if (args.submissionId) {
    await updateFormSubmission(args.submissionId, {
      lead_id: leadId,
      action_slug: args.actionSlug,
      action_type: args.actionType,
      membership_choice: membershipChoice,
      points_status: args.pointsStatus || "not_applicable",
      points_result: args.pointsResult || {}
    }).catch(() => undefined);
  }
  let rows = action.ok ? await action.json() : [];
  if (!action.ok && args.submissionId) {
    const existing = await supabaseFetch(`lead_actions?select=*&form_submission_id=eq.${encodeURIComponent(args.submissionId)}&limit=1`);
    rows = existing.ok ? await existing.json() : [];
  }
  if (!action.ok && rows.length === 0 && args.providerSignatureId) {
    const existing = await supabaseFetch(`lead_actions?select=*&provider=eq.${encodeURIComponent(args.provider)}&provider_signature_id=eq.${encodeURIComponent(args.providerSignatureId)}&limit=1`);
    rows = existing.ok ? await existing.json() : [];
  }
  return { lead, action: rows[0] || null };
}

export async function recordPointEventForLeadAction(args: {
  eventType: string;
  email: string;
  leadAction?: Record<string, unknown> | null;
  lead?: Record<string, unknown> | null;
  source: string;
  sourceId: string;
  campaignSlug?: string | null;
  metadata?: Json | null;
  occurredAt?: string | null;
}) {
  const actionId = args.leadAction?.id ? String(args.leadAction.id) : "";
  const leadId = args.lead?.id ? String(args.lead.id) : "";
  const userId = args.leadAction?.user_id ? String(args.leadAction.user_id) : null;
  const res = await supabaseFetch("rpc/service_record_point_event", {
    method: "POST",
    body: JSON.stringify({
      p_event_type: args.eventType,
      p_subject_email: normalizeEmail(args.email),
      p_user_id: userId,
      p_lead_action_id: actionId || null,
      p_lead_id: leadId || null,
      p_source: args.source,
      p_source_id: args.sourceId,
      p_campaign_slug: args.campaignSlug || null,
      p_metadata: args.metadata || {},
      p_occurred_at: args.occurredAt || new Date().toISOString()
    })
  });
  if (!res.ok) throw new Error(`Could not record point event: ${await res.text()}`);
  const result = await res.json();
  if (actionId) {
    await supabaseFetch(`lead_actions?id=eq.${encodeURIComponent(actionId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        points_status: result.status || "not_applicable",
        points_result: result,
        pipeline_status: {
          ...((args.leadAction?.pipeline_status || {}) as Record<string, unknown>),
          points: result.status === "awarded" ? "success" : result.status === "pending_identity" ? "pending" : result.status || "not_applicable"
        }
      })
    });
  }
  return result;
}

export async function logSync(args: {
  submissionId: string;
  integration: string;
  operation: string;
  success: boolean;
  statusCode?: number;
  responseSummary?: string;
  errorSummary?: string;
  durationMs?: number;
}) {
  await supabaseFetch("gpe_form_sync_logs", {
    method: "POST",
    body: JSON.stringify({
      submission_id: args.submissionId,
      integration: args.integration,
      operation: args.operation,
      success: args.success,
      status_code: args.statusCode || null,
      response_summary: args.responseSummary ? sanitizeText(args.responseSummary, 500) : null,
      error_summary: args.errorSummary ? sanitizeText(args.errorSummary, 500) : null,
      duration_ms: args.durationMs || null
    })
  }).catch((error) => console.error("gpe-form-sync-log", safeError(error)));
}

export function publicConfig() {
  return {
    membershipUrl: getEnv("GPE_MEMBERSHIP_URL", false),
    hubLoginUrl: getEnv("GPE_HUB_LOGIN_URL", false)
  };
}
