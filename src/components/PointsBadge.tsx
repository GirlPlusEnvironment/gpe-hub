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
      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      aria-label="View leaderboard"
    >
      <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 hover:border-primary/40 transition-colors cursor-pointer">
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">
          {pointsData.totalPoints}
        </span>
      </div>
      <Badge className={`${getLevelColor(pointsData.level)} text-xs font-semibold`}>
        Lvl {pointsData.level}
      </Badge>
    </Link>
  );
}
