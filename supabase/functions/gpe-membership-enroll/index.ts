import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, publicConfig, updateFormSubmission } from "../_shared/form-submission.ts";
import { createMembershipServerSide, queueHubInvitation } from "../_shared/membership-request.ts";
import { resolveOrCreateAccount } from "../_shared/neon-account.ts";
import { resolveMembership, safeError } from "../_shared/neon-membership.ts";
import { readJson, sanitizeText, validateFields, validateIdempotencyKey, ValidationError } from "../_shared/validation.ts";

declare const Deno: { serve(handler: (req: Request) => Response | Promise<Response>): void };

const FORM_KEY = "membership_enrollment";
const FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true, type: "email" as const },
  { key: "phone", label: "Phone Number" },
  { key: "addressLine1", label: "Address Line 1" },
  { key: "addressLine2", label: "Address Line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State/Province" },
  { key: "zip", label: "Zip/Postal Code" },
  { key: "country", label: "Country" },
  { key: "autoRenew", label: "Auto renew", type: "checkbox" as const },
  { key: "consent", label: "Membership consent", required: true, type: "checkbox" as const, allowed: ["consent"] }
];

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);
    const body = await readJson(req);
    const idempotencyKey = validateIdempotencyKey(req.headers.get("idempotency-key") || body.idempotencyKey);
    const fields = validateFields((body.fields || {}) as Record<string, unknown>, FIELDS);
    const email = String(fields.email).toLowerCase();
    const { submission, duplicate } = await createFormSubmission({ idempotencyKey, formKey: FORM_KEY, email, payload: { fields }, honeypot: sanitizeText(body.website, 250) });
    if (duplicate) return jsonResponse({ duplicate: true, submissionId: submission.id, ...publicConfig() }, 200, origin);

    const before = await resolveMembership({ email, firstName: String(fields.firstName), lastName: String(fields.lastName) });
    if (before.outcome === "active_member_existing_hub_user" || before.outcome === "active_member_needs_hub_invite") {
      await updateFormSubmission(String(submission.id), { submission_status: "duplicate", membership_outcome: before.outcome, neon_account_id: before.neonAccountId });
      return jsonResponse({ submissionId: submission.id, membershipOutcome: before.outcome, alreadyMember: true, ...publicConfig() }, 200, origin);
    }
    if (before.outcome === "ambiguous_account") {
      await updateFormSubmission(String(submission.id), { submission_status: "requires_manual_review", membership_outcome: before.outcome });
      return jsonResponse({ submissionId: submission.id, membershipOutcome: before.outcome, requiresManualReview: true, ...publicConfig() }, 200, origin);
    }

    const account = await resolveOrCreateAccount({
      email,
      firstName: String(fields.firstName),
      lastName: String(fields.lastName),
      phone: String(fields.phone || ""),
      city: String(fields.city || ""),
      state: String(fields.state || ""),
      zip: String(fields.zip || ""),
      allowCreate: true
    });
    if (account.status === "ambiguous" || !account.neonAccountId) {
      await updateFormSubmission(String(submission.id), { submission_status: "requires_manual_review", membership_outcome: "ambiguous_account" });
      return jsonResponse({ submissionId: submission.id, membershipOutcome: "ambiguous_account", requiresManualReview: true, ...publicConfig() }, 200, origin);
    }

    const membershipId = await createMembershipServerSide({ neonAccountId: account.neonAccountId, request: { fields, source: FORM_KEY } });
    await queueHubInvitation({ submissionId: String(submission.id), email, neonAccountId: account.neonAccountId }).catch(() => undefined);
    await updateFormSubmission(String(submission.id), {
      submission_status: "completed",
      neon_sync_status: "succeeded",
      hub_invitation_status: "pending",
      neon_account_id: account.neonAccountId,
      membership_outcome: "active_member_needs_hub_invite"
    });
    return jsonResponse({ submissionId: submission.id, membershipId, membershipOutcome: "active_member_needs_hub_invite", ...publicConfig() }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("gpe-membership-enroll", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Membership enrollment could not be completed." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
