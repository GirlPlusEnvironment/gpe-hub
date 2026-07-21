import type { ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
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

type Accent = "pink" | "cyan" | "yellow" | "orange" | "black" | "white";

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
}: {
  name: ReactNode;
  score?: ReactNode;
  members?: ReactNode;
  description?: ReactNode;
  accent?: Accent;
  progress?: number;
  action?: ReactNode;
}) {
  return (
    <article className={cn("gpe-card gpe-hover-lift p-6", accentClasses[accent])}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="font-header text-2xl uppercase leading-none">{name}</div>
          {description ? <p className="mt-2 text-sm font-bold opacity-80">{description}</p> : null}
        </div>
        <Users className="h-8 w-8 shrink-0" />
      </div>
      <CampProgress label="Cabin progress" value={progress} accent={accent === "black" ? "white" : "black"} />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs font-black uppercase">
        <span>{score || "0 pts"}</span>
        <span>{members || "Members pending"}</span>
      </div>
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
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </Wrapper>
  );
}

export function ActivityItem({
  avatar,
  title,
  detail,
  timestamp,
  points,
  icon,
}: {
  avatar?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  timestamp?: ReactNode;
  points?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex gap-4 border-b-[3px] border-black pb-5 last:border-b-0 last:pb-0">
      <div className="gpe-border flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gpe-cyan font-black">
        {avatar || icon || <CheckCircle2 className="h-6 w-6" />}
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
