import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Award, Zap, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { getLeaderboard } from "@/lib/points";
import { UserProfileCard } from "@/components/UserProfileCard";

type TimeRange = "all" | "7d" | "30d";

interface LeaderboardUser {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar?: string;
  points: number;
  level: number;
  rank: number;
}

const LEVELS = [
  { level: 1, threshold: 0, color: "bg-gray-200" },
  { level: 2, threshold: 100, color: "bg-blue-200" },
  { level: 3, threshold: 500, color: "bg-green-200" },
  { level: 4, threshold: 1000, color: "bg-purple-200" },
  { level: 5, threshold: 2000, color: "bg-amber-300" },
];

const Leaderboard = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getLeaderboard(timeRange, 10);
        setLeaderboard(data);
      } catch (err) {
        console.error("Failed to fetch leaderboard", err);
        setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [timeRange]);

  const getRankMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-amber-500" />;
      case 2:
        return <Trophy className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Trophy className="h-5 w-5 text-amber-600" />;
      default:
        return <Award className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getLevelColor = (level: number) => {
    const lvl = LEVELS.find(l => l.level === level) ?? LEVELS[0];
    return lvl.color;
  };

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    setIsProfileOpen(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Zap className="h-8 w-8 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold text-primary">Community Leaderboard</h1>
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Celebrate our most engaged community members. Earn points by participating, contributing, and connecting!
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="flex justify-center gap-3 mb-8 flex-wrap">
            {(["all", "30d", "7d"] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                onClick={() => setTimeRange(range)}
                className="uppercase tracking-wide"
              >
                {range === "all" ? "All Time" : range === "7d" ? "This Week" : "This Month"}
              </Button>
            ))}
          </div>

          {/* Leaderboard Table */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-xl">Top Contributors</CardTitle>
              <CardDescription>
                {timeRange === "all" && "All-time points"}
                {timeRange === "7d" && "Points earned in the last 7 days"}
                {timeRange === "30d" && "Points earned in the last 30 days"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-destructive mb-2">Failed to load leaderboard</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No users found for this time period.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-input hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleUserClick(user.id)}
                    >
                      {/* Rank and User Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Rank Medal */}
                        <div className="flex items-center justify-center w-8 text-center">
                          {user.rank <= 3 ? (
                            getRankMedal(user.rank)
                          ) : (
                            <span className="font-semibold text-muted-foreground">#{user.rank}</span>
                          )}
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                          <AvatarImage src={user.avatar || ""} />
                          <AvatarFallback className="bg-primary/10">
                            {user.full_name?.charAt(0) || user.username?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground truncate">
                              {user.full_name || user.username || "Unknown"}
                            </span>
                            <Badge
                              className={`${getLevelColor(user.level)} text-foreground text-xs font-semibold`}
                            >
                              Level {user.level}
                            </Badge>
                          </div>
                          {user.username && user.username !== user.full_name && (
                            <div className="text-sm text-muted-foreground mt-0.5">
                              @{user.username}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Points Display */}
                      <div className="text-right ml-4">
                        <div className="text-2xl font-bold text-primary">
                          {user.points}
                        </div>
                        <div className="text-xs text-muted-foreground">pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Level Info Card */}
          <Card className="mt-8 border-2">
            <CardHeader>
              <CardTitle className="text-lg">Level Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {LEVELS.map((lvl) => (
                  <div key={lvl.level} className="text-center p-4 rounded-lg border border-input">
                    <div className={`w-12 h-12 rounded-full ${lvl.color} mx-auto mb-3 flex items-center justify-center font-bold text-lg`}>
                      {lvl.level}
                    </div>
                    <div className="font-semibold text-foreground">Level {lvl.level}</div>
                    <div className="text-sm text-muted-foreground mt-2">
                      {lvl.threshold.toLocaleString()}+ pts
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* How to Earn Points */}
          <Card className="mt-8 border-2">
            <CardHeader>
              <CardTitle className="text-lg">How to Earn Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge className="mt-1 bg-primary text-primary-foreground">+1</Badge>
                    <div>
                      <div className="font-medium">Like a Post</div>
                      <div className="text-sm text-muted-foreground">Appreciate community content</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge className="mt-1 bg-primary text-primary-foreground">+1</Badge>
                    <div>
                      <div className="font-medium">Favorite a Listing</div>
                      <div className="text-sm text-muted-foreground">Save listings you're interested in</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge className="mt-1 bg-primary text-primary-foreground">+2</Badge>
                    <div>
                      <div className="font-medium">Leave a Comment</div>
                      <div className="text-sm text-muted-foreground">Share your thoughts and insights</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge className="mt-1 bg-primary text-primary-foreground">+10</Badge>
                    <div>
                      <div className="font-medium">Create a Post</div>
                      <div className="text-sm text-muted-foreground">Contribute new discussions</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge className="mt-1 bg-primary text-primary-foreground">+3</Badge>
                    <div>
                      <div className="font-medium">Make a Submission</div>
                      <div className="text-sm text-muted-foreground">Create a listing on the explore page</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge className="mt-1 bg-primary text-primary-foreground">+1</Badge>
                    <div>
                      <div className="font-medium">Send Messages</div>
                      <div className="text-sm text-muted-foreground">Talk with other members of the hub</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-12 text-center">
            <Link to="/" className="text-primary hover:text-primary/80 underline">
              Back to Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />

      {/* User Profile Card Modal */}
      {selectedUserId && (
        <UserProfileCard
          userId={selectedUserId}
          open={isProfileOpen}
          onOpenChange={setIsProfileOpen}
        />
      )}
    </div>
  );
};

export default Leaderboard;
