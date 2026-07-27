import { supabase } from "@/lib/supabaseClient";
import { checkNeonMembership, type MembershipCheckResult } from "@/lib/membership";

export type MembershipIdentityDiagnostic = {
  email: string;
  auth: {
    exists: boolean;
    userId: string | null;
  };
  profile: {
    id: string;
    email: string | null;
    neonAccountId: string | null;
    memberStatus: string | null;
    membershipAccessState: string | null;
    membershipLevel: string | null;
    membershipStartDate: string | null;
    membershipEndDate: string | null;
    membershipLastSyncedAt: string | null;
    updatedAt: string | null;
  } | null;
  membershipAccess: {
    id: string;
    userId: string | null;
    normalizedEmail: string | null;
    neonAccountId: string | null;
    isActive: boolean | null;
    accessState: string | null;
    membershipStatus: string | null;
    membershipLevel: string | null;
    startsAt: string | null;
    expiresAt: string | null;
    lastVerifiedAt: string | null;
    updatedAt: string | null;
  } | null;
};

export type MembershipDiagnosticReport = {
  local: MembershipIdentityDiagnostic;
  live: MembershipCheckResult | null;
  liveError: string | null;
};

export async function getMembershipDiagnosticReport(email: string): Promise<MembershipDiagnosticReport> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.rpc("admin_get_membership_identity_diagnostic", {
    p_email: normalizedEmail,
  });

  if (error) throw error;

  const liveResult = await checkNeonMembership({ email: normalizedEmail });

  return {
    local: data as MembershipIdentityDiagnostic,
    live: liveResult.data,
    liveError: liveResult.error,
  };
}
