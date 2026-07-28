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
      source: sanitizeText(args.sourceUrl || args.actionSlug, 500) || null,
      membership_interest: membershipChoice,
      eligibility_affirmed: canonical.eligibilityAffirmed === true,
      consent_email: canonical.emailConsent === true,
      consent_sms: canonical.smsConsent === true,
      account_state: "lead",
      membership_state: membershipChoice === "accepted" ? "pending" : "nonmember",
      hub_access: "restricted",
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
      raw_payload: args.rawPayload || {}
    })
  });
  if (!action.ok && !args.submissionId) throw new Error("Could not save lead action.");
  if (args.submissionId) {
    await updateFormSubmission(args.submissionId, {
      lead_id: leadId,
      action_slug: args.actionSlug,
      action_type: args.actionType,
      membership_choice: membershipChoice,
      points_status: args.pointsStatus || "not_applicable"
    }).catch(() => undefined);
  }
  const rows = action.ok ? await action.json() : [];
  return { lead, action: rows[0] || null };
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
