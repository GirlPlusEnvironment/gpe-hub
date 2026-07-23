import { supabase } from "./supabaseClient";

type AwardPointOptions = {
  actionType?: string;
  source?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
};

export async function awardPoints(
  userId: string,
  points: number,
  dailyLimit: number = 100,
  options: AwardPointOptions = {}
) {
  console.warn("Client-side point awarding is disabled; awards must be created by server-side RPCs or triggers.", {
    userId,
    points,
    dailyLimit,
    actionType: options.actionType,
    source: options.source,
    sourceId: options.sourceId,
  });

  return {
    success: false,
    message: "Client-side point awarding is disabled.",
    pointsAwarded: 0,
    pointsRequested: points,
    dailyLimitReached: false,
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
