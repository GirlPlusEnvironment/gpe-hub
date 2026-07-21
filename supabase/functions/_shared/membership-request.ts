import { type Json, getEnv, neonFetch, supabaseFetch } from "./neon-membership.ts";
import { sanitizeText } from "./validation.ts";

export async function createMembershipRequestActivity(neonAccountId: string, request: Json) {
  const result = await neonFetch("/activities", {
    method: "POST",
    body: JSON.stringify({
      accountId: neonAccountId,
      subject: "GPE Membership Request",
      type: "Membership",
      status: "Open",
      priority: "Normal",
      note: JSON.stringify(request).slice(0, 10_000),
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10)
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
    return createMembershipRequestActivity(args.neonAccountId, {
      ...args.request,
      note: "Membership level/term IDs are not configured; dashboard follow-up required."
    });
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
  return String(data.id || data.membershipId || "");
}
