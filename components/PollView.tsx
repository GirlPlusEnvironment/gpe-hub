import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { votePoll } from "@/lib/posts";
import type { Post, PollOption } from "@/types/posts";
import { CheckCircle2 } from "lucide-react";

interface PollViewProps {
  post: Post;
  onVote?: () => void;
}

export function PollView({ post, onVote }: PollViewProps) {
  const { toast } = useToast();
  const [isVoting, setIsVoting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // Calculate total votes
  const totalVotes = post.poll_options?.reduce((acc, option) => acc + (option.votes_count || 0), 0) || 0;
  const hasVoted = !!post.user_vote_option_id;

  const handleVote = async () => {
    if (!selectedOption) return;
    
    setIsVoting(true);
    try {
      await votePoll(post.id, selectedOption);
      toast({
        title: "Vote recorded",
        description: "Thanks for voting!",
      });
      if (onVote) onVote();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record vote",
        variant: "destructive",
      });
    } finally {
      setIsVoting(false);
    }
  };

  if (!post.poll_options || post.poll_options.length === 0) {
    return null;
  }

  if (hasVoted) {
    // Results View
    return (
      <div className="space-y-3 mt-4">
        {post.poll_options.map((option) => {
          const voteCount = option.votes_count || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isUserChoice = post.user_vote_option_id === option.id;

          return (
            <div key={option.id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className={`font-medium ${isUserChoice ? "text-primary" : ""}`}>
                  {option.option_text}
                  {isUserChoice && <span className="ml-2 text-xs text-muted-foreground">(You voted)</span>}
                </span>
                <span className="text-muted-foreground">{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-2" />
              <div className="text-xs text-muted-foreground text-right">
                {voteCount} {voteCount === 1 ? "vote" : "votes"}
              </div>
            </div>
          );
        })}
        <div className="text-xs text-muted-foreground pt-2">
          Total votes: {totalVotes}
        </div>
      </div>
    );
  }

  // Voting View
  return (
    <div className="space-y-4 mt-4">
      <RadioGroup value={selectedOption || ""} onValueChange={setSelectedOption}>
        {post.poll_options.map((option) => (
          <div key={option.id} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedOption(option.id)}>
            <RadioGroupItem value={option.id} id={option.id} />
            <Label htmlFor={option.id} className="flex-1 cursor-pointer font-normal">
              {option.option_text}
            </Label>
          </div>
        ))}
      </RadioGroup>
      <Button 
        onClick={handleVote} 
        disabled={!selectedOption || isVoting}
        className="w-full"
      >
        {isVoting ? "Submitting..." : "Vote"}
      </Button>
    </div>
  );
}
