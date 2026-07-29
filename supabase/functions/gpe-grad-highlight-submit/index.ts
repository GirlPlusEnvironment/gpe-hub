import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, logSync, publicConfig, recordLeadAction, recordPointEventForLeadAction, updateFormSubmission } from "../_shared/form-submission.ts";
import { sendLifecycleEmail } from "../_shared/lifecycle-email.ts";
import { createMembershipServerSide, queueHubInvitation } from "../_shared/membership-request.ts";
import { normalizeMembershipRequest } from "../_shared/membership-schema.ts";
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
    const membershipRequest = normalizeMembershipRequest(body.membershipRequest) as Json | null;
    let resolvedNeonAccountId: string | null = null;
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
    let membershipCreationStatus = membershipRequest ? "not_attempted" : "not_requested";
    let membershipFailureMessage = "";
    let activityFailureMessage = "";
    try {
      const account = await resolveOrCreateAccount({
        email,
        firstName: String(fields.firstName),
        lastName: String(fields.lastName),
        allowCreate: true
      });
      if (account.status !== "ambiguous" && account.neonAccountId) {
        resolvedNeonAccountId = account.neonAccountId;
        await updateFormSubmission(submissionId, { neon_account_id: account.neonAccountId, neon_sync_status: "succeeded" });
        try {
          await createActivity({ neonAccountId: account.neonAccountId, subject: "GPE Grad Highlight Submission", type: "Highlight", note: { formKey: FORM_KEY, fields } });
          await logSync({ submissionId, integration: "neon", operation: "grad_highlight_activity", success: true });
        } catch (error) {
          activityFailureMessage = safeError(error);
          await logSync({ submissionId, integration: "neon", operation: "grad_highlight_activity", success: false, errorSummary: activityFailureMessage });
        }
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
        const membershipResult = await createMembershipServerSide({ neonAccountId: account.neonAccountId, email, request: { request, fields, source: FORM_KEY } });
        await queueHubInvitation({ submissionId, email, neonAccountId: account.neonAccountId, source: FORM_KEY }).catch((error) =>
          logSync({ submissionId, integration: "hub", operation: "invite", success: false, errorSummary: safeError(error) })
        );
        membershipCreationStatus = membershipResult.membershipCreationStatus;
        membershipOutcome = "active_member_needs_hub_invite";
      }
    } catch (error) {
      membershipFailureMessage = safeError(error);
      membershipCreationStatus = membershipRequest ? "failed" : "not_attempted";
      await logSync({ submissionId, integration: "neon", operation: "grad_highlight_membership", success: false, errorSummary: membershipFailureMessage });
    }
    const membershipFailed = membershipRequest && membershipCreationStatus === "failed";
    await updateFormSubmission(submissionId, {
      submission_status: membershipOutcome === "lookup_failed" || membershipFailed ? "partial_failure" : "completed",
      membership_outcome: membershipFailed ? "membership_creation_failed" : membershipOutcome,
      neon_sync_status: membershipOutcome === "lookup_failed" || membershipFailed ? "failed" : "succeeded"
    });
    const leadActionResult = await recordLeadAction({
      submissionId,
      email,
      firstName: String(fields.firstName),
      lastName: String(fields.lastName),
      neonAccountId: resolvedNeonAccountId,
      actionType: "grad_highlight_submission",
      actionSlug: "gpe-grad-highlight",
      provider: "neon_form",
      campaignSlug: "gpe-grad-highlight",
      sourceUrl: "https://www.girlplusenvironment.org/gpe-grad-highlight#submission",
      membershipRequest,
      neonSyncStatus: membershipOutcome === "lookup_failed" || membershipFailed ? "failed" : "succeeded",
      hubIdentityStatus: membershipOutcome === "active_member_needs_hub_invite" ? "pending" : "not_attempted",
      pointsStatus: "not_applicable",
      rawPayload: { membershipOutcome, membershipCreationStatus, membershipFailureMessage, activityFailureMessage }
    }).catch((error) => logSync({ submissionId, integration: "supabase", operation: "lead_action", success: false, errorSummary: safeError(error) }));
    await recordPointEventForLeadAction({
      eventType: "grad_highlight_submission",
      email,
      leadAction: leadActionResult?.action,
      lead: leadActionResult?.lead,
      source: "gpe_grad_highlight",
      sourceId: submissionId,
      campaignSlug: "gpe-grad-highlight",
      metadata: {
        formKey: FORM_KEY,
        submissionId,
        membershipOutcome,
        membershipCreationStatus,
        activityFailureMessage
      }
    }).catch((error) => logSync({ submissionId, integration: "points", operation: "grad_highlight_point_event", success: false, errorSummary: safeError(error) }));
    await sendLifecycleEmail({
      templateKey: "graduate-highlight-submission",
      recipientEmail: email,
      neonAccountId: resolvedNeonAccountId,
      eventType: "grad_highlight_submitted",
      sourceType: FORM_KEY,
      sourceId: submissionId,
      idempotencyKey: `graduate-highlight-submission:${submissionId}`,
      category: "public_form_followup",
      variables: {
        firstName: String(fields.firstName),
        hubUrl: "https://members.girlplusenvironment.org",
        communityResourcesUrl: "https://www.girlplusenvironment.org/resources"
      }
    }).catch((error) => logSync({ submissionId, integration: "email", operation: "grad_highlight_lifecycle_email", success: false, errorSummary: safeError(error) }));
    if (membershipFailed) {
      return jsonResponse({
        message: "Your Grad Highlight was saved, but membership could not be created yet. Team GPE can retry from the saved submission.",
        submissionId,
        membershipOutcome: "membership_creation_failed",
        membershipCreationStatus,
        partialSuccess: true,
        ...publicConfig()
      }, 502, origin);
    }
    return jsonResponse({ submissionId, membershipOutcome, membershipCreationStatus, ...publicConfig() }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    if (submissionId) await updateFormSubmission(submissionId, { submission_status: "partial_failure" }).catch(() => undefined);
    console.error("gpe-grad-highlight-submit", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Grad highlight submission could not be completed." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
