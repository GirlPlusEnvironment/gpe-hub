import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, logSync, publicConfig, updateFormSubmission } from "../_shared/form-submission.ts";
import { createMembershipServerSide, queueHubInvitation } from "../_shared/membership-request.ts";
import { resolveOrCreateAccount } from "../_shared/neon-account.ts";
import { createActivity } from "../_shared/neon-activity.ts";
import { type Json, resolveMembership, safeError } from "../_shared/neon-membership.ts";
import { readJson, sanitizeText, validateFields, validateIdempotencyKey, ValidationError } from "../_shared/validation.ts";

declare const Deno: { serve(handler: (req: Request) => Response | Promise<Response>): void };

const FORM_KEY = "gpe_grad_highlight";
const FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true, type: "email" as const },
  { key: "instagram", label: "Instagram Handle", required: true },
  { key: "celebration", label: "What are you celebrating?", required: true, type: "textarea" as const, maxLength: 5000 },
  { key: "photoConfirmation", label: "Photo confirmation", required: true, type: "radio" as const, allowed: ["yes", "contact_me"] }
];

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  let submissionId: string | null = null;
  try {
    assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);
    const body = await readJson(req);
    const idempotencyKey = validateIdempotencyKey(req.headers.get("idempotency-key") || body.idempotencyKey);
    const fields = validateFields((body.fields || {}) as Record<string, unknown>, FIELDS);
    const email = String(fields.email).toLowerCase();
    const membershipRequest = (body.membershipRequest || null) as Json | null;
    const { submission, duplicate } = await createFormSubmission({
      idempotencyKey,
      formKey: FORM_KEY,
      email,
      payload: { fields },
      membershipRequest,
      honeypot: sanitizeText(body.website, 250)
    });
    submissionId = String(submission.id);
    if (duplicate) return jsonResponse({ duplicate: true, submissionId, ...publicConfig() }, 200, origin);

    let membershipOutcome = "lookup_failed";
    try {
      const account = await resolveOrCreateAccount({
        email,
        firstName: String(fields.firstName),
        lastName: String(fields.lastName),
        allowCreate: true
      });
      if (account.status !== "ambiguous" && account.neonAccountId) {
        await createActivity({ neonAccountId: account.neonAccountId, subject: "GPE Grad Highlight Submission", type: "Highlight", note: { formKey: FORM_KEY, fields } });
        await updateFormSubmission(submissionId, { neon_account_id: account.neonAccountId, neon_sync_status: "succeeded" });
      }
      const membership = await resolveMembership({ email, firstName: String(fields.firstName), lastName: String(fields.lastName), neonAccountId: account.neonAccountId || undefined });
      membershipOutcome = membership.outcome;
      const request = membershipRequest as Json | null;
      if (
        request?.requested === true &&
        request?.consent === true &&
        account.status !== "ambiguous" &&
        account.neonAccountId &&
        membershipOutcome !== "active_member_existing_hub_user" &&
        membershipOutcome !== "active_member_needs_hub_invite"
      ) {
        await createMembershipServerSide({ neonAccountId: account.neonAccountId, request: { request, fields, source: FORM_KEY } });
        await queueHubInvitation({ submissionId, email, neonAccountId: account.neonAccountId }).catch((error) =>
          logSync({ submissionId, integration: "hub", operation: "invite", success: false, errorSummary: safeError(error) })
        );
        membershipOutcome = "active_member_needs_hub_invite";
      }
    } catch (error) {
      await logSync({ submissionId, integration: "neon", operation: "grad_highlight_activity", success: false, errorSummary: safeError(error) });
    }
    await updateFormSubmission(submissionId, { submission_status: membershipOutcome === "lookup_failed" ? "partial_failure" : "completed", membership_outcome: membershipOutcome });
    return jsonResponse({ submissionId, membershipOutcome, ...publicConfig() }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    if (submissionId) await updateFormSubmission(submissionId, { submission_status: "partial_failure" }).catch(() => undefined);
    console.error("gpe-grad-highlight-submit", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Grad highlight submission could not be completed." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
