import { supabase } from "./supabaseClient";

type AwardPointOptions = {
  actionType?: string;
  source?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
};

export type AwardPointReason =
  | "awarded"
  | "duplicate_source"
  | "daily_cap"
  | "inactive_membership"
  | "inactive_rule"
  | "missing_source_id"
  | "rpc_error"
  | "unknown";

export type AwardPointResult = {
  success: boolean;
  message: string;
  reason: AwardPointReason;
  pointsAwarded: number;
  pointsRequested: number;
  dailyLimitReached: boolean;
  transactionId: string | null;
};

const ACTION_TYPE_ALIASES: Record<string, string> = {
  message_send: "hub_message",
};

const EXPECTED_ACTION_TYPES = new Set([
  "hub_post",
  "hub_comment",
  "hub_post_like",
  "hub_poll_vote",
  "hub_message",
  "listing_favorite",
]);

export function pointAwardToastCopy(result: AwardPointResult, label = "points") {
  if (result.success) {
    return {
      title: "Points awarded",
      description: `+${result.pointsAwarded} ${label}`,
      variant: undefined as undefined | "destructive",
    };
  }

  if (result.reason === "duplicate_source") {
    return {
      title: "Already awarded",
      description: "This action was already counted, so points were not added again.",
      variant: undefined as undefined | "destructive",
    };
  }

  if (result.reason === "daily_cap") {
    return {
      title: "Daily point cap reached",
      description: "The action was saved, but today's point limit for this activity has been reached.",
      variant: undefined as undefined | "destructive",
    };
  }

  if (result.reason === "inactive_membership") {
    return {
      title: "Points not awarded",
      description: "This action was saved, but active membership is required to earn points.",
      variant: "destructive" as const,
    };
  }

  if (result.reason === "inactive_rule") {
    return {
      title: "Point rule unavailable",
      description: "This action was saved, but the matching point rule is missing, disabled, or requires review.",
      variant: "destructive" as const,
    };
  }

  return {
    title: "Point award failed",
    description: result.message || "This action was saved, but points could not be awarded.",
    variant: "destructive" as const,
  };
}

function normalizeActionType(actionType: string | undefined, source: string | undefined) {
  const value = actionType || source || "manual_member_action";
  return ACTION_TYPE_ALIASES[value] || value;
}

function metadataSourceId(metadata: Record<string, unknown> | undefined) {
  const candidates = [
    metadata?.listing_id,
    metadata?.post_id,
    metadata?.comment_id,
    metadata?.message_id,
    metadata?.option_id,
  ];
  return candidates.find((value): value is string => typeof value === "string" && value.length > 0) || null;
}

export async function awardPoints(
  userId: string,
  points: number,
  dailyLimit: number = 100,
  options: AwardPointOptions = {}
): Promise<AwardPointResult> {
  const sourceId = options.sourceId || metadataSourceId(options.metadata);
  const actionType = normalizeActionType(options.actionType, options.source);
  if (!sourceId) {
    console.error("Point award failed", {
      userId,
      points,
      dailyLimit,
      actionType,
      source: options.source,
      reason: "missing_source_id",
    });
    return {
      success: false,
      message: "Point award requires a source id.",
      reason: "missing_source_id",
      pointsAwarded: 0,
      pointsRequested: points,
      dailyLimitReached: false,
      transactionId: null,
    };
  }

  if (!EXPECTED_ACTION_TYPES.has(actionType)) {
    console.warn("Point award is using an unexpected action key.", {
      actionType,
      source: options.source,
      sourceId,
      expected: Array.from(EXPECTED_ACTION_TYPES),
    });
  }

  const { data, error } = await supabase.rpc("award_hub_action_points", {
    p_action_type: actionType,
    p_source: options.source || actionType,
    p_source_id: sourceId,
    p_metadata: {
      ...options.metadata,
      requested_points: points,
      daily_limit: dailyLimit,
      requested_user_id: userId,
    },
  });

  if (error) {
    console.error("Point award failed", {
      actionType,
      source: options.source || actionType,
      sourceId,
      data,
      error,
    });
    throw error;
  }

  const result = (data || {}) as {
    ok?: boolean;
    awarded?: boolean;
    points?: number;
    reason?: string;
    transaction_id?: string;
  };
  const reason = (result.awarded ? "awarded" : result.reason || "unknown") as AwardPointReason;

  if (!result.awarded) {
    const logPayload = {
      actionType,
      source: options.source || actionType,
      sourceId,
      data,
      error,
      reason,
    };
    if (reason === "inactive_membership" || reason === "inactive_rule" || reason === "unknown") {
      console.error("Point award failed", logPayload);
    } else {
      console.info("Point award skipped", logPayload);
    }
  }

  return {
    success: Boolean(result.awarded),
    message: result.reason || (result.awarded ? "Points awarded." : "No points awarded."),
    reason,
    pointsAwarded: result.awarded ? result.points || points : 0,
    pointsRequested: points,
    dailyLimitReached: result.reason === "daily_cap",
    transactionId: result.transaction_id || null,
  };
}

export async function deductPoints(userId: string, points: number) {
  console.warn("Client-side point deduction is disabled; use admin reversal RPCs instead.", { userId, points });

  return {
    success: false,
    pointsDeducted: 0,
    pointsRequested: points,
    newTotalPoints: null,
  };
}

export async function getUserPoints(userId: string) {
    const { data: transactions, error: fetchError } = await supabase
        .from("point_transactions")
        .select("points_earned")
        .eq("user_id", userId)
        .eq("counts_for_ongoing", true)
        .eq("approval_status", "approved");

    if (fetchError) {
        console.error("Failed to fetch user points", fetchError);
        throw fetchError;
    }

    return (transactions || []).reduce((sum, transaction) => sum + (transaction.points_earned || 0), 0);
}

// Helper function to calculate level from points
function calculateLevel(points: number): number {
  if (points >= 2000) return 5;
  if (points >= 1000) return 4;
  if (points >= 500) return 3;
  if (points >= 100) return 2;
  return 1;
}

export async function getLeaderboard(timeRange: 'all' | '7d' | '30d', limit: number = 10) {
    const days = timeRange === "all" ? null : timeRange === "7d" ? 7 : 30;
    const { data: leaderboard, error: fetchError } = await supabase.rpc("get_ongoing_member_leaderboard", {
        p_days: days,
        p_limit: limit,
    });

    if (fetchError) {
        console.error("Failed to fetch leaderboard", fetchError);
        throw fetchError;
    }

    return (leaderboard || []).map((user) => ({
        id: user.user_id,
        username: user.username || null,
        full_name: user.full_name || null,
        avatar: user.avatar_url || undefined,
        points: user.points || 0,
        level: calculateLevel(user.points || 0),
        rank: user.rank || 0
    }));
}
