import { supabase } from "@/lib/supabaseClient";
import type { ReviewStatus } from "@/lib/review-status";

export type CampSeason = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: "draft" | "active" | "archived";
  is_visible: boolean;
  point_rules?: Record<string, unknown> | null;
};

export type CampLeaderboardRow = {
  season_id: string;
  season_slug: string;
  season_member_id: string;
  user_id: string | null;
  contact_email: string;
  neon_account_id: string | null;
  cabin_id: string | null;
  cabin_name: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  points: number;
  approved_challenge_count?: number;
  rank: number;
  updated_at?: string;
};

export type CampCabinLeaderboardRow = {
  season_id: string;
  cabin_id: string;
  cabin_name: string;
  points: number;
  member_count: number;
  rank: number;
  updated_at?: string;
};

export type CampChallenge = {
  id: string;
  season_id: string;
  action_type_id: string | null;
  slug: string;
  title: string;
  short_description: string | null;
  instructions: string | null;
  category: string;
  point_value: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  is_public: boolean;
  is_hub_visible: boolean;
  requires_proof: boolean;
  requires_review: boolean;
  auto_approve: boolean;
  allow_multiple_submissions: boolean;
  max_completions_per_member: number;
  display_order: number;
  action_url: string | null;
  action_type_slug?: string | null;
  action_type_label?: string | null;
  season_slug?: string;
  season_name?: string;
};

export type CampSubmissionAction = {
  id: string;
  submission_id: string;
  challenge_id: string | null;
  action_type_id: string | null;
  other_description: string | null;
  proof_urls: string[];
  requested_points: number | null;
  approved_points: number | null;
  review_status: ReviewStatus;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  gpe_challenges?: Pick<
    CampChallenge,
    "id" | "title" | "slug" | "point_value" | "requires_proof" | "requires_review" | "auto_approve" | "category"
  > | null;
};

export type CampSeasonMember = {
  id: string;
  season_id: string;
  user_id: string | null;
  contact_email: string;
  neon_account_id: string | null;
  status: string;
  joined_at?: string;
  cabin_id?: string | null;
  gpe_cabins?: {
    name: string | null;
    description?: string | null;
    image_url?: string | null;
  } | null;
};

export type CampSubmission = {
  id: string;
  season_id: string;
  season_member_id: string | null;
  user_id: string | null;
  neon_account_id: string | null;
  contact_email: string;
  challenge_key: string;
  submitted_payload: { fields?: Record<string, unknown> } | null;
  proof_links: string[];
  review_status: ReviewStatus | "needs_info";
  reviewed_by: string | null;
  reviewed_at: string | null;
  member_link_status?: string | null;
  member_link_notes?: string | null;
  authenticated_user_id?: string | null;
  created_at: string;
  gpe_camp_submission_actions?: CampSubmissionAction[];
};

export type CampPointsLedgerRow = {
  id: string;
  season_id: string;
  season_member_id: string;
  user_id: string | null;
  submission_id: string | null;
  submission_action_id?: string | null;
  challenge_id?: string | null;
  points: number;
  reason: string;
  adjustment_type: "award" | "correction" | "manual" | "reversal";
  entry_type?: "challenge_award" | "manual_adjustment" | "bonus" | "penalty" | "reversal";
  source?: string;
  awarded_by?: string | null;
  created_at: string;
  reversed_at: string | null;
  reversed_entry_id?: string | null;
  reversal_reason: string | null;
};

export type CampRecentActivityRow = CampPointsLedgerRow & {
  profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  gpe_challenges?: {
    title: string | null;
    category: string | null;
  } | null;
};

export async function getActiveCampSeason() {
  const { data, error } = await supabase
    .from("gpe_seasons")
    .select("id,slug,name,description,starts_at,ends_at,status,is_visible,point_rules")
    .eq("status", "active")
    .eq("is_visible", true)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CampSeason | null;
}

export async function getCampLeaderboard(seasonId: string, limit = 50) {
  const { data, error } = await supabase
    .from("gpe_camp_leaderboard")
    .select("*")
    .eq("season_id", seasonId)
    .order("points", { ascending: false })
    .order("rank", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as CampLeaderboardRow[];
}

export async function getCampCabinLeaderboard(seasonId: string) {
  const { data, error } = await supabase
    .from("gpe_camp_cabin_leaderboard")
    .select("*")
    .eq("season_id", seasonId)
    .order("points", { ascending: false })
    .order("rank", { ascending: true });
  if (error) throw error;
  return (data || []) as CampCabinLeaderboardRow[];
}

export async function getHubCampChallenges(seasonId: string) {
  const { data, error } = await supabase
    .from("gpe_hub_camp_challenges")
    .select("*")
    .eq("season_id", seasonId)
    .order("display_order", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw error;
  return (data || []).map((challenge) => ({
    ...challenge,
    action_url: canonicalCampActionUrl(challenge.action_url),
  })) as CampChallenge[];
}

export function canonicalCampActionUrl(url: string | null | undefined) {
  if (!url) return null;
  if (/actionnetwork\.org\/letters\/tell-congress-we-need-relief-from-high-energy-bills-partner/i.test(url)) {
    return "https://www.girlplusenvironment.org/high-energy-bills-action";
  }
  if (/actionnetwork\.org\/petitions\/stop-trumps-700-million-coal-slush-fund-partner/i.test(url)) {
    return "https://www.girlplusenvironment.org/coal-slush-fund-action";
  }
  if (/actionnetwork\.org\/letters\/extreme-weather-puts-our-communities-at-risk-its-time-for-bold-climate-action-2/i.test(url)) {
    return "https://www.girlplusenvironment.org/extreme-weather-action";
  }
  return url;
}

export async function getMyCampStatus(seasonId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("gpe_season_members")
    .select("id,season_id,user_id,contact_email,cabin_id,joined_at,status,gpe_cabins(name,description,image_url)")
    .eq("season_id", seasonId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyCampHistory(seasonId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { submissions: [] as CampSubmission[], ledger: [] as CampPointsLedgerRow[] };

  const [{ data: submissions, error: submissionsError }, { data: ledger, error: ledgerError }] =
    await Promise.all([
      supabase
        .from("gpe_camp_challenge_submissions")
        .select("*, gpe_camp_submission_actions(*, gpe_challenges(id,title,slug,point_value,requires_proof,requires_review,auto_approve,category))")
        .eq("season_id", seasonId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("gpe_camp_points_ledger")
        .select("*")
        .eq("season_id", seasonId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  if (submissionsError) throw submissionsError;
  if (ledgerError) throw ledgerError;
  return {
    submissions: (submissions || []) as CampSubmission[],
    ledger: (ledger || []) as CampPointsLedgerRow[],
  };
}

export async function getCampRecentActivity(seasonId: string, limit = 12) {
  const { data, error } = await supabase
    .from("gpe_camp_points_ledger")
    .select("*, profiles:user_id(username,full_name,avatar_url), gpe_challenges:challenge_id(title,category)")
    .eq("season_id", seasonId)
    .is("reversed_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as CampRecentActivityRow[];
}

export async function getPendingCampSubmissions(seasonId: string) {
  const { data, error } = await supabase
    .from("gpe_camp_challenge_submissions")
    .select("*, gpe_camp_submission_actions(*, gpe_challenges(id,title,slug,point_value,requires_proof,requires_review,auto_approve,category))")
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as CampSubmission[];
}

export async function searchSeasonMembers(seasonId: string, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];
  const { data, error } = await supabase
    .from("gpe_season_members")
    .select("id,season_id,user_id,contact_email,neon_account_id,status,gpe_cabins(name)")
    .eq("season_id", seasonId)
    .ilike("contact_email", `%${trimmed}%`)
    .limit(25);
  if (error) throw error;
  return data || [];
}

export async function addManualCampPoints(params: {
  seasonId: string;
  seasonMemberId: string;
  points: number;
  reason: string;
}) {
  const { error } = await supabase.rpc("add_manual_camp_point_entry", {
    p_season_id: params.seasonId,
    p_season_member_id: params.seasonMemberId,
    p_points: params.points,
    p_reason: params.reason,
  });
  if (error) throw error;
}

export async function approveCampSubmissionAction(params: {
  actionId: string;
  points?: number | null;
  notes?: string | null;
}) {
  const { error } = await supabase.rpc("approve_camp_submission_action", {
    p_action_id: params.actionId,
    p_points: params.points ?? null,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
}

export async function markCampSubmissionAction(params: {
  actionId: string;
  status: "rejected" | "needs_information" | "duplicate";
  notes?: string | null;
}) {
  const { error } = await supabase.rpc("mark_camp_submission_action", {
    p_action_id: params.actionId,
    p_status: params.status,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
}

export async function associateCampSubmissionMember(params: {
  submissionId: string;
  seasonMemberId: string;
  notes?: string | null;
}) {
  const { error } = await supabase.rpc("associate_camp_submission_member", {
    p_submission_id: params.submissionId,
    p_season_member_id: params.seasonMemberId,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
}

export async function updateCampSubmissionActionReview(params: {
  actionId: string;
  challengeId?: string | null;
  otherDescription?: string | null;
  requestedPoints?: number | null;
  notes?: string | null;
}) {
  const { error } = await supabase.rpc("update_camp_submission_action_review", {
    p_action_id: params.actionId,
    p_challenge_id: params.challengeId ?? null,
    p_other_description: params.otherDescription ?? null,
    p_requested_points: params.requestedPoints ?? null,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
}

export async function reopenCampSubmissionAction(params: {
  actionId: string;
  notes?: string | null;
}) {
  const { error } = await supabase.rpc("reopen_camp_submission_action", {
    p_action_id: params.actionId,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
}

export async function reverseCampPoints(params: { ledgerId: string; reason: string }) {
  const { error } = await supabase.rpc("reverse_camp_point_entry", {
    p_ledger_id: params.ledgerId,
    p_reason: params.reason,
  });
  if (error) throw error;
}
