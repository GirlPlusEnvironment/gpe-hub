import { type Json, getEnv, neonFetch, supabaseFetch } from "./neon-membership.ts";
import { sanitizeText } from "./validation.ts";

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

export async function queueHubInvitation(args: { submissionId: string; email: string; neonAccountId: string }) {
  const invitationUrl = getEnv("HUB_INVITATION_FUNCTION_URL", false);
  if (!invitationUrl) {
    await supabaseFetch("hub_invitations", {
      method: "POST",
      body: JSON.stringify({
        submission_id: args.submissionId,
        normalized_email: sanitizeText(args.email, 320).toLowerCase(),
        neon_account_id: args.neonAccountId,
        status: "pending"
      })
    });
    return false;
  }
  const secret = getEnv("HUB_INVITATION_SECRET");
  const res = await fetch(invitationUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
    body: JSON.stringify(args)
  });
  if (!res.ok) throw new Error(`Hub invitation workflow failed (${res.status}).`);
  return true;
}

export async function createMembershipServerSide(args: { neonAccountId: string; request: Json }) {
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
      term: { id: termId },
      status: "Active"
    })
  });
  const data = result as Json;
  const membershipId = String(data.id || data.membershipId || "");
  if (!membershipId) {
    throw new MembershipCreationError("membership_id_missing", "Neon did not return a membership ID.");
  }
  return {
    membershipId,
    membershipCreationStatus: "confirmed" as const
  };
}
