import { type Json, getEnv, neonFetch, supabaseFetch } from "./neon-membership.ts";
import { sanitizeText } from "./validation.ts";
import { sendLifecycleEmail } from "./lifecycle-email.ts";
import { recordMembershipProfileActivity } from "./membership-neon-mapping.ts";

export class MembershipCreationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MembershipCreationError";
    this.code = code;
  }
}

export async function createMembershipRequestActivity(neonAccountId: string, request: Json) {
  const now = new Date().toISOString();
  const statusId = getEnv("NEON_ACTIVITY_OPEN_STATUS_ID", false) || getEnv("NEON_ACTIVITY_STATUS_ID", false);
  const timeZoneId = getEnv("NEON_ACTIVITY_TIMEZONE_ID", false);
  if (!statusId || !timeZoneId) {
    throw new Error("Neon activity status/timezone IDs are not configured.");
  }
  const result = await neonFetch("/activities", {
    method: "POST",
    body: JSON.stringify({
      subject: "GPE Membership Request",
      note: JSON.stringify(request).slice(0, 10_000),
      activityDates: {
        startDate: now,
        endDate: now,
        timeZone: { id: timeZoneId }
      },
      clientAccount: [{ accountId: neonAccountId }],
      status: { id: statusId },
      priority: "Normal"
    })
  });
  const data = result as Json;
  return String(data.id || data.activityId || "");
}

export async function queueHubInvitation(args: { submissionId: string; email: string; neonAccountId: string; source?: string }) {
  const queuedInvitation = {
    source: args.source || "membership_enrollment",
    source_id: args.submissionId,
    normalized_email: sanitizeText(args.email, 320).toLowerCase(),
    neon_account_id: args.neonAccountId,
    status: "pending"
  };
  const invitationUrl = getEnv("HUB_INVITATION_FUNCTION_URL", false);
  if (!invitationUrl) {
    await supabaseFetch("hub_invitations", {
      method: "POST",
      body: JSON.stringify(queuedInvitation)
    });
    return false;
  }
  const secret = getEnv("HUB_INVITATION_SECRET", false);
  if (!secret) {
    await supabaseFetch("hub_invitations", {
      method: "POST",
      body: JSON.stringify(queuedInvitation)
    });
    return false;
  }
  const res = await fetch(invitationUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
    body: JSON.stringify(args)
  });
  if (!res.ok) throw new Error(`Hub invitation workflow failed (${res.status}).`);
  return true;
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
    finalization.membershipProfileMapped = true;
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
