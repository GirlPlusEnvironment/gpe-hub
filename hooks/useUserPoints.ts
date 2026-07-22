import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

interface UserPointsData {
  totalPoints: number;
  level: number;
}

export function useUserPoints() {
  const { user, profile } = useAuth();
  
  // Use profile points directly - they update when profile refreshes
  const pointsData: UserPointsData | null = useMemo(() => {
    if (!user || !profile) {
      return null;
    }
    
    const totalPoints = profile.points ?? 0;
    const level = calculateLevel(totalPoints);
    
    return { totalPoints, level };
  }, [user, profile]);

  const isLoading = !profile && !!user;

  return { pointsData, isLoading, error: null };
}

export function calculateLevel(totalPoints: number): number {
  if (totalPoints >= 2000) return 5;
  if (totalPoints >= 1000) return 4;
  if (totalPoints >= 500) return 3;
  if (totalPoints >= 100) return 2;
  return 1;
}
