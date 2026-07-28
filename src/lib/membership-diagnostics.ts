import { supabase } from "@/lib/supabaseClient";
import { checkNeonMembership, type MembershipCheckResult } from "@/lib/membership";
import { challengeDefinition } from "@/lib/challenge-definition";
import {
  getActiveCampSeason,
  getAdminCampChallenges,
  getCampLeaderboard,
  getPendingCampSubmissions,
  getPointRules,
} from "@/lib/camp";

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

export type ChallengeDiagnosticReport = {
  season: {
    id: string;
    name: string;
    status: string;
    isVisible: boolean;
  } | null;
  currentChallenge: {
    id: string;
    title: string;
    slug: string;
    startsAt: string | null;
    endsAt: string | null;
  } | null;
  checks: Array<{
    label: string;
    value: string;
    status: "pass" | "warn" | "fail";
  }>;
};

export type CrmConfigurationCheck = {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  required: boolean;
  category: "neon" | "membership" | "activities" | "automations" | "hub" | "action_network";
  message: string;
};

export type CrmConfigurationReport = {
  ok: boolean;
  status: "ready" | "warning" | "blocked";
  membershipCreationEnabled: boolean;
  activityLoggingEnabled: boolean;
  officeHoursAutomationReady: boolean;
  checkedAt: string;
  checks: CrmConfigurationCheck[];
  blockers: string[];
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

export async function getChallengeDiagnosticReport(): Promise<ChallengeDiagnosticReport> {
  const season = await getActiveCampSeason();
  if (!season) {
    return {
      season: null,
      currentChallenge: null,
      checks: [
        { label: "Active season", value: "No visible active season", status: "fail" },
      ],
    };
  }

  const [challenges, submissions, leaderboardRows, pointRules] = await Promise.all([
    getAdminCampChallenges(season.id),
    getPendingCampSubmissions(season.id),
    getCampLeaderboard(season.id, 5),
    getPointRules(),
  ]);
  const now = Date.now();
  const currentChallenge = challenges.find((challenge) => {
    const starts = challenge.starts_at ? new Date(challenge.starts_at).getTime() : null;
    const ends = challenge.ends_at ? new Date(challenge.ends_at).getTime() : null;
    return challenge.is_active && challenge.is_hub_visible && (!starts || now >= starts) && (!ends || now <= ends);
  }) || null;
  const definition = currentChallenge ? challengeDefinition(currentChallenge) : null;
  const reviewCount = submissions.filter((submission) =>
    (submission.gpe_camp_submission_actions || []).some((action) => action.review_status === "pending"),
  ).length;
  const campChallengeRule = pointRules.find((rule) => rule.action_type === "camp_challenge_completion");
  const notifications = definition?.notifications || {};
  const notificationCount = Object.values(notifications).filter(Boolean).length;

  return {
    season: {
      id: season.id,
      name: season.name,
      status: season.status,
      isVisible: season.is_visible,
    },
    currentChallenge: currentChallenge ? {
      id: currentChallenge.id,
      title: currentChallenge.title,
      slug: currentChallenge.slug,
      startsAt: currentChallenge.starts_at,
      endsAt: currentChallenge.ends_at,
    } : null,
    checks: [
      { label: "Active season", value: `${season.name} / ${season.status}`, status: season.is_visible ? "pass" : "warn" },
      { label: "Current live challenge", value: currentChallenge?.title || "None", status: currentChallenge ? "pass" : "fail" },
      { label: "Open Flow", value: definition?.open_flow?.kind || "Not configured", status: definition?.open_flow?.kind ? "pass" : "fail" },
      { label: "Submission enabled", value: String(definition?.submission?.enabled !== false), status: definition?.submission?.enabled === false ? "warn" : "pass" },
      { label: "Review queue", value: `${reviewCount} pending`, status: reviewCount > 25 ? "warn" : "pass" },
      { label: "Leaderboard", value: `${leaderboardRows.length} visible rows`, status: leaderboardRows.length > 0 ? "pass" : "warn" },
      { label: "Points enabled", value: campChallengeRule ? `${campChallengeRule.display_name} / +${campChallengeRule.point_value}` : "Missing rule", status: campChallengeRule?.active ? "pass" : "fail" },
      { label: "Notifications", value: `${notificationCount} configured`, status: notificationCount > 0 ? "pass" : "warn" },
    ],
  };
}

export async function getCrmConfigurationReport(): Promise<CrmConfigurationReport> {
  const { data, error } = await supabase.functions.invoke<CrmConfigurationReport>("admin-crm-configuration", {
    body: { action: "validate" },
  });
  if (error) throw error;
  if (!data) throw new Error("CRM configuration report was empty.");
  return data;
}
