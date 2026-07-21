import { supabase } from "@/lib/supabaseClient";

export type CampSeason = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  is_visible: boolean;
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
  review_status: "pending" | "approved" | "rejected" | "needs_information" | "duplicate";
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
  contact_email: string;
  challenge_key: string;
  submitted_payload: { fields?: Record<string, unknown> } | null;
  proof_links: string[];
  review_status: "pending" | "approved" | "rejected" | "needs_info";
  reviewed_by: string | null;
  reviewed_at: string | null;
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

export async function getActiveCampSeason() {
  const { data, error } = await supabase
    .from("gpe_seasons")
    .select("id,slug,name,description,status,is_visible")
    .eq("slug", "camp-gpe-2026")
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

export async function getHubCampChallenges(seasonId: string) {
  const { data, error } = await supabase
    .from("gpe_hub_camp_challenges")
    .select("*")
    .eq("season_id", seasonId)
    .order("display_order", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw error;
  return (data || []) as CampChallenge[];
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

export async function reverseCampPoints(params: { ledgerId: string; reason: string }) {
  const { error } = await supabase.rpc("reverse_camp_point_entry", {
    p_ledger_id: params.ledgerId,
    p_reason: params.reason,
  });
  if (error) throw error;
}
