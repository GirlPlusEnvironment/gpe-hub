import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, logSync, publicConfig, updateFormSubmission } from "../_shared/form-submission.ts";
import { createMembershipServerSide, queueHubInvitation } from "../_shared/membership-request.ts";
import { resolveOrCreateAccount } from "../_shared/neon-account.ts";
import { createActivity } from "../_shared/neon-activity.ts";
import { type Json, resolveMembership, safeError, supabaseFetch } from "../_shared/neon-membership.ts";
import { readJson, sanitizeText, validateFields, validateIdempotencyKey, ValidationError } from "../_shared/validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const FORM_KEY = "camp_gpe";
const CAMP_FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true, type: "email" as const },
  { key: "phone", label: "Phone Number" },
  { key: "instagram", label: "Instagram Handle" },
  { key: "tiktok", label: "TikTok Handle" },
  { key: "linkedin", label: "LinkedIn URL" },
  { key: "openToCollaborations", label: "Open to Collaborations?", type: "radio" as const, allowed: ["yes", "no", ""] },
  { key: "otherAccounts", label: "Other Accounts?", type: "textarea" as const },
  { key: "membershipConsent", label: "Membership consent", type: "checkbox" as const, allowed: ["consent"] }
];

async function existingRegistration(email: string) {
  const res = await supabaseFetch(`gpe_form_registrations?select=*&form_key=eq.${FORM_KEY}&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);
  if (!res.ok) throw new Error("Could not check Camp GPE registration.");
  const rows = await res.json();
  return rows[0] || null;
}

async function createRegistration(email: string, neonAccountId: string | null) {
  const res = await supabaseFetch("gpe_form_registrations", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      form_key: FORM_KEY,
      email_normalized: email,
      neon_account_id: neonAccountId,
      registration_status: "registered"
    })
  });
  return res.ok ? (await res.json())[0] || null : null;
}

async function activeSeason() {
  const slug = Deno.env.get("ACTIVE_CAMP_SEASON_SLUG") || "camp-gpe-2026";
  const res = await supabaseFetch(`gpe_seasons?select=id,slug,name&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  if (!res.ok) throw new Error("Could not load active Camp GPE season.");
  const rows = await res.json();
  if (!rows[0]) throw new Error("Active Camp GPE season is not configured.");
  return rows[0] as { id: string; slug: string; name: string };
}

async function profileByEmail(email: string) {
  const res = await supabaseFetch(`profiles?select=id,email&email=eq.${encodeURIComponent(email)}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] as { id: string; email: string } | undefined || null;
}

async function upsertSeasonMember(params: { seasonId: string; email: string; neonAccountId: string | null }) {
  const profile = await profileByEmail(params.email);
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
  if (!res.ok) throw new Error("Could not save Camp GPE season membership.");
  const rows = await res.json();
  return rows[0] || null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);
    const body = await readJson(req);
    const idempotencyKey = validateIdempotencyKey(req.headers.get("idempotency-key") || body.idempotencyKey);
    const fields = validateFields((body.fields || {}) as Record<string, unknown>, CAMP_FIELDS);
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
    if (duplicate) return jsonResponse({ duplicate: true, registrationState: "already_registered", submissionId: submission.id, ...publicConfig() }, 200, origin);

    const existing = await existingRegistration(email);
    const season = await activeSeason();
    if (existing) {
      await upsertSeasonMember({ seasonId: season.id, email, neonAccountId: existing.neon_account_id || null });
      await updateFormSubmission(String(submission.id), { submission_status: "duplicate", neon_account_id: existing.neon_account_id || null });
      return jsonResponse({ submissionId: submission.id, registrationState: "already_registered", message: "You’re already signed up for Camp GPE with this email.", ...publicConfig() }, 200, origin);
    }

    let account: Awaited<ReturnType<typeof resolveOrCreateAccount>>;
    try {
      account = await resolveOrCreateAccount({
        email,
        firstName: String(fields.firstName),
        lastName: String(fields.lastName),
        phone: String(fields.phone || ""),
        allowCreate: true
      });
    } catch (error) {
      await createRegistration(email, null);
      await upsertSeasonMember({ seasonId: season.id, email, neonAccountId: null });
      await updateFormSubmission(String(submission.id), {
        submission_status: "requires_manual_review",
        neon_sync_status: "failed",
        neon_account_id: null,
        membership_outcome: "lookup_failed",
        last_error_summary: safeError(error)
      });
      await logSync({
        submissionId: String(submission.id),
        integration: "neon",
        operation: "camp_gpe_account_resolution",
        success: false,
        errorSummary: safeError(error)
      });
      console.error("camp-gpe-submit account resolution failed", safeError(error));
      return jsonResponse({
        submissionId: submission.id,
        registrationState: "registration_saved_pending_review",
        membershipOutcome: "lookup_failed",
        partialSuccess: true,
        message: "Your Camp GPE registration is saved. Team GPE may review membership or Hub activation details.",
        ...publicConfig()
      }, 200, origin);
    }
    if (account.status === "ambiguous") {
      await updateFormSubmission(String(submission.id), { submission_status: "requires_manual_review", membership_outcome: "ambiguous_account" });
      return jsonResponse({ submissionId: submission.id, registrationState: "registration_status_unknown", membershipOutcome: "ambiguous_account", ...publicConfig() }, 200, origin);
    }

    await createRegistration(email, account.neonAccountId);
    await upsertSeasonMember({ seasonId: season.id, email, neonAccountId: account.neonAccountId || null });

    let membership = await resolveMembership({ email, firstName: String(fields.firstName), lastName: String(fields.lastName), neonAccountId: account.neonAccountId || undefined });
    let secondaryFailure = false;
    try {
      if (fields.membershipConsent === "consent" && membership.outcome !== "active_member_existing_hub_user" && membership.outcome !== "active_member_needs_hub_invite" && account.neonAccountId) {
        await createMembershipServerSide({ neonAccountId: account.neonAccountId, request: { fields, source: FORM_KEY } });
        membership = { ...membership, outcome: "active_member_needs_hub_invite", neonAccountId: account.neonAccountId };
      }
      await createActivity({ neonAccountId: account.neonAccountId || "", subject: "Camp GPE Registration", type: "Camp GPE", note: { formKey: FORM_KEY, fields } });
      await logSync({ submissionId: String(submission.id), integration: "neon", operation: "camp_gpe_activity", success: true });
    } catch (error) {
      secondaryFailure = true;
      await logSync({ submissionId: String(submission.id), integration: "neon", operation: "camp_gpe_membership_or_activity", success: false, errorSummary: safeError(error) });
    }

    if (membership.outcome === "active_member_needs_hub_invite" && membership.neonAccountId) {
      await queueHubInvitation({ submissionId: String(submission.id), email, neonAccountId: membership.neonAccountId }).catch((error) => {
        secondaryFailure = true;
        return logSync({ submissionId: String(submission.id), integration: "hub", operation: "invite", success: false, errorSummary: safeError(error) });
      });
    }
    await updateFormSubmission(String(submission.id), {
      submission_status: secondaryFailure ? "partial_failure" : "completed",
      neon_sync_status: secondaryFailure ? "failed" : "succeeded",
      neon_account_id: account.neonAccountId,
      membership_outcome: membership.outcome
    });
    return jsonResponse({ submissionId: submission.id, registrationState: "not_registered", membershipOutcome: membership.outcome, partialSuccess: secondaryFailure, ...publicConfig() }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("camp-gpe-submit", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Camp GPE submission could not be completed." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
