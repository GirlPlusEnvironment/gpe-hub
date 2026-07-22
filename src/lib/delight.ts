export type SeasonalTheme = "summer_camp" | "back_to_school" | "earth_month" | "spring" | "holiday_giving";

export type DelightContext = {
  pointsToNext?: number;
  cabinName?: string | null;
  pendingSubmissions?: number;
  activeChallenges?: number;
  now?: Date;
};

export const seasonalThemes: Record<SeasonalTheme, {
  label: string;
  heroAccent: "pink" | "cyan" | "yellow" | "orange";
  illustration: "backpack" | "badge" | "campfire" | "flag" | "leaf" | "notebook" | "planet" | "sun";
  sticker: string;
}> = {
  summer_camp: {
    label: "Summer Camp",
    heroAccent: "yellow",
    illustration: "campfire",
    sticker: "Camp energy",
  },
  back_to_school: {
    label: "Back to School",
    heroAccent: "cyan",
    illustration: "notebook",
    sticker: "New notebook",
  },
  earth_month: {
    label: "Earth Month",
    heroAccent: "orange",
    illustration: "planet",
    sticker: "Planet mode",
  },
  spring: {
    label: "Spring",
    heroAccent: "pink",
    illustration: "leaf",
    sticker: "Fresh start",
  },
  holiday_giving: {
    label: "Holiday Giving",
    heroAccent: "yellow",
    illustration: "badge",
    sticker: "Give joy",
  },
};

const morningMessages = [
  "Good morning, camper. Your next tiny climate win is waiting.",
  "Morning mission board is open. Pick one action and make it count.",
  "Fresh day, fresh points, fresh community momentum.",
];

const afternoonMessages = [
  "Ready for your next challenge?",
  "Your cabin can still climb today.",
  "Small action, real impact. Choose your next move.",
];

const eveningMessages = [
  "Welcome back. Your cabin missed you.",
  "Evening check-in: one more action can still move the board.",
  "Wind down with one tiny win for the planet.",
];

function stablePick(messages: string[], seed: number) {
  return messages[Math.abs(seed) % messages.length];
}

export function getTimeOfDayGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return stablePick(morningMessages, now.getDate());
  if (hour < 17) return stablePick(afternoonMessages, now.getDate() + now.getMonth());
  return stablePick(eveningMessages, now.getDate() + now.getHours());
}

export function getEncouragementMessage({
  pointsToNext,
  cabinName,
  pendingSubmissions = 0,
  activeChallenges = 0,
  now = new Date(),
}: DelightContext) {
  const messages = [
    typeof pointsToNext === "number" && pointsToNext > 0
      ? `You're only ${pointsToNext.toLocaleString()} points from leveling up.`
      : "You're building a real climate action streak.",
    cabinName ? `${cabinName} is lucky to have you on the board.` : "Join a cabin when you are ready to compete together.",
    pendingSubmissions > 0
      ? `${pendingSubmissions} submission${pendingSubmissions === 1 ? "" : "s"} waiting for Team GPE review.`
      : "No pending reviews right now. Your next action can change that.",
    activeChallenges > 0
      ? `${activeChallenges} active challenge${activeChallenges === 1 ? "" : "s"} on the mission board.`
      : "The mission board is ready for the next season update.",
  ];

  return stablePick(messages, now.getDate() + now.getHours());
}

export function shouldCelebrate(previous?: number | null, next?: number | null) {
  return typeof previous === "number" && typeof next === "number" && next > previous;
}
