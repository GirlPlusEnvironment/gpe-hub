import { supabase } from "@/lib/supabaseClient";

export type MembershipOutcome =
  | "active_member_existing_hub_user"
  | "active_member_needs_hub_invite"
  | "inactive_or_expired_member"
  | "nonmember"
  | "ambiguous_account"
  | "lookup_failed";

export type MembershipCheckResult = {
  matched: boolean;
  isActiveMember: boolean;
  neonAccountId: string | null;
  membershipStatus: string | null;
  membershipLevel: string | null;
  hubAccess: "allowed" | "invite_required" | "membership_required" | "manual_review" | "denied" | "unknown";
  outcome: MembershipOutcome;
  requiresManualReview: boolean;
  reason?: string;
};

export const GPE_MEMBERSHIP_URL =
  import.meta.env.VITE_GPE_MEMBERSHIP_URL || "https://www.girlplusenvironment.org/become-a-member";

export const MEMBERSHIP_SYNC_WARNING_STORAGE_KEY = "gpe-membership-sync-warning";

export const MEMBERSHIP_SYNC_WARNING_MESSAGE =
  "Unable to verify your GPE membership right now. You can still enter the Hub; we will retry membership sync later.";

export const checkNeonMembership = async (args: {
  email: string;
  firstName?: string;
  lastName?: string;
}) => {
  const { data, error } = await supabase.functions.invoke<MembershipCheckResult>("neon-membership-check", {
    body: {
      email: args.email,
      firstName: args.firstName || "",
      lastName: args.lastName || "",
    },
  });

  if (error) {
    return {
      data: null,
      error: error.message || "Membership lookup could not be completed.",
    };
  }

  return { data: data ?? null, error: null };
};

export const getMembershipGateMessage = (outcome: MembershipOutcome | null) => {
  switch (outcome) {
    case "active_member_existing_hub_user":
      return "Your membership is already connected to the GPE Hub. Log in with your existing Hub account.";
    case "active_member_needs_hub_invite":
      return "Your GPE membership is active, but your Hub access is not linked yet. Check your email for a secure Hub invitation or contact GPE for access support.";
    case "inactive_or_expired_member":
      return "Your GPE membership appears inactive or expired. Renew your membership to access the Hub.";
    case "nonmember":
      return "GPE Hub access is a member benefit. Complete your membership to access the Hub.";
    case "ambiguous_account":
      return "We found more than one Neon account for that email. GPE needs to manually confirm your membership before Hub access can continue.";
    case "lookup_failed":
      return "We could not confirm your membership right now. Please try again shortly.";
    default:
      return null;
  }
};
