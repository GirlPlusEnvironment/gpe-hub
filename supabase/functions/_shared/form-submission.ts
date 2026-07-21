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
