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
  metadata?: Record<string, unknown> | null;
};

export type CampSeasonPatch = Partial<Pick<
  CampSeason,
  "name" | "description" | "starts_at" | "ends_at" | "status" | "is_visible" | "metadata"
>>;

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
  metadata?: Record<string, unknown> | null;
  week_number?: number | null;
  theme?: string | null;
  icon?: string | null;
  cta_label?: string | null;
  submission_type?: string | null;
  verification_method?: string | null;
  badge_eligible?: boolean | null;
  why_it_matters?: string | null;
  related_kind?: string | null;
  related_url?: string | null;
  is_featured?: boolean | null;
  action_type_slug?: string | null;
  action_type_label?: string | null;
  season_slug?: string;
  season_name?: string;
};

export type ChallengePublishState = "draft" | "scheduled" | "active" | "paused" | "archived";

export type ModerationQueueItem = {
  id: string;
  queue: "posts" | "comments" | "listings" | "reports";
  title: string;
  body: string | null;
  author_id: string | null;
  author_label: string | null;
  content_id: string;
  related_id?: string | null;
  status: string;
  reported_at: string;
  is_removed?: boolean | null;
  is_hidden?: boolean | null;
  reason?: string | null;
  history?: ModerationAuditRow[];
};

export type ModerationAuditRow = {
  id: string;
  moderator_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  created_at: string;
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

export type HubPointRule = {
  action_type: string;
  display_name: string;
  point_value: number;
  active: boolean;
  counts_for_ongoing: boolean;
  counts_for_season: boolean;
  counts_for_cabin: boolean;
  requires_approval: boolean;
  max_awards_per_user: number | null;
  season_override: string | null;
  season_override_id: string | null;
  lifetime_cap: number | null;
  daily_cap: number | null;
  duplicate_strategy: string;
  duplicate_policy: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
};

export type AdminPointMember = {
  profile_id: string;
  season_member_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_status: string | null;
  neon_account_id: string | null;
  ongoing_points: number;
  seasonal_points: number;
  cabin_points: number;
  cabin_id: string | null;
  cabin_name: string | null;
  season_id: string | null;
  result_rank: number;
};

export type AdminPointTransaction = {
  transaction_id: string;
  points: number;
  action_type: string | null;
  source: string | null;
  source_id: string | null;
  reason: string | null;
  admin_note: string | null;
  counts_for_ongoing: boolean;
  counts_for_season: boolean;
  counts_for_cabin: boolean;
  approval_status: string;
  season_id: string | null;
  season_member_id: string | null;
  challenge_id: string | null;
  challenge_title?: string | null;
  cabin_id: string | null;
  campaign_slug?: string | null;
  petition_slug?: string | null;
  rule_used?: string | null;
  occurred_at: string;
  created_at: string;
  awarded_by: string | null;
  reversed_by_transaction_id: string | null;
  reverses_transaction_id: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AdminAwardResult = {
  point_transaction_id: string | null;
  camp_ledger_id: string | null;
  duplicate: boolean;
  points: number;
  counts_for_ongoing: boolean;
  counts_for_season: boolean;
  counts_for_cabin: boolean;
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
  approval_status?: string;
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
    .select("id,slug,name,description,starts_at,ends_at,status,is_visible,point_rules,metadata")
    .eq("status", "active")
    .eq("is_visible", true)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CampSeason | null;
}

export async function updateCampSeasonContent(seasonId: string, patch: CampSeasonPatch) {
  const { data, error } = await supabase
    .from("gpe_seasons")
    .update(patch)
    .eq("id", seasonId)
    .select("id,slug,name,description,starts_at,ends_at,status,is_visible,point_rules,metadata")
    .single();
  if (error) throw error;
  return data as CampSeason;
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
    .order("week_number", { ascending: true, nullsFirst: false })
    .order("display_order", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw error;
  return (data || []).map((challenge) => ({
    ...challenge,
    action_url: canonicalCampActionUrl(challenge.action_url),
  })) as CampChallenge[];
}

export async function getAdminCampChallenges(seasonId: string) {
  const { data, error } = await supabase
    .from("gpe_challenges")
    .select("*")
    .eq("season_id", seasonId)
    .order("week_number", { ascending: true, nullsFirst: false })
    .order("display_order", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw error;
  return (data || []).map((challenge) => ({
    ...challenge,
    action_url: canonicalCampActionUrl(challenge.action_url),
  })) as CampChallenge[];
}

export async function getHubCampChallengeBySlug(seasonId: string, slug: string) {
  const { data, error } = await supabase
    .from("gpe_hub_camp_challenges")
    .select("*")
    .eq("season_id", seasonId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data
    ? ({
        ...data,
        action_url: canonicalCampActionUrl(data.action_url),
        related_url: canonicalCampActionUrl(data.related_url),
      } as CampChallenge)
    : null;
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
    .from("gpe_camp_recent_activity")
    .select("*")
    .eq("season_id", seasonId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    season_id: row.season_id,
    season_member_id: row.season_member_id,
    user_id: row.user_id,
    submission_id: null,
    submission_action_id: row.source_id,
    challenge_id: row.challenge_id,
    points: row.points,
    reason: row.challenge_title || row.reason,
    adjustment_type: "award",
    entry_type: "challenge_award",
    source: row.source,
    awarded_by: null,
    created_at: row.created_at,
    reversed_at: null,
    reversed_entry_id: null,
    reversal_reason: null,
    profiles: {
      username: row.username,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    },
    gpe_challenges: row.challenge_id
      ? {
          title: row.challenge_title,
          category: row.challenge_category,
        }
      : null,
  })) as CampRecentActivityRow[];
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

export async function searchPointMembers(params: {
  seasonId?: string | null;
  query: string;
  limit?: number;
}) {
  const { data, error } = await supabase.rpc("admin_search_point_members", {
    p_query: params.query,
    p_season_id: params.seasonId ?? null,
    p_limit: params.limit ?? 25,
  });
  if (error) throw error;
  return (data || []) as AdminPointMember[];
}

export async function getPointRules() {
  const { data, error } = await supabase
    .from("hub_point_rules")
    .select("action_type,display_name,point_value,active,counts_for_ongoing,counts_for_season,counts_for_cabin,requires_approval,max_awards_per_user,season_override,season_override_id,lifetime_cap,daily_cap,duplicate_strategy,duplicate_policy,notes,metadata")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return (data || []) as HubPointRule[];
}

export async function updatePointRule(actionType: string, patch: Partial<HubPointRule>) {
  const allowedPatch = Object.fromEntries(Object.entries({
    display_name: patch.display_name,
    point_value: patch.point_value,
    active: patch.active,
    counts_for_ongoing: patch.counts_for_ongoing,
    counts_for_season: patch.counts_for_season,
    counts_for_cabin: patch.counts_for_cabin,
    requires_approval: patch.requires_approval,
    lifetime_cap: patch.lifetime_cap,
    daily_cap: patch.daily_cap,
    duplicate_policy: patch.duplicate_policy,
    duplicate_strategy: patch.duplicate_strategy,
    season_override_id: patch.season_override_id,
    notes: patch.notes,
  }).filter(([, value]) => value !== undefined));
  const { data, error } = await supabase
    .from("hub_point_rules")
    .update(allowedPatch)
    .eq("action_type", actionType)
    .select("action_type,display_name,point_value,active,counts_for_ongoing,counts_for_season,counts_for_cabin,requires_approval,max_awards_per_user,season_override,season_override_id,lifetime_cap,daily_cap,duplicate_strategy,duplicate_policy,notes,metadata")
    .single();
  if (error) throw error;
  return data as HubPointRule;
}

export async function getAdminMemberPointHistory(params: {
  profileId: string;
  seasonId?: string | null;
  limit?: number;
}) {
  const { data, error } = await supabase.rpc("admin_get_member_point_history_v2", {
    p_profile_id: params.profileId,
    p_season_id: params.seasonId ?? null,
    p_limit: params.limit ?? 25,
  });
  if (error) throw error;
  return (data || []) as AdminPointTransaction[];
}

export async function awardManualPoints(params: {
  profileId: string;
  points: number;
  reason: string;
  actionType: string;
  adminNote?: string | null;
  seasonId?: string | null;
  challengeId?: string | null;
  cabinId?: string | null;
  occurredAt?: string | null;
  countsForOngoing: boolean;
  countsForSeason: boolean;
  countsForCabin: boolean;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("admin_award_manual_points", {
    p_profile_id: params.profileId,
    p_points: params.points,
    p_reason: params.reason,
    p_action_type: params.actionType,
    p_admin_note: params.adminNote ?? null,
    p_season_id: params.seasonId ?? null,
    p_challenge_id: params.challengeId ?? null,
    p_cabin_id: params.cabinId ?? null,
    p_occurred_at: params.occurredAt ?? new Date().toISOString(),
    p_counts_for_ongoing: params.countsForOngoing,
    p_counts_for_season: params.countsForSeason,
    p_counts_for_cabin: params.countsForCabin,
    p_idempotency_key: params.idempotencyKey,
  });
  if (error) throw error;
  return data as AdminAwardResult;
}

export async function reversePointTransaction(params: { transactionId: string; reason: string }) {
  const { data, error } = await supabase.rpc("admin_reverse_point_transaction", {
    p_transaction_id: params.transactionId,
    p_reason: params.reason,
  });
  if (error) throw error;
  return data as {
    reversal_transaction_id: string;
    reversal_ledger_id: string | null;
    reversed_transaction_id: string;
    points_reversed: number;
  };
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
  const { data, error } = await supabase.rpc("approve_camp_submission_action", {
    p_action_id: params.actionId,
    p_points: params.points ?? null,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
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

export async function updateCampChallengeContent(challengeId: string, patch: Partial<Pick<
  CampChallenge,
  | "title"
  | "slug"
  | "short_description"
  | "instructions"
  | "week_number"
  | "theme"
  | "point_value"
  | "starts_at"
  | "ends_at"
  | "action_url"
  | "related_url"
  | "cta_label"
  | "submission_type"
  | "verification_method"
  | "display_order"
  | "category"
  | "icon"
  | "why_it_matters"
  | "badge_eligible"
  | "auto_approve"
  | "requires_review"
  | "requires_proof"
  | "allow_multiple_submissions"
  | "max_completions_per_member"
  | "metadata"
  | "is_featured"
  | "is_active"
  | "is_hub_visible"
  | "is_public"
>>) {
  const { error } = await supabase
    .from("gpe_challenges")
    .update(patch)
    .eq("id", challengeId);
  if (error) throw error;
}

export async function duplicateCampChallenge(challenge: CampChallenge) {
  const copySlug = `${challenge.slug}-copy-${Date.now().toString(36)}`.slice(0, 120);
  const metadata = {
    ...(challenge.metadata || {}),
    duplicated_from: challenge.id,
    publish_state: "draft",
    history: [
      {
        editor: "Team GPE",
        timestamp: new Date().toISOString(),
        publish_state: "draft",
        changed_fields: ["duplicated_from"],
      },
      ...(
        Array.isArray(challenge.metadata?.history)
          ? (challenge.metadata.history as Array<Record<string, unknown>>)
          : []
      ),
    ].slice(0, 25),
  };
  const { data, error } = await supabase
    .from("gpe_challenges")
    .insert({
      season_id: challenge.season_id,
      action_type_id: challenge.action_type_id,
      slug: copySlug,
      title: `${challenge.title} Copy`,
      short_description: challenge.short_description,
      instructions: challenge.instructions,
      category: challenge.category,
      point_value: challenge.point_value,
      starts_at: null,
      ends_at: null,
      is_active: false,
      is_public: false,
      is_hub_visible: false,
      requires_proof: challenge.requires_proof,
      requires_review: challenge.requires_review,
      auto_approve: challenge.auto_approve,
      allow_multiple_submissions: challenge.allow_multiple_submissions,
      max_completions_per_member: challenge.max_completions_per_member,
      display_order: (challenge.display_order ?? 0) + 1,
      action_url: challenge.action_url,
      week_number: challenge.week_number,
      theme: challenge.theme,
      icon: challenge.icon,
      cta_label: challenge.cta_label,
      submission_type: challenge.submission_type,
      verification_method: challenge.verification_method,
      badge_eligible: challenge.badge_eligible,
      why_it_matters: challenge.why_it_matters,
      related_kind: challenge.related_kind,
      related_url: challenge.related_url,
      is_featured: false,
      metadata,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CampChallenge;
}

export async function updateCampChallengePublishState(challenge: CampChallenge, state: ChallengePublishState) {
  const metadata = {
    ...(challenge.metadata || {}),
    publish_state: state,
    history: [
      {
        editor: "Team GPE",
        timestamp: new Date().toISOString(),
        publish_state: state,
        changed_fields: ["publish_state"],
      },
      ...(
        Array.isArray(challenge.metadata?.history)
          ? (challenge.metadata.history as Array<Record<string, unknown>>)
          : []
      ),
    ].slice(0, 25),
  };
  const patch = {
    metadata,
    is_active: state === "active" || state === "scheduled",
    is_hub_visible: state === "active" || state === "scheduled",
    is_public: state === "active" || state === "scheduled",
    is_featured: state === "active",
  };
  await updateCampChallengeContent(challenge.id, patch);
}

export async function getModerationQueueItems() {
  const [{ data: posts, error: postsError }, { data: comments, error: commentsError }, { data: listings, error: listingsError }, { data: flags, error: flagsError }, { data: audit, error: auditError }] =
    await Promise.all([
      supabase
        .from("posts")
        .select("id,title,description,user_id,created_at,is_hidden,is_removed,moderation_status")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("post_comments")
        .select("id,post_id,user_id,content,created_at,is_hidden,is_removed,moderation_status")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("listings")
        .select("id,title,description,submitted_by,status,is_removed,is_hidden,moderation_status,created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("listing_flags")
        .select("id,listing_id,flagged_by,reason,flagged_at,resolved")
        .order("flagged_at", { ascending: false })
        .limit(25),
      supabase
        .from("moderation_audit_log")
        .select("id,moderator_id,action,target_type,target_id,reason,previous_state,new_state,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
  if (postsError) throw postsError;
  if (commentsError) throw commentsError;
  if (listingsError) throw listingsError;
  if (flagsError) throw flagsError;
  if (auditError) throw auditError;

  const auditRows = (audit || []) as ModerationAuditRow[];
  const historyFor = (targetType: string, targetId: string) =>
    auditRows.filter((row) => row.target_type === targetType && row.target_id === targetId).slice(0, 8);

  return [
    ...(posts || []).map((post) => ({
      id: `post:${post.id}`,
      queue: "posts" as const,
      title: post.title,
      body: post.description,
      author_id: post.user_id,
      author_label: post.user_id,
      content_id: post.id,
      status: post.is_removed ? "removed" : post.is_hidden ? "hidden" : post.moderation_status || "published",
      reported_at: post.created_at,
      is_removed: post.is_removed,
      is_hidden: post.is_hidden,
      history: historyFor("post", post.id),
    })),
    ...(comments || []).map((comment) => ({
      id: `comment:${comment.id}`,
      queue: "comments" as const,
      title: "Comment",
      body: comment.content,
      author_id: comment.user_id,
      author_label: comment.user_id,
      content_id: comment.id,
      related_id: comment.post_id,
      status: comment.is_removed ? "removed" : comment.is_hidden ? "hidden" : comment.moderation_status || "published",
      reported_at: comment.created_at,
      is_removed: comment.is_removed,
      is_hidden: comment.is_hidden,
      history: historyFor("comment", comment.id),
    })),
    ...(listings || []).map((listing) => ({
      id: `listing:${listing.id}`,
      queue: "listings" as const,
      title: listing.title,
      body: listing.description,
      author_id: listing.submitted_by,
      author_label: listing.submitted_by,
      content_id: listing.id,
      status: listing.is_removed ? "removed" : listing.is_hidden ? "hidden" : listing.moderation_status || listing.status,
      reported_at: listing.created_at,
      is_removed: listing.is_removed,
      is_hidden: listing.is_hidden,
      history: historyFor("listing", listing.id),
    })),
    ...(flags || []).map((flag) => ({
      id: `report:${flag.id}`,
      queue: "reports" as const,
      title: "Listing report",
      body: flag.reason,
      author_id: flag.flagged_by,
      author_label: flag.flagged_by,
      content_id: flag.id,
      related_id: flag.listing_id,
      status: flag.resolved ? "resolved" : "open",
      reported_at: flag.flagged_at,
      reason: flag.reason,
      history: historyFor("report", flag.id),
    })),
  ] as ModerationQueueItem[];
}

export async function applyModerationAction(params: {
  action: "hide" | "restore" | "remove" | "resolve" | "dismiss" | "warn_user" | "suspend_user" | "restore_user";
  targetType: "post" | "comment" | "listing" | "report" | "user";
  targetId: string;
  reason?: string | null;
}) {
  const { error } = await supabase.rpc("camp_admin_moderation_action", {
    p_action: params.action,
    p_target_type: params.targetType,
    p_target_id: params.targetId,
    p_reason: params.reason ?? null,
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
