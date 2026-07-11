import { supabase } from "./supabaseClient";

export async function awardPoints(userId: string, points: number, dailyLimit: number = 100) {
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
        created_at: new Date().toISOString()
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
        created_at: new Date().toISOString()
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
    const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();

    if (fetchError) {
        console.error("Failed to fetch user profile", fetchError);
        throw fetchError;
    }

    return profile?.points || 0;
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
    if (timeRange === 'all') {
        // Query profiles directly for all-time leaderboard
        const { data: leaderboard, error: fetchError } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, points")
            .order("points", { ascending: false })
            .limit(limit);

        if (fetchError) {
            console.error("Failed to fetch leaderboard", fetchError);
            throw fetchError;
        }

        // Add rank and level
        return (leaderboard || []).map((user, index) => ({
            id: user.id,
            username: user.username || null,
            full_name: user.full_name || null,
            avatar: user.avatar_url || undefined,
            points: user.points || 0,
            level: calculateLevel(user.points || 0),
            rank: index + 1
        }));
    } else {
        // For time-based leaderboards, aggregate transactions and join with profiles
        const daysAgo = timeRange === '7d' ? 7 : 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
        const cutoffISO = cutoffDate.toISOString();

        // Get all transactions in the time range
        const { data: transactions, error: transError } = await supabase
            .from("point_transactions")
            .select("user_id, points_earned")
            .gte("created_at", cutoffISO);

        if (transError) {
            console.error("Failed to fetch transactions", transError);
            throw transError;
        }

        // Aggregate points by user_id
        const userPointsMap = new Map<string, number>();
        (transactions || []).forEach(t => {
            const current = userPointsMap.get(t.user_id) || 0;
            userPointsMap.set(t.user_id, current + t.points_earned);
        });

        // Get top users by points
        const topUserIds = Array.from(userPointsMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([userId]) => userId);

        if (topUserIds.length === 0) {
            return [];
        }

        // Fetch profile data for top users
        const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", topUserIds);

        if (profileError) {
            console.error("Failed to fetch profiles", profileError);
            throw profileError;
        }

        // Combine and sort, maintaining the order from topUserIds
        const leaderboard = topUserIds.map((userId, index) => {
            const profile = profiles?.find(p => p.id === userId);
            const points = userPointsMap.get(userId) || 0;
            
            return {
                id: userId,
                username: profile?.username || null,
                full_name: profile?.full_name || null,
                avatar: profile?.avatar_url || undefined,
                points: points,
                level: calculateLevel(points),
                rank: index + 1
            };
        });

        return leaderboard;
    }
}