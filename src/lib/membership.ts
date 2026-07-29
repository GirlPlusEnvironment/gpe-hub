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
  membershipStartAt?: string | null;
  membershipEndAt?: string | null;
  hubAccess: "allowed" | "invite_required" | "membership_required" | "manual_review" | "denied" | "unknown";
  outcome: MembershipOutcome;
  publicState?:
    | "hub_user_active_member"
    | "hub_user_no_active_membership"
    | "neon_member_needs_hub_activation"
    | "expired_member"
    | "existing_constituent_no_membership"
    | "new_person"
    | "ambiguous_match"
    | "lookup_unavailable";
  hubUserLinked?: boolean;
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

export type MembershipEnrollmentFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  eligibilityAffirmed: string[];
  ageRange: string;
  raceEthnicity: string[];
  raceEthnicityOther?: string;
  genderIdentity: string[];
  genderIdentityOther?: string;
  climateInterests: string[];
  communicationPreferences: string[];
  interestedInOfficeHours: string[];
  emailConsent: string[];
  smsConsent: string[];
  termsConsent: string[];
  consent: string[];
};

export type MembershipEnrollmentResult = {
  submissionId?: string;
  neonAccountId?: string | null;
  membershipId?: string | null;
  membershipOutcome?: MembershipOutcome | "membership_creation_failed";
  membershipCreationStatus?: string;
  alreadyMember?: boolean;
  duplicate?: boolean;
  requiresManualReview?: boolean;
  message?: string;
};

export const enrollGpeMembership = async (args: {
  idempotencyKey: string;
  fields: MembershipEnrollmentFields;
}) => {
  const { data, error } = await supabase.functions.invoke<MembershipEnrollmentResult>("gpe-membership-enroll", {
    body: {
      idempotencyKey: args.idempotencyKey,
      fields: args.fields,
    },
    headers: {
      "idempotency-key": args.idempotencyKey,
    },
  });

  if (error) {
    return {
      data: null,
      error: error.message || "Membership could not be created right now.",
    };
  }

  return {
    data: data ?? null,
    error: null,
  };
};

export const updateCurrentHubMembershipState = async (args: {
  membershipAccessState: "active" | "membership_pending";
  neonAccountId?: string | null;
  membershipLevel?: string | null;
  membershipStartDate?: string | null;
  membershipEndDate?: string | null;
}) => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { error: userError?.message || "No active Hub session found." };
  }

  const now = new Date();
  const pending = args.membershipAccessState === "membership_pending";
  const payload = {
    membership_access_state: args.membershipAccessState,
    neon_account_id: args.neonAccountId || undefined,
    membership_level: args.membershipLevel || undefined,
    membership_start_date: args.membershipStartDate || undefined,
    membership_end_date: args.membershipEndDate || undefined,
  };

  const { error: authError } = await supabase.auth.updateUser({ data: payload });
  if (authError) return { error: authError.message };

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userData.user.id,
      email: userData.user.email?.toLowerCase() ?? null,
      neon_account_id: args.neonAccountId ?? null,
      member_status: args.membershipAccessState === "active" ? "active" : "pending",
      membership_status: args.membershipAccessState === "active" ? "active" : "pending",
      membership_access_state: args.membershipAccessState,
      membership_level: args.membershipLevel ?? null,
      membership_start_date: args.membershipStartDate ?? null,
      membership_end_date: args.membershipEndDate ?? null,
      membership_last_synced_at: now.toISOString(),
      account_status: "active",
      membership_pending_started_at: pending ? now.toISOString() : null,
      membership_grace_expires_at: pending
        ? new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      membership_grace_started_at: pending ? now.toISOString() : null,
      membership_deadline_at: pending
        ? new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      membership_reminder_sent_at: null,
      membership_deactivated_at: null,
      membership_deactivation_reason: null,
      deletion_scheduled_at: null,
      deleted_at: null,
      updated_at: now.toISOString(),
    },
    { onConflict: "id" },
  );

  if (profileError) return { error: profileError.message };

  return { error: null };
};

export const requestHubAccountActivation = async (args: {
  email: string;
  firstName?: string;
  lastName?: string;
}) => {
  const { data, error } = await supabase.functions.invoke<{
    message?: string;
    requestAccepted?: boolean;
  }>("hub-account-activation", {
    body: {
      email: args.email,
      firstName: args.firstName || "",
      lastName: args.lastName || "",
    },
  });

  if (error) {
    return {
      data: null,
      error: error.message || "Hub access instructions could not be sent right now.",
    };
  }

  return {
    data: data ?? null,
    error: null,
  };
};

export const getMembershipGateMessage = (outcome: MembershipOutcome | null) => {
  switch (outcome) {
    case "active_member_existing_hub_user":
      return "Your membership is already connected to the GPE Hub. Log in with your existing Hub account.";
    case "active_member_needs_hub_invite":
      return "You’re already a GPE member. Let’s activate your Hub account. We found an active membership connected to this email. Check your inbox for your secure GPE Hub invitation.";
    case "inactive_or_expired_member":
      return "GPE Hub access is a member benefit. Complete or renew your GPE membership below to unlock the Hub, campaigns, resources, and community.";
    case "nonmember":
      return "GPE Hub access is a member benefit. Complete your GPE membership below to unlock the Hub, connect with the community, and join campaigns.";
    case "ambiguous_account":
      return "We found more than one Neon account for that email. GPE needs to manually confirm your membership before Hub access can continue.";
    case "lookup_failed":
      return "We could not confirm your membership right now. Please try again shortly.";
    default:
      return null;
  }
};
