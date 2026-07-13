import { Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useUserPoints } from "@/hooks/useUserPoints";
import { Badge } from "@/components/ui/badge";

export function PointsBadge() {
  const { pointsData, isLoading } = useUserPoints();

  if (isLoading || !pointsData) {
    return null;
  }

  const getLevelColor = (level: number) => {
    switch (level) {
      case 5:
        return "bg-amber-300 text-amber-900";
      case 4:
        return "bg-purple-300 text-purple-900";
      case 3:
        return "bg-green-300 text-green-900";
      case 2:
        return "bg-blue-300 text-blue-900";
      default:
        return "bg-gray-300 text-gray-900";
    }
  };

  return (
    <Link 
      to="/leaderboard" 
      className="flex min-w-0 items-center gap-1.5 transition-opacity hover:opacity-80 sm:gap-2"
      aria-label="View leaderboard"
    >
      <div className="flex min-w-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1.5 transition-colors hover:border-primary/40 sm:px-3">
        <Zap className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
        <span className="min-w-0 text-xs font-semibold text-primary sm:text-sm">
          {pointsData.totalPoints}
        </span>
      </div>
      <Badge className={`${getLevelColor(pointsData.level)} px-2 text-[10px] font-semibold sm:px-3 sm:text-xs`}>
        Lvl {pointsData.level}
      </Badge>
    </Link>
  );
}
