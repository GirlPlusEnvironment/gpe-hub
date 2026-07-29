import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, publicConfig, recordLeadAction, updateFormSubmission } from "../_shared/form-submission.ts";
import { sendLifecycleEmail } from "../_shared/lifecycle-email.ts";
import { createMembershipServerSide, queueHubInvitation } from "../_shared/membership-request.ts";
import { CANONICAL_MEMBERSHIP_FIELDS, normalizeCanonicalMembershipInput } from "../_shared/membership-schema.ts";
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
  { key: "consent", label: "Membership consent", required: true, type: "checkbox" as const, allowed: ["consent"] },
  ...CANONICAL_MEMBERSHIP_FIELDS
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
    const canonicalMembership = normalizeCanonicalMembershipInput(fields);
    const email = String(fields.email).toLowerCase();
    const { submission, duplicate } = await createFormSubmission({ idempotencyKey, formKey: FORM_KEY, email, payload: { fields, canonicalMembership }, membershipRequest: { requested: true, consent: true, source: FORM_KEY, ...canonicalMembership }, honeypot: sanitizeText(body.website, 250) });
    submissionId = String(submission.id);
    if (duplicate) return jsonResponse({ duplicate: true, submissionId: submission.id, ...publicConfig() }, 200, origin);

    const before = await resolveMembership({ email, firstName: String(fields.firstName), lastName: String(fields.lastName) });
    if (before.outcome === "active_member_existing_hub_user" || before.outcome === "active_member_needs_hub_invite") {
      await updateFormSubmission(String(submission.id), { submission_status: "duplicate", membership_outcome: before.outcome, neon_account_id: before.neonAccountId });
      return jsonResponse({ submissionId: submission.id, membershipOutcome: before.outcome, alreadyMember: true, neonAccountId: before.neonAccountId, ...publicConfig() }, 200, origin);
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

    const membershipResult = await createMembershipServerSide({ neonAccountId: account.neonAccountId, request: { fields, canonicalMembership, source: FORM_KEY } });
    await queueHubInvitation({ submissionId: String(submission.id), email, neonAccountId: account.neonAccountId, source: "become_member" }).catch(() => undefined);
    await updateFormSubmission(String(submission.id), {
      submission_status: "completed",
      neon_sync_status: "succeeded",
      hub_invitation_status: "pending",
      neon_account_id: account.neonAccountId,
      membership_outcome: "active_member_needs_hub_invite"
    });
    await recordLeadAction({
      submissionId: String(submission.id),
      email,
      firstName: String(fields.firstName),
      lastName: String(fields.lastName),
      phone: String(fields.phone || ""),
      postalCode: String(fields.zip || ""),
      city: String(fields.city || ""),
      state: String(fields.state || ""),
      neonAccountId: account.neonAccountId,
      actionType: "membership_enrollment",
      actionSlug: "become-a-member",
      provider: "neon_form",
      campaignSlug: "membership",
      sourceUrl: "https://www.girlplusenvironment.org/become-a-member#membership",
      membershipRequest: { requested: true, consent: true, source: FORM_KEY, canonicalMembership },
      neonSyncStatus: "succeeded",
      hubIdentityStatus: "pending",
      pointsStatus: "not_applicable",
      rawPayload: { ...membershipResult, membershipOutcome: "active_member_needs_hub_invite" }
    }).catch(() => undefined);
    await sendLifecycleEmail({
      templateKey: "member-welcome",
      recipientEmail: email,
      neonAccountId: account.neonAccountId,
      eventType: "membership_confirmed",
      sourceType: "membership",
      sourceId: String(submission.id),
      idempotencyKey: `member-welcome:${membershipResult.membershipId}`,
      category: "membership_lifecycle",
      variables: {
        firstName: String(fields.firstName),
        hubUrl: "https://members.girlplusenvironment.org",
        membershipId: membershipResult.membershipId,
        membershipTermId: String(submission.id)
      }
    }).catch(() => undefined);
    return jsonResponse({ submissionId: submission.id, neonAccountId: account.neonAccountId, ...membershipResult, membershipOutcome: "active_member_needs_hub_invite", ...publicConfig() }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    if (submissionId) {
      await updateFormSubmission(submissionId, {
        submission_status: "partial_failure",
        neon_sync_status: "failed",
        membership_outcome: "membership_creation_failed"
      }).catch(() => undefined);
    }
    console.error("gpe-membership-enroll", safeError(error));
    return jsonResponse({
      message: error instanceof ValidationError ? error.message : safeError(error) || "Membership enrollment could not be completed.",
      submissionId,
      membershipCreationStatus: "failed",
      membershipOutcome: "membership_creation_failed"
    }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
