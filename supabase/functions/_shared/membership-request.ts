import { type Json, getEnv, neonFetch, supabaseFetch } from "./neon-membership.ts";
import { sanitizeText } from "./validation.ts";
import { sendLifecycleEmail } from "./lifecycle-email.ts";
import { recordMembershipProfileActivity } from "./membership-neon-mapping.ts";
import { createActivity } from "./neon-activity.ts";

export class MembershipCreationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MembershipCreationError";
    this.code = code;
  }
}

export async function createMembershipRequestActivity(neonAccountId: string, request: Json) {
  return await createActivity({
    neonAccountId,
    subject: "GPE Membership Request",
    note: request,
    statusKind: "open",
  });
}

async function persistPendingHubInvitation(queuedInvitation: Json) {
  const res = await supabaseFetch("hub_invitations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(queuedInvitation)
  });
  if (!res.ok) throw new Error(`Could not save pending Hub invitation (${res.status}): ${(await res.text()).slice(0, 250)}`);
}

function edgeFunctionUrl(functionName: string) {
  const base = (getEnv("GPE_SUPABASE_URL", false) || getEnv("SUPABASE_URL", false)).replace(/\/$/, "");
  return base ? `${base}/functions/v1/${functionName}` : "";
}

async function postHubActivation(args: { url: string; email: string; neonAccountId: string; source?: string; submissionId: string }) {
  const anonKey = getEnv("GPE_SUPABASE_ANON_KEY", false) || getEnv("SUPABASE_ANON_KEY", false);
  if (!anonKey) throw new Error("Missing Supabase anon key for Hub activation.");
  const res = await fetch(args.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      email: args.email,
      neonAccountId: args.neonAccountId,
      source: args.source || "membership_enrollment",
      sourceId: args.submissionId,
    })
  });
  if (!res.ok) throw new Error(`Hub activation workflow failed (${res.status}): ${(await res.text()).slice(0, 250)}`);
}

async function postConfiguredHubInvitation(args: { url: string; secret: string; email: string; neonAccountId: string; source?: string; submissionId: string }) {
  const { url, secret, ...body } = args;
  const res = await fetch(args.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Hub invitation workflow failed (${res.status}): ${(await res.text()).slice(0, 250)}`);
}

export async function queueHubInvitation(args: { submissionId: string; email: string; neonAccountId: string; source?: string }) {
  const queuedInvitation = {
    submission_id: args.source === "neon_climate_survey" ? args.submissionId : null,
    source: args.source || "membership_enrollment",
    source_id: args.submissionId,
    normalized_email: sanitizeText(args.email, 320).toLowerCase(),
    neon_account_id: args.neonAccountId,
    status: "pending"
  };
  const invitationUrl = getEnv("HUB_INVITATION_FUNCTION_URL", false);
  const secret = getEnv("HUB_INVITATION_SECRET", false);
  const errors: string[] = [];

  const activationUrl = edgeFunctionUrl("hub-account-activation");
  if (activationUrl) {
    try {
      await postHubActivation({ ...args, url: activationUrl });
      return true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Hub account activation failed.");
    }
  }

  if (invitationUrl && secret) {
    try {
      await postConfiguredHubInvitation({ ...args, url: invitationUrl, secret });
      return true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Configured Hub invitation failed.");
    }
  }

  await persistPendingHubInvitation({
    ...queuedInvitation,
    last_error_summary: errors.slice(-3).join(" | ").slice(0, 500),
  });
  return false;
}

async function claimPendingAwards(profileId: string) {
  await supabaseFetch("rpc/service_claim_pending_point_awards_for_profile", {
    method: "POST",
    body: JSON.stringify({ p_profile_id: profileId }),
  }).catch(() => undefined);
}

async function resolvePendingHubProfileAfterMembership(args: {
  email?: string;
  neonAccountId: string;
  membershipId: string;
}) {
  const email = sanitizeText(args.email, 320).toLowerCase();
  if (!email) return;
  const now = new Date().toISOString();
  await supabaseFetch(`membership_lookup_cache?normalized_email=eq.${encodeURIComponent(email)}`, {
    method: "DELETE",
  }).catch(() => undefined);

  const profileRes = await supabaseFetch(
    `profiles?select=id,email,membership_access_state,account_status&email=eq.${encodeURIComponent(email)}&membership_access_state=eq.membership_pending&limit=1`,
  );
  if (!profileRes.ok) return;
  const rows = await profileRes.json().catch(() => []) as Json[];
  const profile = rows[0];
  const profileId = typeof profile?.id === "string" ? profile.id : "";
  if (!profileId) return;

  await supabaseFetch(`profiles?id=eq.${encodeURIComponent(profileId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      neon_account_id: args.neonAccountId,
      member_status: "active",
      membership_status: "active",
      membership_access_state: "active",
      account_status: "active",
      membership_last_synced_at: now,
      membership_pending_started_at: null,
      membership_grace_expires_at: null,
      membership_reminder_sent_at: null,
      membership_deactivated_at: null,
      membership_deactivation_reason: null,
      membership_grace_started_at: null,
      membership_deadline_at: null,
      deletion_scheduled_at: null,
      deleted_at: null,
      updated_at: now,
    }),
  }).catch(() => undefined);

  await claimPendingAwards(profileId);
}

async function hasLinkedHubProfile(args: { email?: string; neonAccountId: string }) {
  const email = sanitizeText(args.email, 320).toLowerCase();
  if (args.neonAccountId) {
    const byNeon = await supabaseFetch([
      "profiles?select=id",
      `neon_account_id=eq.${encodeURIComponent(args.neonAccountId)}`,
      "limit=1",
    ].join("&")).catch(() => null);
    if (byNeon?.ok) {
      const rows = await byNeon.json().catch(() => []) as Json[];
      if (rows[0]?.id) return true;
    }
  }
  if (!email) return false;
  const byEmail = await supabaseFetch([
    "profiles?select=id",
    `email=ilike.${encodeURIComponent(email)}`,
    "limit=1",
  ].join("&")).catch(() => null);
  if (!byEmail?.ok) return false;
  const rows = await byEmail.json().catch(() => []) as Json[];
  return Boolean(rows[0]?.id);
}

export async function createMembershipServerSide(args: { neonAccountId: string; request: Json; email?: string }) {
  const levelId = getEnv("DEFAULT_MEMBERSHIP_LEVEL_ID", false);
  const termId = getEnv("DEFAULT_MEMBERSHIP_TERM_ID", false);
  if (!levelId || !termId) {
    await createMembershipRequestActivity(args.neonAccountId, {
      ...args.request,
      note: "Membership level/term IDs are not configured; real membership was not created."
    }).catch(() => undefined);
    throw new MembershipCreationError(
      "membership_config_missing",
      "Membership is not fully configured. Team GPE has your submission, but the membership record was not created yet."
    );
  }
  const result = await neonFetch("/memberships", {
    method: "POST",
    body: JSON.stringify({
      accountId: args.neonAccountId,
      membershipLevel: { id: levelId },
      membershipTerm: { id: termId },
      term: { id: termId },
      transactionDate: new Date().toISOString(),
      fee: 0,
      totalCharge: 0,
      autoRenewal: false,
      status: "Active"
    })
  });
  const data = result as Json;
  const membershipId = String(data.id || data.membershipId || "");
  if (!membershipId) {
    throw new MembershipCreationError("membership_id_missing", "Neon did not return a membership ID.");
  }
  await resolvePendingHubProfileAfterMembership({
    email: args.email,
    neonAccountId: args.neonAccountId,
    membershipId,
  });
  return {
    membershipId,
    membershipCreationStatus: "confirmed" as const
  };
}

export async function createAndFinalizeMembership(args: {
  neonAccountId: string;
  email: string;
  request: Json;
  source: string;
  submissionId: string;
  firstName?: string;
}) {
  const membershipResult = await createMembershipServerSide({
    neonAccountId: args.neonAccountId,
    email: args.email,
    request: args.request,
  });
  const finalization = {
    membershipId: membershipResult.membershipId,
    membershipCreationStatus: membershipResult.membershipCreationStatus,
    membershipProfileActivityId: null as string | null,
    membershipProfileMapped: false,
    missingMembershipMappings: [] as Json[],
    membershipEmailQueued: false,
    membershipEmailStatus: "not_attempted",
    hubInviteQueued: false,
    hubInviteStatus: "not_required",
  };

  try {
    const profileResult = await recordMembershipProfileActivity({
      neonAccountId: args.neonAccountId,
      membershipId: membershipResult.membershipId,
      request: args.request,
      source: args.source,
    });
    finalization.membershipProfileActivityId = profileResult.activityId || null;
    finalization.membershipProfileMapped = profileResult.missingMappings.length === 0;
    finalization.missingMembershipMappings = profileResult.missingMappings as Json[];
  } catch (error) {
    finalization.membershipProfileMapped = false;
    finalization.missingMembershipMappings = [{ error: error instanceof Error ? error.message : "Membership profile activity could not be recorded." }];
  }

  try {
    const linkedProfile = await hasLinkedHubProfile({ email: args.email, neonAccountId: args.neonAccountId });
    if (linkedProfile) {
      finalization.hubInviteQueued = false;
      finalization.hubInviteStatus = "not_required_existing_hub_profile";
    } else {
      const invited = await queueHubInvitation({
        submissionId: args.submissionId,
        email: args.email,
        neonAccountId: args.neonAccountId,
        source: args.source,
      });
      finalization.hubInviteQueued = true;
      finalization.hubInviteStatus = invited ? "sent" : "queued";
    }
  } catch (error) {
    finalization.hubInviteStatus = error instanceof Error ? error.message : "failed";
  }

  try {
    const emailResult = await sendLifecycleEmail({
      templateKey: "member-welcome",
      recipientEmail: args.email,
      neonAccountId: args.neonAccountId,
      eventType: "membership_confirmed",
      sourceType: args.source,
      sourceId: args.submissionId,
      idempotencyKey: `member-welcome:${membershipResult.membershipId}`,
      category: "membership_lifecycle",
      variables: {
        firstName: args.firstName || "there",
        hubUrl: "https://members.girlplusenvironment.org",
        invitePageUrl: "https://members.girlplusenvironment.org/invite/",
        membershipId: membershipResult.membershipId,
        membershipTermId: args.submissionId,
      },
    });
    finalization.membershipEmailQueued = Boolean(emailResult?.ok && ["sent", "already_sent"].includes(String(emailResult.status)));
    finalization.membershipEmailStatus = String(emailResult?.status || "unknown");
  } catch (error) {
    finalization.membershipEmailStatus = error instanceof Error ? error.message : "failed";
  }

  return finalization;
}
