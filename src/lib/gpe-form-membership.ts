export type GpeMembershipOutcome =
  | "active_member_existing_hub_user"
  | "active_member_needs_hub_invite"
  | "inactive_or_expired_member"
  | "nonmember"
  | "ambiguous_account"
  | "lookup_failed";

export type GpeMembershipResult = {
  matched: boolean;
  isActiveMember: boolean;
  neonAccountId: string | null;
  membershipStatus: string | null;
  hubAccess: string;
  outcome: GpeMembershipOutcome;
};

export const membershipPreflightMessages: Record<GpeMembershipOutcome | "checking" | "idle", string> = {
  idle: "",
  checking: "Checking your GPE membership...",
  active_member_existing_hub_user: "We found your active GPE membership. You can continue with this form.",
  active_member_needs_hub_invite: "We found your active GPE membership. We'll also help connect you to the GPE Hub.",
  inactive_or_expired_member: "We found an account, but there is no active membership associated with it.",
  nonmember: "We couldn't find an active GPE membership for this email.",
  ambiguous_account: "We found more than one possible account. Please verify your name or contact GPE before creating a duplicate account.",
  lookup_failed: "Membership could not be checked right now. You can still continue with this form."
};

export function isValidEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

export async function checkGpeMembership(input: {
  functionUrl: string;
  email: string;
  firstName?: string;
  lastName?: string;
  signal?: AbortSignal;
}): Promise<GpeMembershipResult> {
  if (!isValidEmail(input.email)) {
    return {
      matched: false,
      isActiveMember: false,
      neonAccountId: null,
      membershipStatus: null,
      hubAccess: "unknown",
      outcome: "lookup_failed"
    };
  }

  const response = await fetch(input.functionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email.trim(),
      firstName: input.firstName || "",
      lastName: input.lastName || ""
    }),
    signal: input.signal
  });

  if (!response.ok) {
    return {
      matched: false,
      isActiveMember: false,
      neonAccountId: null,
      membershipStatus: null,
      hubAccess: "unknown",
      outcome: "lookup_failed"
    };
  }

  return response.json();
}
