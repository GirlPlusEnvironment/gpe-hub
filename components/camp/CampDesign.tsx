import type { ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  Backpack,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Flag,
  Gift,
  Leaf,
  Lock,
  Megaphone,
  NotebookTabs,
  Package,
  Recycle,
  Sparkles,
  Star,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type Accent = "pink" | "cyan" | "yellow" | "orange" | "black" | "white";

const accentClasses: Record<Accent, string> = {
  pink: "bg-gpe-pink text-white",
  cyan: "bg-gpe-cyan text-black",
  yellow: "bg-gpe-yellow text-black",
  orange: "bg-gpe-orange text-black",
  black: "bg-black text-white",
  white: "bg-white text-black",
};

const progressClasses: Record<Accent, string> = {
  pink: "bg-gpe-pink",
  cyan: "bg-gpe-cyan",
  yellow: "bg-gpe-yellow",
  orange: "bg-gpe-orange",
  black: "bg-black",
  white: "bg-white",
};

export function Sticker({
  accent = "white",
  children,
  className,
  rotate = "left",
}: {
  accent?: Accent;
  children: ReactNode;
  className?: string;
  rotate?: "left" | "right" | "none";
}) {
  return (
    <span
      className={cn(
        "gpe-sticker",
        accentClasses[accent],
        rotate === "left" && "-rotate-2",
        rotate === "right" && "rotate-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Tape({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("gpe-tape", className)}>{children}</span>;
}

export function DoodleStar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "gpe-border shadow-gpe-sm inline-flex h-14 w-14 rotate-6 items-center justify-center rounded-[1.25rem] bg-gpe-yellow",
        className,
      )}
    >
      <Star className="h-7 w-7 fill-black" />
    </span>
  );
}

export function CampIllustration({
  type = "flag",
  className,
}: {
  type?: "backpack" | "badge" | "campfire" | "clipboard" | "compass" | "flag" | "leaf" | "megaphone" | "merch" | "notebook" | "planet" | "recycle" | "sun" | "tent" | "trail";
  className?: string;
}) {
  const iconClass = "h-12 w-12";
  const Icon =
    type === "backpack" ? Backpack :
    type === "badge" ? Award :
    type === "clipboard" ? BadgeCheck :
    type === "compass" ? Compass :
    type === "flag" ? Flag :
    type === "leaf" ? Leaf :
    type === "megaphone" ? Megaphone :
    type === "merch" ? Gift :
    type === "notebook" ? NotebookTabs :
    type === "planet" ? Package :
    type === "recycle" ? Recycle :
    type === "sun" ? Sparkles :
    type === "campfire" ? Flame :
    type === "trail" ? ChevronRight :
    type === "tent" ? Users :
    Trophy;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "gpe-border shadow-gpe-sm mx-auto flex h-24 w-24 rotate-2 items-center justify-center rounded-[2rem] bg-gpe-yellow",
        className,
      )}
    >
      <Icon className={iconClass} />
    </div>
  );
}

export function CelebrationBurst({
  label = "Nice work",
  active = false,
  className,
}: {
  label?: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute right-4 top-4 z-10 rounded-full border-[3px] border-black bg-gpe-yellow px-4 py-2 text-xs font-black uppercase shadow-gpe-sm",
        active ? "gpe-celebrate" : "opacity-0",
        className,
      )}
    >
      {label}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-3">{eyebrow}</div> : null}
        <h1 className="gpe-heading text-4xl leading-[0.95] md:text-6xl">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-sm font-bold text-black/70 md:text-base">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  illustration = "flag",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  illustration?: Parameters<typeof CampIllustration>[0]["type"];
  className?: string;
}) {
  return (
    <div className={cn("gpe-card gpe-paper p-8 text-center md:p-10", className)}>
      <CampIllustration type={illustration} />
      <h2 className="mt-5 font-header text-3xl uppercase leading-none">{title}</h2>
      {description ? <p className="mx-auto mt-3 max-w-xl text-sm font-bold text-black/65">{description}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function LoadingCampCard({ label = "Loading" }: { label?: ReactNode }) {
  return (
    <div className="gpe-card gpe-paper animate-pulse p-6">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-[1.25rem] border-[3px] border-black bg-gpe-cyan" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-2/3 rounded-full bg-black/15" />
          <div className="h-4 w-1/2 rounded-full bg-black/10" />
        </div>
      </div>
      <div className="mt-6 h-4 w-full rounded-full bg-black/10" />
      <div className="mt-3 h-4 w-4/5 rounded-full bg-black/10" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function CampButton({ className, variant = "default", ...props }: ButtonProps) {
  return <Button variant={variant} className={cn("gpe-press", className)} {...props} />;
}

export function StatSticker({
  label,
  value,
  icon,
  accent = "white",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <div className={cn("gpe-card-sm relative overflow-hidden p-5", accentClasses[accent], className)}>
      <div className="absolute -right-3 -top-3 opacity-20">{icon || <Sparkles className="h-16 w-16" />}</div>
      <div className="relative">
        <div className="font-header text-4xl uppercase leading-none">{value}</div>
        <div className="mt-2 text-xs font-black uppercase">{label}</div>
      </div>
    </div>
  );
}

export function CampProgress({
  label,
  value,
  max = 100,
  accent = "pink",
  detail,
}: {
  label: ReactNode;
  value: number;
  max?: number;
  accent?: Accent;
  detail?: ReactNode;
}) {
  const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black uppercase">
        <span>{label}</span>
        <span>{detail || `${percent}%`}</span>
      </div>
      <Progress value={percent} className="h-6 border-[3px] border-black bg-white" indicatorClassName={progressClasses[accent]} />
    </div>
  );
}

export function CabinCard({
  name,
  score,
  members,
  description,
  accent = "cyan",
  progress = 0,
  action,
  leader,
  icon,
  recentActivity,
  topContributors,
}: {
  name: ReactNode;
  score?: ReactNode;
  members?: ReactNode;
  description?: ReactNode;
  accent?: Accent;
  progress?: number;
  action?: ReactNode;
  leader?: ReactNode;
  icon?: ReactNode;
  recentActivity?: ReactNode;
  topContributors?: ReactNode;
}) {
  return (
    <article className={cn("gpe-card gpe-hover-lift p-6", accentClasses[accent])}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="font-header text-2xl uppercase leading-none">{name}</div>
          {description ? <p className="mt-2 text-sm font-bold opacity-80">{description}</p> : null}
        </div>
        <div className="gpe-border flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-white text-black">
          {icon || <Users className="h-7 w-7" />}
        </div>
      </div>
      <CampProgress label="Cabin progress" value={progress} accent={accent === "black" ? "white" : "black"} />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs font-black uppercase">
        <span>{score || "0 pts"}</span>
        <span>{members || "Members pending"}</span>
      </div>
      {leader || topContributors || recentActivity ? (
        <div className="mt-5 space-y-2 rounded-[1.25rem] border-[3px] border-black bg-white/80 p-3 text-xs font-black uppercase text-black">
          {leader ? <div className="flex justify-between gap-3"><span>Leader</span><span>{leader}</span></div> : null}
          {topContributors ? <div className="flex justify-between gap-3"><span>Top</span><span>{topContributors}</span></div> : null}
          {recentActivity ? <div className="flex justify-between gap-3"><span>Latest</span><span>{recentActivity}</span></div> : null}
        </div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </article>
  );
}

export function ChallengeCard({
  title,
  description,
  points,
  category,
  status,
  deadline,
  difficulty,
  estimatedTime,
  progress,
  action,
  accent = "white",
  selected,
  disabled,
  onToggle,
}: {
  title: ReactNode;
  description?: ReactNode;
  points?: ReactNode;
  category?: ReactNode;
  status?: ReactNode;
  deadline?: ReactNode;
  difficulty?: ReactNode;
  estimatedTime?: ReactNode;
  progress?: number;
  action?: ReactNode;
  accent?: Accent;
  selected?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  const Wrapper = onToggle ? "button" : "article";
  return (
    <Wrapper
      type={onToggle ? "button" : undefined}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "gpe-card gpe-hover-lift block w-full p-5 text-left disabled:pointer-events-none disabled:opacity-60",
        accentClasses[accent],
        selected && "ring-4 ring-black ring-offset-4 ring-offset-[#fbd3d3]",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <Sticker accent={selected ? "black" : "yellow"} rotate="none" className="px-3 py-1 text-[10px]">
          {status || (selected ? "Selected" : "Open")}
        </Sticker>
        <BadgeCheck className="h-7 w-7 shrink-0" />
      </div>
      <h3 className="font-header text-2xl uppercase leading-tight">{title}</h3>
      {description ? <p className="mt-3 text-sm font-bold opacity-80">{description}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {points ? <Sticker accent="cyan" rotate="none" className="px-3 py-1 text-[10px]">{points}</Sticker> : null}
        {category ? <Sticker accent="white" rotate="none" className="px-3 py-1 text-[10px]">{category}</Sticker> : null}
        {deadline ? <Sticker accent="orange" rotate="none" className="px-3 py-1 text-[10px]">{deadline}</Sticker> : null}
        {difficulty ? <Sticker accent="yellow" rotate="none" className="px-3 py-1 text-[10px]">{difficulty}</Sticker> : null}
        {estimatedTime ? <Sticker accent="pink" rotate="none" className="px-3 py-1 text-[10px]">{estimatedTime}</Sticker> : null}
      </div>
      {typeof progress === "number" ? (
        <div className="mt-5">
          <CampProgress label="Completion" value={progress} accent="black" />
        </div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </Wrapper>
  );
}

function activityIcon(kind?: string) {
  const normalized = String(kind || "").toLowerCase();
  if (normalized.includes("petition")) return <Megaphone className="h-6 w-6" />;
  if (normalized.includes("event")) return <CalendarDays className="h-6 w-6" />;
  if (normalized.includes("badge")) return <Award className="h-6 w-6" />;
  if (normalized.includes("friend") || normalized.includes("member")) return <Users className="h-6 w-6" />;
  if (normalized.includes("video")) return <Zap className="h-6 w-6" />;
  return <CheckCircle2 className="h-6 w-6" />;
}

export function ActivityItem({
  avatar,
  title,
  detail,
  timestamp,
  points,
  icon,
  kind,
  fresh,
}: {
  avatar?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  timestamp?: ReactNode;
  points?: ReactNode;
  icon?: ReactNode;
  kind?: string;
  fresh?: boolean;
}) {
  return (
    <div className={cn("gpe-activity-item flex gap-4 border-b-[3px] border-black pb-5 last:border-b-0 last:pb-0", fresh && "gpe-pop-in")}>
      <div className="gpe-border flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gpe-cyan font-black">
        {avatar || icon || activityIcon(kind)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black">{title}</div>
        {detail ? <div className="mt-1 text-xs font-bold text-black/65">{detail}</div> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {points ? <Sticker accent="yellow" rotate="none" className="px-2 py-1 text-[10px]">{points}</Sticker> : null}
          {timestamp ? <span className="text-[10px] font-black uppercase text-black/45">{timestamp}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function BadgeToken({
  title,
  description,
  status = "locked",
  rarity = "common",
  accent = "white",
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  status?: "earned" | "locked" | "seasonal";
  rarity?: "common" | "rare" | "legendary";
  accent?: Accent;
  icon?: ReactNode;
}) {
  const locked = status === "locked";
  return (
    <button
      type="button"
      className={cn(
        "gpe-card-sm gpe-hover-lift w-full p-5 text-left",
        accentClasses[accent],
        locked && "opacity-70 grayscale",
        status === "earned" && "gpe-unlock",
      )}
      aria-label={`${title} badge, ${status}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="gpe-border flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-white text-black">
          {locked ? <Lock className="h-8 w-8" /> : icon || <Award className="h-8 w-8" />}
        </div>
        <Sticker accent={rarity === "legendary" ? "yellow" : rarity === "rare" ? "cyan" : "white"} rotate="none" className="px-3 py-1 text-[10px]">
          {status}
        </Sticker>
      </div>
      <div className="font-header text-xl uppercase leading-tight">{title}</div>
      {description ? <p className="mt-2 text-xs font-bold opacity-80">{description}</p> : null}
    </button>
  );
}

export function PodiumCard({
  rank,
  name,
  detail,
  points,
  accent = "yellow",
}: {
  rank: number;
  name: ReactNode;
  detail?: ReactNode;
  points: ReactNode;
  accent?: Accent;
}) {
  return (
    <article className={cn("gpe-card gpe-hover-lift relative p-5 text-center", accentClasses[accent], rank === 1 && "md:-mt-5")}>
      <Sticker accent="black" rotate={rank === 2 ? "left" : "right"} className="mx-auto -mt-9 mb-4 px-4 py-1 text-xs">
        #{rank}
      </Sticker>
      <Trophy className="mx-auto h-10 w-10" />
      <h3 className="mt-3 font-header text-2xl uppercase leading-tight">{name}</h3>
      {detail ? <p className="mt-2 text-xs font-black uppercase opacity-75">{detail}</p> : null}
      <div className="mt-4 font-header text-3xl uppercase">{points}</div>
    </article>
  );
}

export function CountdownStateCard({
  label,
  detail,
  state,
  progress,
}: {
  label: ReactNode;
  detail?: ReactNode;
  state: "completed" | "ends" | "live" | "starts";
  progress?: number;
}) {
  const accent = state === "completed" ? "black" : state === "starts" ? "yellow" : state === "ends" ? "orange" : "cyan";
  return (
    <div className={cn("rounded-[2rem] border-[4px] border-black p-5 shadow-gpe-sm", accentClasses[accent])}>
      <div className="flex items-center gap-3">
        <Clock className="h-8 w-8" />
        <div>
          <div className="font-header text-3xl uppercase leading-none">{label}</div>
          {detail ? <div className="mt-1 text-xs font-black uppercase opacity-70">{detail}</div> : null}
        </div>
      </div>
      {typeof progress === "number" ? (
        <div className="mt-4">
          <CampProgress label="Season progress" value={progress} accent={state === "completed" || state === "live" ? "white" : "black"} />
        </div>
      ) : null}
    </div>
  );
}

export function PrizeCard({
  title,
  description,
  accent = "pink",
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  accent?: Accent;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("gpe-card-sm gpe-hover-lift p-5", accentClasses[accent])}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-black bg-white text-black">
        {icon || <Award className="h-7 w-7" />}
      </div>
      <div className="font-header text-xl uppercase">{title}</div>
      {description ? <p className="mt-2 text-xs font-bold opacity-80">{description}</p> : null}
    </div>
  );
}

export function MarqueeStrip({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-hidden border-y-[4px] border-black bg-black py-3 text-white">
      <div className="gpe-marquee gap-10 font-header text-2xl uppercase md:text-3xl">
        <span>{children}</span>
        <span aria-hidden="true">{children}</span>
      </div>
    </div>
  );
}

export function SeasonHero({
  title,
  seasonName,
  description,
  actionHref,
  actionLabel,
  stats,
}: {
  title: ReactNode;
  seasonName: ReactNode;
  description: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  stats?: Array<{ label: ReactNode; value: ReactNode; icon?: ReactNode; accent?: Accent }>;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2.75rem] border-[4px] border-black bg-white p-6 shadow-gpe md:p-10">
      <div className="absolute right-4 top-4 hidden md:block">
        <DoodleStar />
      </div>
      <Tape className="mb-5">Official mission</Tape>
      <div className="grid gap-8 lg:grid-cols-[1.45fr_0.9fr] lg:items-end">
        <div>
          <h1 className="gpe-heading text-5xl leading-[0.9] md:text-7xl">{title}</h1>
          <Sticker accent="yellow" rotate="right" className="mt-5 text-base md:text-xl">
            {seasonName}
          </Sticker>
          <p className="mt-6 max-w-3xl text-base font-bold leading-relaxed md:text-xl">{description}</p>
          {actionHref && actionLabel ? (
            <Link to={actionHref} className="mt-6 inline-flex">
              <CampButton className="bg-gpe-pink text-white">
                {actionLabel}
                <ChevronRight className="ml-2 h-5 w-5" />
              </CampButton>
            </Link>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {(stats || [
            { label: "XP", value: "0", icon: <Zap className="h-12 w-12" />, accent: "cyan" as Accent },
            { label: "Badges", value: "0", icon: <BadgeCheck className="h-12 w-12" />, accent: "yellow" as Accent },
            { label: "Rank", value: "-", icon: <Trophy className="h-12 w-12" />, accent: "orange" as Accent },
          ]).map((stat) => (
            <StatSticker key={String(stat.label)} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}
