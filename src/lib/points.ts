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
    // 1. Check today's points earned from point_transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = tomorrow.toISOString();
  
    const { data: todayTransactions, error: todayError } = await supabase
      .from("point_transactions")
      .select("points_earned")
      .eq("user_id", userId)
      .eq("counts_for_ongoing", true)
      .eq("approval_status", "approved")
      .gte("created_at", todayStart)
      .lt("created_at", tomorrowStart);
  
    if (todayError) {
      console.error("Failed to get today's points", todayError);
      throw todayError;
    }
  
    // Calculate points earned today (only positive points count toward limit)
    const pointsEarnedToday = (todayTransactions || [])
      .filter(t => t.points_earned > 0)
      .reduce((sum, t) => sum + t.points_earned, 0);
  
    // 2. Calculate how many points we can actually award (respecting daily limit)
    const remainingDailyCapacity = Math.max(0, dailyLimit - pointsEarnedToday);
    const pointsToAward = Math.min(points, remainingDailyCapacity);
  
    if (pointsToAward === 0) {
      return { 
        success: false, 
        message: "Daily points limit reached",
        pointsAwarded: 0,
        pointsRequested: points
      };
    }
  
    // 3. Update profiles.points atomically
    const { error: updateError } = await supabase.rpc('increment_user_points', {
      user_id_param: userId,
      points_to_add: pointsToAward
    });
  
    // If RPC doesn't exist, use update with increment
    if (updateError) {
      // Fallback: Get current points and update
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();
  
      if (fetchError) {
        console.error("Failed to fetch user profile", fetchError);
        throw fetchError;
      }
  
      const newTotalPoints = (profile?.points || 0) + pointsToAward;
  
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ points: newTotalPoints })
        .eq("id", userId);
  
      if (updateProfileError) {
        console.error("Failed to update user points", updateProfileError);
        throw updateProfileError;
      }
    }
  
    // 4. Insert transaction record
    const { error: transactionError } = await supabase
      .from("point_transactions")
      .insert({ 
        user_id: userId, 
        points_earned: pointsToAward,
        created_at: new Date().toISOString(),
        occurred_at: new Date().toISOString(),
        action_type: options.actionType || options.source || "hub_action",
        source: options.source || null,
        source_id: options.sourceId || null,
        metadata: options.metadata || {},
        counts_for_ongoing: true,
        counts_for_season: false,
        counts_for_cabin: false,
        approval_status: "approved"
      })
      .select()
      .single();
  
    if (transactionError) {
      console.error("Failed to insert points transaction", transactionError);
      throw transactionError;
    }
  
    return { 
      success: true, 
      pointsAwarded: pointsToAward,
      pointsRequested: points,
      dailyLimitReached: pointsToAward < points
    };
}

export async function deductPoints(userId: string, points: number) {

    // 1. Get current points to ensure we don't go below 0
    const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();

    if (fetchError) {
        console.error("Failed to fetch user profile", fetchError);
        throw fetchError;
    }

    const newTotalPoints = Math.max(0, profile?.points - points);
    const pointsToDeduct = profile?.points - newTotalPoints;

    // 2. Update profiles.points atomically
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ points: newTotalPoints })
      .eq("id", userId);
  
    if (updateError) {
      console.error("Failed to update user points", updateError);
      throw updateError;
    }
  
    // 3. Insert transaction record (negative points)
    const { error: transactionError } = await supabase
    .from("point_transactions")
    .insert({ 
        user_id: userId, 
        points_earned: -pointsToDeduct, // Store as negative
        created_at: new Date().toISOString(),
        occurred_at: new Date().toISOString(),
        action_type: "hub_point_deduction",
        counts_for_ongoing: true,
        counts_for_season: false,
        counts_for_cabin: false,
        approval_status: "approved",
        metadata: {}
    })
    .select()
    .single();

    if (transactionError) {
    console.error("Failed to insert points transaction", transactionError);
    throw transactionError;
    }

    return { 
        success: true, 
        pointsDeducted: pointsToDeduct,
        pointsRequested: points,
        newTotalPoints: newTotalPoints
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
