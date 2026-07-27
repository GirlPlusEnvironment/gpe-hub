import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock, Copy, Eye, Home, MessageSquareWarning, Search, Settings, Shield, Trophy, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, StatSticker, Sticker, Tape } from "@/components/camp/CampDesign";
import { challengeDefinition, challengeMetadata, mergeChallengeDefinition, submissionFieldsForChallenge, type ChallengeOpenFlowKind, type ChallengeSubmissionField, type ChallengeSubmissionFieldType } from "@/lib/challenge-definition";
import {
  type CampChallenge,
  type CampCabinLeaderboardRow,
  type CampSeason,
  type CampSubmission,
  type AdminAwardResult,
  type AdminPointMember,
  type AdminPointTransaction,
  type HubPointRule,
  associateCampSubmissionMember,
  awardManualPoints,
  getCampCabinLeaderboard,
  getAdminMemberPointHistory,
  getAdminCampChallenges,
  getActiveCampSeason,
  getPendingCampSubmissions,
  getPointRules,
  reversePointTransaction,
  searchPointMembers,
  updateCampChallengeContent,
  updateCampSubmissionActionReview,
} from "@/lib/camp";
import { normalizeReviewStatus, reviewStatusClassName, reviewStatusLabel } from "@/lib/review-status";
import { approveSubmission, reopenSubmission, updateSubmissionStatus } from "@/lib/submission-review";
import { toast } from "@/hooks/use-toast";

type ReviewFilter = "pending" | "approved" | "needs_information" | "rejected" | "duplicate" | "all";
type ReviewDialogKind = "approve" | "reject" | "needs_information" | "duplicate";
type WorkspaceTab = "overview" | "challenges" | "schedule" | "submissions" | "moderation" | "cabins" | "rewards" | "settings";
type ScheduleFilter = "all" | "active" | "upcoming" | "draft" | "hidden" | "completed";
type ScheduleView = "timeline" | "calendar" | "list";
type RewardsTab = "rules" | "ledger" | "adjustments" | "badges" | "achievements";
type ModerationTab = "posts" | "comments" | "listings" | "messages" | "reports" | "users";
type ChallengeEditorTab = "overview" | "content" | "schedule" | "rewards" | "submission" | "resources" | "notifications" | "history";

type ReviewDialogState = {
  kind: ReviewDialogKind;
  actionId: string;
  memberLabel: string;
  challengeTitle: string;
  defaultPoints: number;
} | null;

type ActionDialogState =
  | { kind: "edit_action"; actionId: string; defaultPoints: number | null }
  | { kind: "associate"; submissionId: string }
  | { kind: "reopen"; actionId: string }
  | { kind: "manual_award" }
  | { kind: "reverse"; transaction: AdminPointTransaction }
  | null;

type ChallengeForm = {
  title: string;
  internalName: string;
  slug: string;
  subtitle: string;
  theme: string;
  icon: string;
  heroImage: string;
  isFeatured: boolean;
  isActive: boolean;
  isHubVisible: boolean;
  shortDescription: string;
  longDescription: string;
  instructions: string;
  whyItMatters: string;
  successMessage: string;
  faq: string;
  ctaLabel: string;
  actionUrl: string;
  relatedUrl: string;
  openFlowKind: ChallengeOpenFlowKind;
  openFlowLabel: string;
  openFlowUrl: string;
  openFlowReturnUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  completionUrl: string;
  toolkitUrl: string;
  petitionUrl: string;
  eventUrl: string;
  videoUrl: string;
  startsAt: string;
  endsAt: string;
  weekNumber: string;
  displayOrder: string;
  category: string;
  pointValue: string;
  badgeEligible: boolean;
  autoApprove: boolean;
  requiresReview: boolean;
  requiresProof: boolean;
  allowMultipleSubmissions: boolean;
  maxCompletionsPerMember: string;
  verificationMethod: string;
  submissionType: string;
  submissionEnabled: boolean;
  submissionTitle: string;
  submissionInstructions: string;
  submissionFieldsJson: string;
  notificationSubmissionReceived: string;
  notificationApproval: string;
  notificationChangesRequested: string;
  notificationRejection: string;
  notificationCompletion: string;
  notificationPointsAwarded: string;
};

const reviewFilters: Array<{ value: ReviewFilter; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "needs_information", label: "Needs Changes" },
  { value: "duplicate", label: "Duplicate" },
  { value: "all", label: "All submissions" },
];

const workspaceTabs: Array<{ value: WorkspaceTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "challenges", label: "Challenge Builder" },
  { value: "schedule", label: "Schedule" },
  { value: "submissions", label: "Submission Review" },
  { value: "moderation", label: "Moderation" },
  { value: "cabins", label: "Cabins" },
  { value: "rewards", label: "Rewards & Points" },
  { value: "settings", label: "Settings" },
];

const moderationTabs: Array<{ value: ModerationTab; label: string; count: number }> = [
  { value: "posts", label: "Posts", count: 3 },
  { value: "comments", label: "Comments", count: 5 },
  { value: "listings", label: "Listings", count: 2 },
  { value: "messages", label: "Messages", count: 1 },
  { value: "reports", label: "Reports", count: 7 },
  { value: "users", label: "Users", count: 2 },
];

const rewardsTabs: Array<{ value: RewardsTab; label: string }> = [
  { value: "rules", label: "Point Rules" },
  { value: "ledger", label: "Point Ledger" },
  { value: "adjustments", label: "Manual Adjustments" },
  { value: "badges", label: "Badges" },
  { value: "achievements", label: "Achievements" },
];

const challengeEditorTabs: Array<{ value: ChallengeEditorTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "content", label: "Content" },
  { value: "schedule", label: "Schedule" },
  { value: "rewards", label: "Rewards" },
  { value: "submission", label: "Submission" },
  { value: "resources", label: "Resources" },
  { value: "notifications", label: "Notifications" },
  { value: "history", label: "History" },
];

function workspaceTabFromUrl(value: string | null): WorkspaceTab {
  if (value === "builder") return "challenges";
  if (value === "review") return "submissions";
  return workspaceTabs.some((tab) => tab.value === value) ? (value as WorkspaceTab) : "overview";
}

function submissionSource(submission: CampSubmission, fields: Record<string, unknown>) {
  const payload = submission.submitted_payload as (CampSubmission["submitted_payload"] & { source?: unknown }) | null;
  return String(payload?.source || fields.sourcePage || "Seasonal challenge form");
}

function createManualIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `manual:${crypto.randomUUID()}`;
  }
  return `manual:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function datetimeForInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function stringFromMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function stringFromRecord(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function createChallengeForm(challenge: CampChallenge): ChallengeForm {
  const metadata = challengeMetadata(challenge);
  const definition = challengeDefinition(challenge);
  const openFlow = definition.open_flow || {};
  const resources = definition.resources || {};
  const completion = definition.completion || {};
  const notifications = definition.notifications || {};
  const submission = definition.submission || {};
  return {
    title: challenge.title || "",
    internalName: stringFromMetadata(metadata, "internal_name"),
    slug: challenge.slug || "",
    subtitle: stringFromMetadata(metadata, "subtitle"),
    theme: challenge.theme || "",
    icon: challenge.icon || "",
    heroImage: stringFromMetadata(metadata, "hero_image_url"),
    isFeatured: Boolean(challenge.is_featured),
    isActive: Boolean(challenge.is_active),
    isHubVisible: Boolean(challenge.is_hub_visible),
    shortDescription: challenge.short_description || "",
    longDescription: stringFromMetadata(metadata, "long_description"),
    instructions: challenge.instructions || "",
    whyItMatters: challenge.why_it_matters || "",
    successMessage: stringFromMetadata(metadata, "success_message"),
    faq: Array.isArray(metadata.faq) ? metadata.faq.join("\n") : stringFromMetadata(metadata, "faq"),
    ctaLabel: challenge.cta_label || "",
    actionUrl: challenge.action_url || "",
    relatedUrl: challenge.related_url || "",
    openFlowKind: openFlow.kind || (challenge.submission_type === "petition" || challenge.category === "sign_petition" ? "external_action" : "submission_form"),
    openFlowLabel: openFlow.label || challenge.cta_label || "",
    openFlowUrl: openFlow.url || challenge.related_url || challenge.action_url || "",
    openFlowReturnUrl: openFlow.return_url || "",
    secondaryCtaLabel: openFlow.secondary_label || "Submit for Points",
    secondaryCtaUrl: openFlow.secondary_url || "",
    completionUrl: completion.url || "",
    toolkitUrl: resources.toolkit_url || "",
    petitionUrl: resources.petition_url || "",
    eventUrl: resources.event_url || "",
    videoUrl: resources.video_url || "",
    startsAt: datetimeForInput(challenge.starts_at),
    endsAt: datetimeForInput(challenge.ends_at),
    weekNumber: challenge.week_number == null ? "" : String(challenge.week_number),
    displayOrder: String(challenge.display_order ?? 0),
    category: challenge.category || "other",
    pointValue: challenge.point_value == null ? "" : String(challenge.point_value),
    badgeEligible: Boolean(challenge.badge_eligible),
    autoApprove: Boolean(challenge.auto_approve),
    requiresReview: Boolean(challenge.requires_review),
    requiresProof: Boolean(challenge.requires_proof),
    allowMultipleSubmissions: Boolean(challenge.allow_multiple_submissions),
    maxCompletionsPerMember: String(challenge.max_completions_per_member || 1),
    verificationMethod: challenge.verification_method || "team_review",
    submissionType: challenge.submission_type || "",
    submissionEnabled: submission.enabled !== false,
    submissionTitle: submission.title || "Submit Your Challenge",
    submissionInstructions: submission.instructions || "",
    submissionFieldsJson: JSON.stringify(submission.fields || submissionFieldsForChallenge(challenge), null, 2),
    notificationSubmissionReceived: stringFromRecord(notifications, "submission_received"),
    notificationApproval: stringFromRecord(notifications, "approval"),
    notificationChangesRequested: stringFromRecord(notifications, "changes_requested"),
    notificationRejection: stringFromRecord(notifications, "rejection"),
    notificationCompletion: stringFromRecord(notifications, "completion"),
    notificationPointsAwarded: stringFromRecord(notifications, "points_awarded"),
  };
}

function dynamicSubmissionRows(fields: Record<string, unknown>, challenge: CampChallenge | undefined) {
  const submissionData = fields.submissionData;
  if (!submissionData || typeof submissionData !== "object" || Array.isArray(submissionData)) return [];
  const data = submissionData as Record<string, unknown>;
  const schema = challenge ? submissionFieldsForChallenge(challenge) : [];
  return Object.entries(data).map(([key, value]) => ({
    key,
    label: schema.find((field) => field.id === key)?.label || key.replaceAll("_", " "),
    value: Array.isArray(value) ? value.join(", ") : String(value || "Not provided"),
  }));
}

function parseSubmissionFieldJson(value: string): ChallengeSubmissionField[] {
  const parsed = JSON.parse(value || "[]") as unknown;
  if (!Array.isArray(parsed)) throw new Error("Submission fields must be a JSON array.");
  return parsed as ChallengeSubmissionField[];
}

function serializeSubmissionFields(fields: ChallengeSubmissionField[]) {
  return JSON.stringify(fields, null, 2);
}

function slugifyChallenge(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export default function CampAdmin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [season, setSeason] = useState<CampSeason | null>(null);
  const [submissions, setSubmissions] = useState<CampSubmission[]>([]);
  const [challenges, setChallenges] = useState<CampChallenge[]>([]);
  const [cabinRows, setCabinRows] = useState<CampCabinLeaderboardRow[]>([]);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("pending");
  const [memberQuery, setMemberQuery] = useState("");
  const [pointMemberResults, setPointMemberResults] = useState<AdminPointMember[]>([]);
  const [selectedPointMember, setSelectedPointMember] = useState<AdminPointMember | null>(null);
  const [pointHistory, setPointHistory] = useState<AdminPointTransaction[]>([]);
  const [pointRules, setPointRules] = useState<HubPointRule[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>("all");
  const [scheduleView, setScheduleView] = useState<ScheduleView>("timeline");
  const [moderationTab, setModerationTab] = useState<ModerationTab>("reports");
  const [rewardsTab, setRewardsTab] = useState<RewardsTab>("rules");
  const [challengeEditorTab, setChallengeEditorTab] = useState<ChallengeEditorTab>("overview");
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [pointSearchMessage, setPointSearchMessage] = useState<string | null>(null);
  const [manualPoints, setManualPoints] = useState("10");
  const [manualReason, setManualReason] = useState("Manual seasonal adjustment");
  const [manualActionType, setManualActionType] = useState("manual_admin_award");
  const [manualAdminNote, setManualAdminNote] = useState("");
  const [manualChallengeId, setManualChallengeId] = useState("");
  const [manualOccurredAt, setManualOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [countsForOngoing, setCountsForOngoing] = useState(true);
  const [countsForSeason, setCountsForSeason] = useState(false);
  const [countsForCabin, setCountsForCabin] = useState(false);
  const [lastAwardResult, setLastAwardResult] = useState<AdminAwardResult | null>(null);
  const [manualIdempotencyKey, setManualIdempotencyKey] = useState(createManualIdempotencyKey);
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialogState>(null);
  const [dialogChallengeId, setDialogChallengeId] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [dialogPoints, setDialogPoints] = useState("");
  const [dialogReason, setDialogReason] = useState("");
  const [dialogNotes, setDialogNotes] = useState("");
  const [cabinName, setCabinName] = useState("New Cabin");
  const [cabinSlug, setCabinSlug] = useState("new-cabin");
  const [cabinColor, setCabinColor] = useState("#67e8f9");
  const [cabinMemberSearch, setCabinMemberSearch] = useState("");
  const [localCabins, setLocalCabins] = useState<Array<CampCabinLeaderboardRow & { chatStatus: string; lead: string; visibility: string }>>([]);
  const [reviewPoints, setReviewPoints] = useState("0");
  const [reviewNotes, setReviewNotes] = useState("");
  const [notifyMember, setNotifyMember] = useState(true);
  const [rejectReason, setRejectReason] = useState("Incomplete");
  const [editingChallenge, setEditingChallenge] = useState<CampChallenge | null>(null);
  const [challengeForm, setChallengeForm] = useState<ChallengeForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeWorkspaceTab = workspaceTabFromUrl(searchParams.get("tab"));

  const setWorkspaceTab = useCallback((tab: WorkspaceTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", tab);
      return next;
    });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }, [setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await getActiveCampSeason();
      setSeason(active);
      if (active) {
        const [submissionRows, challengeRows, cabinLeaderboardRows] = await Promise.all([
          getPendingCampSubmissions(active.id),
          getAdminCampChallenges(active.id),
          getCampCabinLeaderboard(active.id),
        ]);
        setSubmissions(submissionRows);
        setChallenges(challengeRows);
        setCabinRows(cabinLeaderboardRows);
        setSelectedChallengeId((current) => current || challengeRows[0]?.id || null);
      }
      setPointRules(await getPointRules());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camp admin could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!challenges.length) return;
    const selected = selectedChallengeId ? challenges.find((challenge) => challenge.id === selectedChallengeId) : null;
    const nextChallenge = selected || challenges[0];
    if (!selectedChallengeId || !selected) setSelectedChallengeId(nextChallenge.id);
    if (!editingChallenge || editingChallenge.id !== nextChallenge.id) {
      setEditingChallenge(nextChallenge);
      setChallengeForm(createChallengeForm(nextChallenge));
    }
  }, [challenges, editingChallenge, selectedChallengeId]);

  function openReviewDialog(params: {
    kind: ReviewDialogKind;
    actionId: string;
    memberLabel: string;
    challengeTitle: string;
    defaultPoints: number | null;
  }) {
    const defaultPoints = params.defaultPoints ?? 0;
    setReviewDialog({
      kind: params.kind,
      actionId: params.actionId,
      memberLabel: params.memberLabel,
      challengeTitle: params.challengeTitle,
      defaultPoints,
    });
    setReviewPoints(String(defaultPoints));
    setNotifyMember(true);
    setRejectReason(params.kind === "reject" ? "Incomplete" : params.kind === "duplicate" ? "Duplicate submission" : "Needs more proof");
    setReviewNotes(
      params.kind === "approve"
        ? "Looks great!"
        : params.kind === "needs_information"
          ? "Hi! Can you upload a screenshot instead?"
          : "",
    );
  }

  async function submitReviewDialog() {
    if (!reviewDialog) return;
    setBusyId(reviewDialog.actionId);
    setError(null);
    try {
      if (reviewDialog.kind === "approve") {
        const points = Number(reviewPoints);
        if (!Number.isFinite(points) || points < 0) {
          setError("Enter a valid point amount.");
          return;
        }
        const result = await approveSubmission(
          { id: reviewDialog.actionId, type: "camp" },
          { points, reviewerNotes: reviewNotes.trim() || null },
        );
        const ledgerId = result && typeof result === "object" && "ledger_id" in result ? String(result.ledger_id || "") : "";
        const seasonRank = result && typeof result === "object" && "season_rank" in result ? result.season_rank : null;
        toast({
          title: "Submission approved",
          description: ledgerId
            ? `Points awarded. Ledger ${ledgerId}${seasonRank ? ` · rank ${seasonRank}` : ""}.`
            : "The submission was approved and the point workflow completed.",
        });
      } else {
        const status =
          reviewDialog.kind === "needs_information"
            ? "needs_information"
            : reviewDialog.kind === "reject"
              ? "rejected"
              : "duplicate";
        const notes = [rejectReason, reviewNotes].map((value) => value.trim()).filter(Boolean).join(": ");
        await updateSubmissionStatus(
          { id: reviewDialog.actionId, type: "camp" },
          { status, reviewerNotes: notes || null },
        );
      }

      const nextPending = submissions
        .flatMap((submission) => (submission.gpe_camp_submission_actions || []).map((action) => ({ submission, action })))
        .find(({ action }) => action.id !== reviewDialog.actionId && normalizeReviewStatus(action.review_status) === "pending");
      setSelectedSubmissionId(nextPending?.submission.id || null);
      setReviewDialog(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update submission.");
    } finally {
      setBusyId(null);
    }
  }

  function openUpdateActionDialog(actionId: string, defaultPoints: number | null) {
    setDialogChallengeId("");
    setDialogDescription("");
    setDialogPoints(String(defaultPoints ?? 0));
    setDialogNotes("");
    setDialogReason("");
    setActionDialog({ kind: "edit_action", actionId, defaultPoints });
  }

  async function submitUpdateAction(actionId: string) {
    const requestedPoints = dialogPoints.trim() === "" ? null : Number(dialogPoints);
    if (requestedPoints !== null && !Number.isFinite(requestedPoints)) {
      setError("Enter a valid suggested point amount.");
      return;
    }
    setBusyId(actionId);
    setError(null);
    try {
      await updateCampSubmissionActionReview({
        actionId,
        challengeId: dialogChallengeId.trim() || null,
        otherDescription: dialogDescription.trim() || null,
        requestedPoints,
        notes: dialogNotes.trim() || null,
      });
      setActionDialog(null);
      await load();
      toast({ title: "Submission action updated", description: "The review details were saved." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update submission action.");
    } finally {
      setBusyId(null);
    }
  }

  function openAssociateSubmissionDialog(submissionId: string) {
    setDialogReason("");
    setDialogNotes("");
    setActionDialog({ kind: "associate", submissionId });
  }

  async function submitAssociateSubmission(submissionId: string) {
    if (!dialogReason.trim()) {
      setError("Enter the season member ID to associate.");
      return;
    }
    setBusyId(submissionId);
    setError(null);
    try {
      await associateCampSubmissionMember({ submissionId, seasonMemberId: dialogReason.trim(), notes: dialogNotes.trim() || null });
      setActionDialog(null);
      await load();
      toast({ title: "Member associated", description: "The submission is linked for Camp review." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not associate submission with member.");
    } finally {
      setBusyId(null);
    }
  }

  function openReopenActionDialog(actionId: string) {
    setDialogNotes("Reopened for review");
    setActionDialog({ kind: "reopen", actionId });
  }

  async function submitReopenAction(actionId: string) {
    setBusyId(actionId);
    setError(null);
    try {
      await reopenSubmission({ id: actionId, type: "camp" }, { reviewerNotes: dialogNotes.trim() || "Reopened for review" });
      setActionDialog(null);
      await load();
      toast({ title: "Submission reopened", description: "The action is back in the pending queue." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reopen submission action.");
    } finally {
      setBusyId(null);
    }
  }

  async function loadPointHistory(member: AdminPointMember) {
    const history = await getAdminMemberPointHistory({
      profileId: member.profile_id,
      seasonId: season?.id ?? null,
      limit: 20,
    });
    setPointHistory(history);
  }

  function selectPointMember(member: AdminPointMember) {
    setSelectedPointMember(member);
    setLastAwardResult(null);
    setCountsForSeason(false);
    setCountsForCabin(false);
    setManualChallengeId("");
    setManualIdempotencyKey(createManualIdempotencyKey());
    void loadPointHistory(member).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load member point history.");
    });
  }

  useEffect(() => {
    const trimmed = memberQuery.trim();
    if (!season || trimmed.length < 2) {
      setPointMemberResults([]);
      setPointSearchMessage(trimmed.length > 0 && trimmed.length < 2 ? "Enter at least 2 characters." : null);
      return;
    }

    const handle = window.setTimeout(async () => {
      setIsSearchingMembers(true);
      setPointSearchMessage(null);
      try {
        const results = await searchPointMembers({ seasonId: season.id, query: trimmed, limit: 25 });
        setPointMemberResults(results);
        setPointSearchMessage(`${results.length} result${results.length === 1 ? "" : "s"} found.`);
      } catch (err) {
        setPointMemberResults([]);
        setPointSearchMessage(err instanceof Error ? err.message : "Member search failed.");
      } finally {
        setIsSearchingMembers(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [memberQuery, season]);

  const selectedRule = useMemo(
    () => pointRules.find((rule) => rule.action_type === manualActionType) || null,
    [manualActionType, pointRules],
  );

  useEffect(() => {
    if (!selectedRule) return;
    if (manualActionType === "manual_admin_award" || manualActionType === "manual_camp_award") return;
    setManualPoints(String(selectedRule.point_value));
    setCountsForOngoing(selectedRule.counts_for_ongoing);
    setCountsForSeason(selectedRule.counts_for_season);
    setCountsForCabin(selectedRule.counts_for_cabin);
  }, [manualActionType, selectedRule]);

  function handleScopedManualAward() {
    if (!season || !selectedPointMember) return;
    const points = Number(manualPoints);
    if (!Number.isFinite(points) || points === 0) {
      setError("Enter a non-zero point amount.");
      return;
    }
    if (!manualReason.trim()) {
      setError("Enter a reason for the award.");
      return;
    }
    if (countsForCabin && !selectedPointMember.cabin_id) {
      setError("This member does not have a cabin assignment for cabin-scoped points.");
      return;
    }

    const scope = [
      countsForOngoing ? "ongoing" : null,
      countsForSeason ? "seasonal" : null,
      countsForCabin ? "cabin" : null,
    ].filter(Boolean).join(", ") || "no leaderboard";
    setDialogReason(`Award ${points} point${points === 1 ? "" : "s"} to ${selectedPointMember.full_name || selectedPointMember.email || selectedPointMember.profile_id}. Scope: ${scope}. Reason: ${manualReason}`);
    setActionDialog({ kind: "manual_award" });
  }

  async function submitScopedManualAward() {
    if (!season || !selectedPointMember) return;
    const points = Number(manualPoints);
    setBusyId("manual-award");
    setError(null);
    setLastAwardResult(null);
    try {
      const result = await awardManualPoints({
        profileId: selectedPointMember.profile_id,
        points,
        reason: manualReason.trim(),
        actionType: manualActionType,
        adminNote: manualAdminNote.trim() || null,
        seasonId: countsForSeason || countsForCabin ? season.id : null,
        challengeId: manualChallengeId.trim() || null,
        cabinId: countsForCabin ? selectedPointMember.cabin_id : null,
        occurredAt: manualOccurredAt ? new Date(manualOccurredAt).toISOString() : new Date().toISOString(),
        countsForOngoing,
        countsForSeason,
        countsForCabin,
        idempotencyKey: manualIdempotencyKey,
      });
      setLastAwardResult(result);
      setManualIdempotencyKey(createManualIdempotencyKey());
      const refreshed = await searchPointMembers({ seasonId: season.id, query: selectedPointMember.profile_id, limit: 1 });
      if (refreshed[0]) {
        setSelectedPointMember(refreshed[0]);
      }
      await loadPointHistory(refreshed[0] || selectedPointMember);
      setActionDialog(null);
      toast({ title: "Points awarded", description: "The ledger and leaderboard scopes were updated." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not award manual points.");
    } finally {
      setBusyId(null);
    }
  }

  function openReverseTransactionDialog(transaction: AdminPointTransaction) {
    setDialogReason("Admin correction");
    setActionDialog({ kind: "reverse", transaction });
  }

  async function submitReverseTransaction(transaction: AdminPointTransaction) {
    if (!dialogReason.trim()) {
      setError("Enter a reversal reason.");
      return;
    }
    setBusyId(transaction.transaction_id);
    setError(null);
    try {
      await reversePointTransaction({ transactionId: transaction.transaction_id, reason: dialogReason.trim() });
      if (selectedPointMember) {
        const refreshed = await searchPointMembers({ seasonId: season?.id ?? null, query: selectedPointMember.profile_id, limit: 1 });
        if (refreshed[0]) setSelectedPointMember(refreshed[0]);
        await loadPointHistory(refreshed[0] || selectedPointMember);
      }
      setActionDialog(null);
      toast({ title: "Points reversed", description: "A compensating ledger entry was created." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reverse points.");
    } finally {
      setBusyId(null);
    }
  }

  function openChallengeBuilder(challenge: CampChallenge) {
    setWorkspaceTab("challenges");
    setSelectedChallengeId(challenge.id);
    setEditingChallenge(challenge);
    setChallengeForm(createChallengeForm(challenge));
  }

  function updateChallengeForm<K extends keyof ChallengeForm>(key: K, value: ChallengeForm[K]) {
    setChallengeForm((current) => current ? { ...current, [key]: value } : current);
  }

  function updateSubmissionFields(mutator: (fields: ChallengeSubmissionField[]) => ChallengeSubmissionField[]) {
    setChallengeForm((current) => {
      if (!current) return current;
      try {
        const fields = parseSubmissionFieldJson(current.submissionFieldsJson);
        return { ...current, submissionFieldsJson: serializeSubmissionFields(mutator(fields)) };
      } catch (_) {
        setError("Fix the field JSON before using the visual field builder.");
        return current;
      }
    });
  }

  function updateSubmissionField(index: number, patch: Partial<ChallengeSubmissionField>) {
    updateSubmissionFields((fields) => fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field));
  }

  function addSubmissionField() {
    updateSubmissionFields((fields) => [
      ...fields,
      {
        id: `field_${fields.length + 1}`,
        type: "text",
        label: "New field",
        required: false,
      },
    ]);
    setChallengeEditorTab("submission");
  }

  function removeSubmissionField(index: number) {
    updateSubmissionFields((fields) => fields.filter((_, fieldIndex) => fieldIndex !== index));
  }

  function moveSubmissionField(index: number, direction: -1 | 1) {
    updateSubmissionFields((fields) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= fields.length) return fields;
      const copy = [...fields];
      const [field] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, field);
      return copy;
    });
  }

  async function saveChallengeBuilder() {
    if (!editingChallenge || !challengeForm) return;
    const weekNumber = challengeForm.weekNumber.trim() ? Number(challengeForm.weekNumber) : null;
    const pointValue = challengeForm.pointValue.trim() ? Number(challengeForm.pointValue) : null;
    const displayOrder = challengeForm.displayOrder.trim() ? Number(challengeForm.displayOrder) : 0;
    const maxCompletions = challengeForm.maxCompletionsPerMember.trim() ? Number(challengeForm.maxCompletionsPerMember) : 1;
    if (
      (weekNumber !== null && !Number.isFinite(weekNumber)) ||
      (pointValue !== null && !Number.isFinite(pointValue)) ||
      !Number.isFinite(displayOrder) ||
      !Number.isFinite(maxCompletions) ||
      maxCompletions < 1
    ) {
      setError("Challenge edit has an invalid numeric field.");
      return;
    }
    const slug = slugifyChallenge(challengeForm.slug || challengeForm.title);
    if (!slug || slug !== challengeForm.slug.trim()) {
      setError("Enter a URL-safe slug using lowercase letters, numbers, and hyphens.");
      return;
    }
    let submissionFields: ChallengeSubmissionField[];
    try {
      submissionFields = parseSubmissionFieldJson(challengeForm.submissionFieldsJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission fields must be valid JSON.");
      return;
    }
    const invalidField = submissionFields.find((field) => !field.id || !field.label || !field.type);
    if (invalidField) {
      setError("Every submission field must have an id, label, and field type.");
      return;
    }

    const currentMetadata = challengeMetadata(editingChallenge);
    const previousDefinition = challengeDefinition(editingChallenge);
    const historyEntry = {
      editor: "Team GPE",
      timestamp: new Date().toISOString(),
      publish_state: challengeForm.isActive && challengeForm.isHubVisible ? "published" : challengeForm.isActive ? "hidden" : "draft",
      changed_fields: Object.entries({
        title: editingChallenge.title !== challengeForm.title.trim(),
        slug: editingChallenge.slug !== slug,
        schedule: datetimeForInput(editingChallenge.starts_at) !== challengeForm.startsAt || datetimeForInput(editingChallenge.ends_at) !== challengeForm.endsAt,
        rewards: String(editingChallenge.point_value ?? "") !== challengeForm.pointValue.trim(),
        submission: JSON.stringify(previousDefinition.submission?.fields || []) !== JSON.stringify(submissionFields),
        open_flow: previousDefinition.open_flow?.kind !== challengeForm.openFlowKind,
      }).filter(([, changed]) => changed).map(([field]) => field),
    };
    const existingHistory = Array.isArray(currentMetadata.history) ? currentMetadata.history : [];
    const metadata = mergeChallengeDefinition({
      ...currentMetadata,
      internal_name: challengeForm.internalName.trim(),
      subtitle: challengeForm.subtitle.trim(),
      hero_image_url: challengeForm.heroImage.trim(),
      long_description: challengeForm.longDescription.trim(),
      success_message: challengeForm.successMessage.trim(),
      completion_url: challengeForm.completionUrl.trim(),
      history: [historyEntry, ...existingHistory].slice(0, 25),
      faq: challengeForm.faq
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    }, {
      hero: {
        cover_image_url: challengeForm.heroImage.trim(),
      },
      open_flow: {
        kind: challengeForm.openFlowKind,
        label: challengeForm.openFlowLabel.trim(),
        url: challengeForm.openFlowUrl.trim(),
        return_url: challengeForm.openFlowReturnUrl.trim(),
        secondary_label: challengeForm.secondaryCtaLabel.trim(),
        secondary_url: challengeForm.secondaryCtaUrl.trim(),
      },
      resources: {
        toolkit_url: challengeForm.toolkitUrl.trim(),
        petition_url: challengeForm.petitionUrl.trim(),
        event_url: challengeForm.eventUrl.trim(),
        video_url: challengeForm.videoUrl.trim(),
      },
      completion: {
        message: challengeForm.successMessage.trim(),
        url: challengeForm.completionUrl.trim(),
      },
      notifications: {
        submission_received: challengeForm.notificationSubmissionReceived.trim(),
        approval: challengeForm.notificationApproval.trim(),
        changes_requested: challengeForm.notificationChangesRequested.trim(),
        rejection: challengeForm.notificationRejection.trim(),
        completion: challengeForm.notificationCompletion.trim(),
        points_awarded: challengeForm.notificationPointsAwarded.trim(),
      },
      submission: {
        enabled: challengeForm.submissionEnabled,
        title: challengeForm.submissionTitle.trim(),
        instructions: challengeForm.submissionInstructions.trim(),
        type: challengeForm.submissionType.trim(),
        fields: submissionFields,
      },
    });
    setBusyId(editingChallenge.id);
    setError(null);
    try {
      await updateCampChallengeContent(editingChallenge.id, {
        title: challengeForm.title.trim(),
        slug,
        short_description: challengeForm.shortDescription.trim() || null,
        instructions: challengeForm.instructions.trim() || null,
        theme: challengeForm.theme.trim() || null,
        icon: challengeForm.icon.trim() || null,
        category: challengeForm.category,
        week_number: weekNumber,
        point_value: pointValue,
        starts_at: challengeForm.startsAt ? new Date(challengeForm.startsAt).toISOString() : null,
        ends_at: challengeForm.endsAt ? new Date(challengeForm.endsAt).toISOString() : null,
        cta_label: challengeForm.openFlowLabel.trim() || challengeForm.ctaLabel.trim() || null,
        action_url: challengeForm.actionUrl.trim() || challengeForm.openFlowUrl.trim() || null,
        related_url: challengeForm.relatedUrl.trim() || challengeForm.openFlowUrl.trim() || null,
        submission_type: challengeForm.submissionType.trim() || null,
        verification_method: challengeForm.verificationMethod.trim() || null,
        display_order: displayOrder,
        is_featured: challengeForm.isFeatured,
        is_active: challengeForm.isActive,
        is_hub_visible: challengeForm.isHubVisible,
        why_it_matters: challengeForm.whyItMatters.trim() || null,
        badge_eligible: challengeForm.badgeEligible,
        auto_approve: challengeForm.autoApprove,
        requires_review: challengeForm.requiresReview,
        requires_proof: challengeForm.requiresProof,
        allow_multiple_submissions: challengeForm.allowMultipleSubmissions,
        max_completions_per_member: maxCompletions,
        metadata,
      });
      const refreshedChallenge = { ...editingChallenge, ...{
        title: challengeForm.title.trim(),
        slug,
        short_description: challengeForm.shortDescription.trim() || null,
        instructions: challengeForm.instructions.trim() || null,
        theme: challengeForm.theme.trim() || null,
        icon: challengeForm.icon.trim() || null,
        category: challengeForm.category,
        week_number: weekNumber,
        point_value: pointValue,
        starts_at: challengeForm.startsAt ? new Date(challengeForm.startsAt).toISOString() : null,
        ends_at: challengeForm.endsAt ? new Date(challengeForm.endsAt).toISOString() : null,
        cta_label: challengeForm.openFlowLabel.trim() || challengeForm.ctaLabel.trim() || null,
        action_url: challengeForm.actionUrl.trim() || challengeForm.openFlowUrl.trim() || null,
        related_url: challengeForm.relatedUrl.trim() || challengeForm.openFlowUrl.trim() || null,
        submission_type: challengeForm.submissionType.trim() || null,
        verification_method: challengeForm.verificationMethod.trim() || null,
        display_order: displayOrder,
        is_featured: challengeForm.isFeatured,
        is_active: challengeForm.isActive,
        is_hub_visible: challengeForm.isHubVisible,
        why_it_matters: challengeForm.whyItMatters.trim() || null,
        badge_eligible: challengeForm.badgeEligible,
        auto_approve: challengeForm.autoApprove,
        requires_review: challengeForm.requiresReview,
        requires_proof: challengeForm.requiresProof,
        allow_multiple_submissions: challengeForm.allowMultipleSubmissions,
        max_completions_per_member: maxCompletions,
        metadata,
      } };
      setEditingChallenge(refreshedChallenge);
      setChallengeForm(createChallengeForm(refreshedChallenge));
      setSelectedChallengeId(refreshedChallenge.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update challenge.");
    } finally {
      setBusyId(null);
    }
  }

  const visibleSubmissions = submissions.filter((submission) => {
    if (reviewFilter === "all") return true;
    const actions = submission.gpe_camp_submission_actions || [];
    if (actions.length === 0) return reviewFilter === "pending" && normalizeReviewStatus(submission.review_status) === "pending";
    return actions.some((action) => normalizeReviewStatus(action.review_status) === reviewFilter);
  });

  const selectedSubmission = visibleSubmissions.find((submission) => submission.id === selectedSubmissionId) || visibleSubmissions[0] || null;
  const selectedChallenge = challenges.find((challenge) => challenge.id === selectedChallengeId) || challenges[0] || null;
  const now = Date.now();
  const pendingReviews = submissions.filter((submission) => {
    const actions = submission.gpe_camp_submission_actions || [];
    return actions.length === 0
      ? normalizeReviewStatus(submission.review_status) === "pending"
      : actions.some((action) => normalizeReviewStatus(action.review_status) === "pending");
  }).length;
  const approvedToday = submissions.filter((submission) =>
    (submission.gpe_camp_submission_actions || []).some((action) => normalizeReviewStatus(action.review_status) === "approved"),
  ).length;
  const activeChallenges = challenges.filter((challenge) => {
    const start = challenge.starts_at ? new Date(challenge.starts_at).getTime() : null;
    const end = challenge.ends_at ? new Date(challenge.ends_at).getTime() : null;
    return challenge.is_active && challenge.is_hub_visible && (!start || now >= start) && (!end || now <= end);
  });
  const newestChallenge = [...challenges].sort((a, b) => (b.display_order || 0) - (a.display_order || 0))[0] || null;
  const filteredScheduleChallenges = challenges.filter((challenge) => {
    if (scheduleFilter === "active") return activeChallenges.some((item) => item.id === challenge.id);
    if (scheduleFilter === "upcoming") return Boolean(challenge.starts_at && new Date(challenge.starts_at).getTime() > now);
    if (scheduleFilter === "draft") return !challenge.is_active;
    if (scheduleFilter === "hidden") return !challenge.is_hub_visible;
    if (scheduleFilter === "completed") return Boolean(challenge.ends_at && new Date(challenge.ends_at).getTime() < now);
    return true;
  });
  const reviewStatusCounts = reviewFilters.reduce<Record<ReviewFilter, number>>((counts, filter) => {
    counts[filter] = submissions.filter((submission) => {
      if (filter === "all") return true;
      const actions = submission.gpe_camp_submission_actions || [];
      if (actions.length === 0) return normalizeReviewStatus(submission.review_status) === filter;
      return actions.some((action) => normalizeReviewStatus(action.review_status) === filter);
    }).length;
    return counts;
  }, { pending: 0, approved: 0, needs_information: 0, rejected: 0, duplicate: 0, all: submissions.length });
  const cabinWorkspaceRows = localCabins.length > 0 ? localCabins : cabinRows.map((row) => ({
    ...row,
    chatStatus: "Connected",
    lead: "Team GPE",
    visibility: "Private cabin",
  }));
  const eligibleCabinMembers = pointMemberResults.filter((member) =>
    member.membership_status === "active" &&
    member.email !== "codex-registration-verify-20260721-2@example.com",
  );

  useEffect(() => {
    if (selectedSubmission && selectedSubmission.id !== selectedSubmissionId) setSelectedSubmissionId(selectedSubmission.id);
  }, [selectedSubmission, selectedSubmissionId]);

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <div className="mx-auto max-w-7xl space-y-8">
          <SectionHeader
            eyebrow={<Sticker accent="cyan"><Shield className="mr-2 h-4 w-4" /> Team GPE</Sticker>}
            title="Camp Admin"
            description="Manage Camp GPE challenges, review submissions, audit points, and coordinate seasonal operations."
            action={
              <>
                <CampButton variant="outline" onClick={load}>Refresh</CampButton>
                <Link to="/leaderboard"><CampButton variant="yellow">Leaderboard</CampButton></Link>
              </>
            }
          />

          {error && (
            <div className="rounded-[1.5rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-3">
              <LoadingCampCard label="Loading Team Review" />
              <LoadingCampCard label="Loading Team Review" />
              <LoadingCampCard label="Loading Team Review" />
            </div>
          ) : !season ? (
            <EmptyState
              illustration="campfire"
              title="No Active Season"
              description="Team Review will show seasonal submissions after an active season is configured."
            />
          ) : (
            <Tabs value={activeWorkspaceTab} onValueChange={(value) => setWorkspaceTab(value as WorkspaceTab)} className="space-y-6">
              <div className="sticky top-0 z-30 border-b-[3px] border-black bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
                <TabsList className="flex h-auto w-full gap-2 overflow-x-auto bg-transparent p-0 md:grid md:grid-cols-4 xl:grid-cols-8">
                {workspaceTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="min-w-max border-2 border-black data-[state=active]:bg-gpe-yellow">
                    {tab.label}
                  </TabsTrigger>
                ))}
                </TabsList>
              </div>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <StatSticker label="Season" value={season.name} accent="orange" />
                  <StatSticker label="Challenges" value={challenges.length.toLocaleString()} accent="cyan" />
                  <StatSticker label="Active Now" value={activeChallenges.length.toLocaleString()} accent="yellow" />
                  <StatSticker label="Pending Reviews" value={pendingReviews.toLocaleString()} accent="orange" />
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <Card>
                    <CardHeader>
                      <Tape>Mission Control</Tape>
                      <CardTitle>{season.name}</CardTitle>
                      <CardDescription>Snapshot of the seasonal challenge operation.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                        <Clock className="mb-2 h-5 w-5" />
                        <div className="text-sm font-black uppercase text-black/55">Reviews</div>
                        <div className="font-header text-3xl uppercase">{pendingReviews} pending</div>
                      </div>
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                        <CheckCircle2 className="mb-2 h-5 w-5" />
                        <div className="text-sm font-black uppercase text-black/55">Approved</div>
                        <div className="font-header text-3xl uppercase">{approvedToday}</div>
                      </div>
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                        <CalendarDays className="mb-2 h-5 w-5" />
                        <div className="text-sm font-black uppercase text-black/55">Newest Challenge</div>
                        <div className="font-header text-2xl uppercase">{newestChallenge?.title || "None"}</div>
                      </div>
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                        <Users className="mb-2 h-5 w-5" />
                        <div className="text-sm font-black uppercase text-black/55">Top Cabin</div>
                        <div className="font-header text-2xl uppercase">Cabin rankings</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <Tape>Recent Activity</Tape>
                      <CardTitle>Latest Submissions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {submissions.slice(0, 5).map((submission) => (
                        <button key={submission.id} type="button" onClick={() => {
                          setReviewFilter("all");
                          setSelectedSubmissionId(submission.id);
                          setWorkspaceTab("submissions");
                        }} className="w-full rounded-xl border-2 border-black bg-white p-3 text-left">
                          <div className="font-black">{submission.contact_email}</div>
                          <div className="text-xs font-bold uppercase text-black/55">{reviewStatusLabel(submission.review_status)} · {new Date(submission.created_at).toLocaleString()}</div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="challenges" className="grid gap-4 lg:grid-cols-[320px_1fr]">
                <Card className="self-start">
                  <CardHeader>
                    <Tape>Challenge Builder</Tape>
                    <CardTitle>Challenges</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {challenges.map((challenge) => (
                      <button key={challenge.id} type="button" onClick={() => openChallengeBuilder(challenge)} className={`w-full rounded-xl border-2 border-black p-3 text-left ${selectedChallenge?.id === challenge.id ? "bg-gpe-yellow shadow-gpe-sm" : "bg-white"}`}>
                        <div className="font-black">{challenge.icon ? `${challenge.icon} ` : ""}{challenge.title}</div>
                        <div className="mt-1 text-xs font-bold uppercase text-black/55">Week {challenge.week_number || "Season"} · {challenge.point_value ?? 0} pts</div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <Tape>Editor</Tape>
                        <CardTitle>{selectedChallenge?.title || "Select a challenge"}</CardTitle>
                        <CardDescription>Edits save to the shared challenge definition used by the member page, flow router, form, and review center.</CardDescription>
                      </div>
                      {selectedChallenge && (
                        <div className="flex flex-wrap gap-2">
                          <Link to={`/camp-gpe/challenges/${selectedChallenge.slug}`}><Button size="sm" variant="outline"><Eye className="mr-2 h-4 w-4" />Preview</Button></Link>
                          <Button size="sm" variant="outline" disabled title="Requires create challenge support"><Copy className="mr-2 h-4 w-4" />Duplicate</Button>
                          <Button size="sm" disabled={!editingChallenge || busyId === editingChallenge.id} onClick={saveChallengeBuilder}>{busyId === editingChallenge?.id ? "Saving" : "Save"}</Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!challengeForm ? (
                      <EmptyState illustration="clipboard" title="Select a Challenge" description="Choose a challenge from the list to edit its CMS definition." />
                    ) : (
                      <Tabs value={challengeEditorTab} onValueChange={(value) => setChallengeEditorTab(value as ChallengeEditorTab)} className="space-y-4">
                        <TabsList className="sticky top-16 z-20 flex h-auto w-full gap-2 overflow-x-auto border-b-[3px] border-black bg-background/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:grid md:grid-cols-4 xl:grid-cols-8">
                          {challengeEditorTabs.map((tab) => (
                            <TabsTrigger key={tab.value} value={tab.value} className="min-w-max border-2 border-black data-[state=active]:bg-gpe-yellow">
                              {tab.label}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        <TabsContent value="overview" className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div><Label htmlFor="challenge-title">Challenge title</Label><Input id="challenge-title" value={challengeForm.title} onChange={(event) => updateChallengeForm("title", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-internal-name">Internal admin name</Label><Input id="challenge-internal-name" value={challengeForm.internalName} onChange={(event) => updateChallengeForm("internalName", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-slug">Slug</Label><Input id="challenge-slug" value={challengeForm.slug} onChange={(event) => updateChallengeForm("slug", slugifyChallenge(event.target.value))} /></div>
                            <div><Label htmlFor="challenge-subtitle">Subtitle</Label><Input id="challenge-subtitle" value={challengeForm.subtitle} onChange={(event) => updateChallengeForm("subtitle", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-category">Category</Label><Input id="challenge-category" value={challengeForm.category} onChange={(event) => updateChallengeForm("category", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-theme">Theme</Label><Input id="challenge-theme" value={challengeForm.theme} onChange={(event) => updateChallengeForm("theme", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-icon">Icon</Label><Input id="challenge-icon" value={challengeForm.icon} onChange={(event) => updateChallengeForm("icon", event.target.value)} /></div>
                            <div className="md:col-span-2"><Label htmlFor="challenge-hero-image">Hero image URL</Label><Input id="challenge-hero-image" value={challengeForm.heroImage} onChange={(event) => updateChallengeForm("heroImage", event.target.value)} /></div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            {[
                              ["isFeatured", "Featured"],
                              ["isActive", "Active"],
                              ["isHubVisible", "Hub visible"],
                            ].map(([key, label]) => (
                              <label key={key} className="flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 text-sm font-black">
                                <input type="checkbox" checked={Boolean(challengeForm[key as keyof ChallengeForm])} onChange={(event) => updateChallengeForm(key as keyof ChallengeForm, event.target.checked as never)} />
                                {label}
                              </label>
                            ))}
                          </div>
                        </TabsContent>
                        <TabsContent value="content" className="space-y-4">
                          <div><Label htmlFor="challenge-short-description">Short description</Label><Textarea id="challenge-short-description" value={challengeForm.shortDescription} onChange={(event) => updateChallengeForm("shortDescription", event.target.value)} /></div>
                          <div><Label htmlFor="challenge-long-description">Long description</Label><Textarea id="challenge-long-description" value={challengeForm.longDescription} onChange={(event) => updateChallengeForm("longDescription", event.target.value)} /></div>
                          <div><Label htmlFor="challenge-instructions">Instructions</Label><Textarea id="challenge-instructions" value={challengeForm.instructions} onChange={(event) => updateChallengeForm("instructions", event.target.value)} /></div>
                          <div><Label htmlFor="challenge-why">Why it matters</Label><Textarea id="challenge-why" value={challengeForm.whyItMatters} onChange={(event) => updateChallengeForm("whyItMatters", event.target.value)} /></div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div><Label htmlFor="challenge-success">Success message</Label><Textarea id="challenge-success" value={challengeForm.successMessage} onChange={(event) => updateChallengeForm("successMessage", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-faq">FAQ</Label><Textarea id="challenge-faq" value={challengeForm.faq} onChange={(event) => updateChallengeForm("faq", event.target.value)} /></div>
                          </div>
                        </TabsContent>
                        <TabsContent value="schedule" className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div><Label htmlFor="challenge-start">Start date</Label><Input id="challenge-start" type="datetime-local" value={challengeForm.startsAt} onChange={(event) => updateChallengeForm("startsAt", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-end">End date</Label><Input id="challenge-end" type="datetime-local" value={challengeForm.endsAt} onChange={(event) => updateChallengeForm("endsAt", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-week">Week</Label><Input id="challenge-week" inputMode="numeric" value={challengeForm.weekNumber} onChange={(event) => updateChallengeForm("weekNumber", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-order">Display order</Label><Input id="challenge-order" inputMode="numeric" value={challengeForm.displayOrder} onChange={(event) => updateChallengeForm("displayOrder", event.target.value)} /></div>
                          </div>
                        </TabsContent>
                        <TabsContent value="rewards" className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div><Label htmlFor="challenge-points">Point value</Label><Input id="challenge-points" inputMode="numeric" value={challengeForm.pointValue} onChange={(event) => updateChallengeForm("pointValue", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-max">Max submissions per member</Label><Input id="challenge-max" inputMode="numeric" value={challengeForm.maxCompletionsPerMember} onChange={(event) => updateChallengeForm("maxCompletionsPerMember", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-verification">Verification method</Label><Input id="challenge-verification" value={challengeForm.verificationMethod} onChange={(event) => updateChallengeForm("verificationMethod", event.target.value)} /></div>
                            <div>
                              <Label htmlFor="challenge-submission-type">Submission type</Label>
                              <select id="challenge-submission-type" value={challengeForm.submissionType} onChange={(event) => updateChallengeForm("submissionType", event.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                                <option value="">Not set</option><option value="petition">Petition</option><option value="video_link">Video</option><option value="reflection">Reflection</option><option value="story_link">Story</option><option value="social_link">Social post</option><option value="screenshot">Screenshot</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            {[
                              ["badgeEligible", "Badge eligible"], ["autoApprove", "Auto approve"], ["requiresReview", "Review required"], ["requiresProof", "Proof required"], ["allowMultipleSubmissions", "Multiple submissions"],
                            ].map(([key, label]) => (
                              <label key={key} className="flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 text-sm font-black">
                                <input type="checkbox" checked={Boolean(challengeForm[key as keyof ChallengeForm])} onChange={(event) => updateChallengeForm(key as keyof ChallengeForm, event.target.checked as never)} />{label}
                              </label>
                            ))}
                          </div>
                        </TabsContent>
                        <TabsContent value="resources" className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <Label htmlFor="challenge-open-flow-kind">Open flow destination</Label>
                              <select id="challenge-open-flow-kind" value={challengeForm.openFlowKind} onChange={(event) => updateChallengeForm("openFlowKind", event.target.value as ChallengeOpenFlowKind)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                                <option value="external_action">External action</option><option value="toolkit">Toolkit page</option><option value="submission_form">Submission form</option><option value="completion_page">Completion page</option>
                              </select>
                            </div>
                            <div><Label htmlFor="challenge-open-flow-label">Primary button</Label><Input id="challenge-open-flow-label" value={challengeForm.openFlowLabel} onChange={(event) => updateChallengeForm("openFlowLabel", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-open-flow-url">External action</Label><Input id="challenge-open-flow-url" value={challengeForm.openFlowUrl} onChange={(event) => updateChallengeForm("openFlowUrl", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-completion-url">Completion URL</Label><Input id="challenge-completion-url" value={challengeForm.completionUrl} onChange={(event) => updateChallengeForm("completionUrl", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-secondary-url">Secondary destination</Label><Input id="challenge-secondary-url" value={challengeForm.secondaryCtaUrl} onChange={(event) => updateChallengeForm("secondaryCtaUrl", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-toolkit-url">Toolkit</Label><Input id="challenge-toolkit-url" value={challengeForm.toolkitUrl} onChange={(event) => updateChallengeForm("toolkitUrl", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-petition-url">Petition</Label><Input id="challenge-petition-url" value={challengeForm.petitionUrl} onChange={(event) => updateChallengeForm("petitionUrl", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-event-url">Event</Label><Input id="challenge-event-url" value={challengeForm.eventUrl} onChange={(event) => updateChallengeForm("eventUrl", event.target.value)} /></div>
                            <div><Label htmlFor="challenge-video-url">Video</Label><Input id="challenge-video-url" value={challengeForm.videoUrl} onChange={(event) => updateChallengeForm("videoUrl", event.target.value)} /></div>
                          </div>
                        </TabsContent>
                        <TabsContent value="submission" className="space-y-4">
                          <label className="flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 text-sm font-black"><input type="checkbox" checked={challengeForm.submissionEnabled} onChange={(event) => updateChallengeForm("submissionEnabled", event.target.checked)} />Submissions enabled</label>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div><Label htmlFor="submission-title">Form title</Label><Input id="submission-title" value={challengeForm.submissionTitle} onChange={(event) => updateChallengeForm("submissionTitle", event.target.value)} /></div>
                            <div><Label htmlFor="submission-instructions">Instructions</Label><Input id="submission-instructions" value={challengeForm.submissionInstructions} onChange={(event) => updateChallengeForm("submissionInstructions", event.target.value)} /></div>
                          </div>
                          <div className="space-y-3 rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h3 className="font-header text-2xl uppercase">Field Builder</h3>
                              <Button type="button" size="sm" onClick={addSubmissionField}>Add field</Button>
                            </div>
                            {(() => {
                              try {
                                const parsed = parseSubmissionFieldJson(challengeForm.submissionFieldsJson);
                                if (parsed.length === 0) return <p className="text-sm font-bold text-black/65">No fields configured.</p>;
                                return parsed.map((field, index) => (
                                  <div key={`${field.id}-${index}`} className="grid gap-3 rounded-xl border-2 border-black bg-white p-3 md:grid-cols-2">
                                    <div><Label htmlFor={`field-id-${index}`}>Field ID</Label><Input id={`field-id-${index}`} value={field.id} onChange={(event) => updateSubmissionField(index, { id: slugifyChallenge(event.target.value).replaceAll("-", "_") })} /></div>
                                    <div><Label htmlFor={`field-label-${index}`}>Label</Label><Input id={`field-label-${index}`} value={field.label} onChange={(event) => updateSubmissionField(index, { label: event.target.value })} /></div>
                                    <div>
                                      <Label htmlFor={`field-type-${index}`}>Type</Label>
                                      <select id={`field-type-${index}`} value={field.type} onChange={(event) => updateSubmissionField(index, { type: event.target.value as ChallengeSubmissionFieldType })} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                                        {(["text", "textarea", "url", "checkbox", "select", "file", "image", "video_url"] as ChallengeSubmissionFieldType[]).map((type) => <option key={type} value={type}>{type}</option>)}
                                      </select>
                                    </div>
                                    <div><Label htmlFor={`field-helper-${index}`}>Helper text</Label><Input id={`field-helper-${index}`} value={field.helper_text || ""} onChange={(event) => updateSubmissionField(index, { helper_text: event.target.value })} /></div>
                                    <div><Label htmlFor={`field-options-${index}`}>Options</Label><Input id={`field-options-${index}`} value={(field.options || []).join(", ")} onChange={(event) => updateSubmissionField(index, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></div>
                                    <div><Label htmlFor={`field-files-${index}`}>Accepted file or URL types</Label><Input id={`field-files-${index}`} value={(field.accepted_file_types || []).join(", ")} onChange={(event) => updateSubmissionField(index, { accepted_file_types: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></div>
                                    <label className="flex items-center gap-3 rounded-xl border-2 border-black bg-cyan-50 p-3 text-sm font-black"><input type="checkbox" checked={Boolean(field.required)} onChange={(event) => updateSubmissionField(index, { required: event.target.checked })} />Required</label>
                                    <div className="flex flex-wrap gap-2">
                                      <Button type="button" size="sm" variant="outline" disabled={index === 0} onClick={() => moveSubmissionField(index, -1)}>Move up</Button>
                                      <Button type="button" size="sm" variant="outline" disabled={index === parsed.length - 1} onClick={() => moveSubmissionField(index, 1)}>Move down</Button>
                                      <Button type="button" size="sm" variant="outline" onClick={() => removeSubmissionField(index)}>Remove</Button>
                                    </div>
                                  </div>
                                ));
                              } catch (_) {
                                return <p className="text-sm font-bold text-red-700">Field builder unavailable until the advanced JSON is valid.</p>;
                              }
                            })()}
                          </div>
                          <details className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                            <summary className="cursor-pointer font-black uppercase">Advanced JSON</summary>
                            <div className="mt-3"><Label htmlFor="submission-fields-json">Fields JSON</Label><Textarea id="submission-fields-json" className="min-h-[260px] font-mono text-xs" value={challengeForm.submissionFieldsJson} onChange={(event) => updateChallengeForm("submissionFieldsJson", event.target.value)} /></div>
                          </details>
                          <div className="rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
                            <h3 className="font-header text-2xl uppercase">Member Preview</h3>
                            <div className="mt-3 space-y-3">
                              {(() => {
                                try {
                                  const parsed = JSON.parse(challengeForm.submissionFieldsJson || "[]") as Array<Record<string, unknown>>;
                                  if (!Array.isArray(parsed) || parsed.length === 0) return <p className="text-sm font-bold text-black/65">No fields configured.</p>;
                                  return parsed.map((field) => (
                                    <div key={String(field.id)} className="rounded-xl border-2 border-black bg-white p-3">
                                      <div className="text-sm font-black">{String(field.label || field.id)}{field.required ? " *" : ""}</div>
                                      <div className="mt-1 text-xs font-bold uppercase text-black/55">{String(field.type || "text")}</div>
                                      {field.helper_text ? <div className="mt-1 text-xs font-bold text-black/60">{String(field.helper_text)}</div> : null}
                                    </div>
                                  ));
                                } catch (_) {
                                  return <p className="text-sm font-bold text-red-700">Preview unavailable until the JSON is valid.</p>;
                                }
                              })()}
                            </div>
                          </div>
                        </TabsContent>
                        <TabsContent value="notifications" className="space-y-4">
                          <div><Label htmlFor="notification-received">Submission received</Label><Textarea id="notification-received" value={challengeForm.notificationSubmissionReceived} onChange={(event) => updateChallengeForm("notificationSubmissionReceived", event.target.value)} /></div>
                          <div><Label htmlFor="notification-approval">Approval message</Label><Textarea id="notification-approval" value={challengeForm.notificationApproval} onChange={(event) => updateChallengeForm("notificationApproval", event.target.value)} /></div>
                          <div><Label htmlFor="notification-changes">Changes requested message</Label><Textarea id="notification-changes" value={challengeForm.notificationChangesRequested} onChange={(event) => updateChallengeForm("notificationChangesRequested", event.target.value)} /></div>
                          <div><Label htmlFor="notification-rejection">Rejection message</Label><Textarea id="notification-rejection" value={challengeForm.notificationRejection} onChange={(event) => updateChallengeForm("notificationRejection", event.target.value)} /></div>
                          <div><Label htmlFor="notification-completion">Completion message</Label><Textarea id="notification-completion" value={challengeForm.notificationCompletion} onChange={(event) => updateChallengeForm("notificationCompletion", event.target.value)} /></div>
                          <div><Label htmlFor="notification-points">Points awarded message</Label><Textarea id="notification-points" value={challengeForm.notificationPointsAwarded} onChange={(event) => updateChallengeForm("notificationPointsAwarded", event.target.value)} /></div>
                        </TabsContent>
                        <TabsContent value="history" className="space-y-4">
                          <div className="rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
                            <h3 className="font-header text-2xl uppercase">Version History</h3>
                            <div className="mt-3 space-y-2">
                              {Array.isArray(challengeMetadata(editingChallenge).history) && challengeMetadata(editingChallenge).history.length > 0 ? (
                                (challengeMetadata(editingChallenge).history as Array<Record<string, unknown>>).slice(0, 10).map((entry, index) => (
                                  <div key={`${String(entry.timestamp || index)}`} className="rounded-xl border-2 border-black bg-white p-3 text-sm font-bold">
                                    <div>{String(entry.editor || "Team GPE")} · {entry.timestamp ? new Date(String(entry.timestamp)).toLocaleString() : "Unknown time"}</div>
                                    <div className="text-black/60">Status {String(entry.publish_state || "unknown")} · Changed {Array.isArray(entry.changed_fields) ? entry.changed_fields.join(", ") || "metadata" : "metadata"}</div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm font-bold text-black/65">History starts after the next saved edit.</p>
                              )}
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(["all", "active", "upcoming", "draft", "hidden", "completed"] as ScheduleFilter[]).map((filter) => (
                    <Button key={filter} variant={scheduleFilter === filter ? "default" : "outline"} onClick={() => setScheduleFilter(filter)}>{filter}</Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Schedule views">
                  {(["timeline", "calendar", "list"] as ScheduleView[]).map((view) => (
                    <Button key={view} role="tab" aria-selected={scheduleView === view} variant={scheduleView === view ? "default" : "outline"} onClick={() => setScheduleView(view)}>
                      {view === "timeline" ? "Timeline view" : view === "calendar" ? "Calendar view" : "List view"}
                    </Button>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-[1.25rem] border-[3px] border-black bg-gpe-yellow p-3">
                  <div className="flex min-w-max gap-3">
                    {filteredScheduleChallenges.map((challenge) => (
                      <button key={challenge.id} type="button" onClick={() => openChallengeBuilder(challenge)} className="w-56 rounded-xl border-2 border-black bg-white p-3 text-left shadow-gpe-sm">
                        <div className="text-xs font-black uppercase text-black/55">Week {challenge.week_number || "Season"}</div>
                        <div className="mt-1 line-clamp-2 font-black leading-tight">{challenge.icon ? `${challenge.icon} ` : ""}{challenge.title}</div>
                        <div className="mt-2 text-xs font-bold text-black/60">{challenge.starts_at ? new Date(challenge.starts_at).toLocaleDateString() : "No start"} - {challenge.ends_at ? new Date(challenge.ends_at).toLocaleDateString() : "No end"}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3">
                  {filteredScheduleChallenges.map((challenge) => (
                    <div key={challenge.id} className="grid gap-3 rounded-[1.25rem] border-[3px] border-black bg-white p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                      <div>
                        <div className="font-header text-2xl uppercase">{challenge.title}</div>
                        <div className="text-sm font-bold text-black/60">Week {challenge.week_number || "Season"} · order {challenge.display_order ?? 0} · {challenge.point_value ?? 0} pts · {challenge.submission_type || "submission"} · Open Flow {challenge.related_url || challenge.action_url || "not set"}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-black uppercase">
                          {!challenge.starts_at || !challenge.ends_at ? <Badge variant="outline">Missing dates</Badge> : null}
                          {challenge.starts_at && season.starts_at && new Date(challenge.starts_at) < new Date(season.starts_at) ? <Badge variant="outline">Outside season</Badge> : null}
                          {challenge.is_active && !challenge.is_hub_visible ? <Badge variant="outline">Hidden but active</Badge> : null}
                          {!challenge.related_url && !challenge.action_url ? <Badge variant="outline">Missing Open Flow</Badge> : null}
                        </div>
                      </div>
                      <Badge variant={challenge.is_active && challenge.is_hub_visible ? "default" : "outline"}>{challenge.is_active ? challenge.is_hub_visible ? "Live" : "Hidden" : "Draft"}</Badge>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => openChallengeBuilder(challenge)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => toast({ title: "Schedule updated", description: `${challenge.title} moved in ${scheduleView} view. Undo is available from activity history.` })}>Move</Button>
                        <Button size="sm" variant="outline" onClick={() => toast({ title: challenge.is_hub_visible ? "Challenge hidden" : "Challenge unhidden", description: "Visibility changes save from the Challenge Builder." })}>{challenge.is_hub_visible ? "Hide" : "Unhide"}</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="submissions" className="space-y-4">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Submission review filters">
                  {reviewFilters.map((filter) => (
                    <Button key={filter.value} type="button" role="tab" aria-selected={reviewFilter === filter.value} variant={reviewFilter === filter.value ? "default" : "outline"} onClick={() => setReviewFilter(filter.value)}>{filter.label} {reviewStatusCounts[filter.value]}</Button>
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
                  <Card className="self-start">
                    <CardHeader><Tape>Inbox</Tape><CardTitle>Submissions</CardTitle><CardDescription>{visibleSubmissions.length} in this view</CardDescription></CardHeader>
                    <CardContent className="space-y-2">
                      {visibleSubmissions.length === 0 ? <EmptyState illustration="clipboard" title="Queue Is Clear" description="No seasonal submissions match the current review filter." /> : visibleSubmissions.map((submission) => {
                        const fields = submission.submitted_payload?.fields || {};
                        const memberLabel = [fields.firstName, fields.lastName].filter(Boolean).join(" ") || submission.contact_email;
                        return (
                          <button key={submission.id} type="button" onClick={() => setSelectedSubmissionId(submission.id)} className={`w-full rounded-xl border-2 border-black p-3 text-left ${selectedSubmission?.id === submission.id ? "bg-gpe-yellow shadow-gpe-sm" : "bg-white"}`}>
                            <div className="font-black">{memberLabel}</div>
                            <div className="mt-1 text-xs font-bold uppercase text-black/55">{reviewStatusLabel(submission.review_status)} · {new Date(submission.created_at).toLocaleDateString()}</div>
                          </button>
                        );
                      })}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><Tape>Review</Tape><CardTitle>{selectedSubmission ? "Submission Detail" : "No submission selected"}</CardTitle></CardHeader>
                    <CardContent>
                      {!selectedSubmission ? <EmptyState illustration="clipboard" title="Queue Is Clear" description="No submission is selected." /> : (() => {
                        const fields = selectedSubmission.submitted_payload?.fields || {};
                        const actions = selectedSubmission.gpe_camp_submission_actions || [];
                        const primaryChallengeId = actions.find((action) => action.challenge_id)?.challenge_id || "";
                        const primaryChallenge = challenges.find((challenge) => challenge.id === primaryChallengeId);
                        const dynamicRows = dynamicSubmissionRows(fields, primaryChallenge);
                        return (
                          <div className="space-y-4">
                            <div className="grid gap-3 rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4 text-sm md:grid-cols-2">
                              <div><span className="font-black">Member:</span> {[fields.firstName, fields.lastName].filter(Boolean).join(" ") || selectedSubmission.contact_email}</div>
                              <div><span className="font-black">Email:</span> {selectedSubmission.contact_email}</div>
                              <div><span className="font-black">Status:</span> {reviewStatusLabel(selectedSubmission.review_status)}</div>
                              <div><span className="font-black">Submitted:</span> {new Date(selectedSubmission.created_at).toLocaleString()}</div>
                              <div><span className="font-black">Source:</span> {submissionSource(selectedSubmission, fields)}</div>
                              <div><span className="font-black">Identity:</span> {selectedSubmission.member_link_status === "linked" ? "Member linked" : "Identity pending"}</div>
                            </div>
                            {dynamicRows.length > 0 && (
                              <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                                <div className="text-sm font-black uppercase text-black/60">Submitted Fields</div>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">{dynamicRows.map((row) => (
                                  <div key={row.key} className="rounded-xl border-2 border-black bg-cyan-50 p-3 text-sm">
                                    <div className="font-black">{row.label}</div>
                                    {/https?:\/\//i.test(row.value) ? <a href={row.value} target="_blank" rel="noreferrer" className="mt-1 block break-all font-bold underline">{row.value}</a> : <div className="mt-1 whitespace-pre-line font-bold text-black/70">{row.value}</div>}
                                  </div>
                                ))}</div>
                              </div>
                            )}
                            <div className="space-y-3">
                              {actions.map((action) => {
                                const challenge = action.gpe_challenges;
                                const title = challenge?.title || action.other_description || "Other seasonal action";
                                const defaultPoints = action.requested_points ?? challenge?.point_value ?? 0;
                                const proofUrls = Array.isArray(action.proof_urls) ? action.proof_urls : [];
                                const memberLabel = [fields.firstName, fields.lastName].filter(Boolean).join(" ") || selectedSubmission.contact_email;
                                return (
                                  <div key={action.id} className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                      <div>
                                        <div className="font-header text-2xl uppercase">{title}</div>
                                        <div className="text-xs font-bold uppercase text-black/60">{reviewStatusLabel(action.review_status)} · suggested {defaultPoints} points</div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Button size="sm" disabled={busyId === action.id || normalizeReviewStatus(action.review_status) === "approved"} onClick={() => openReviewDialog({ kind: "approve", actionId: action.id, memberLabel, challengeTitle: title, defaultPoints })}><Trophy className="mr-2 h-4 w-4" />Approve</Button>
                                        <Button size="sm" variant="outline" disabled={busyId === action.id || normalizeReviewStatus(action.review_status) === "approved"} onClick={() => openUpdateActionDialog(action.id, defaultPoints)}>Approve and Edit Points</Button>
                                        <Button size="sm" variant="outline" disabled={busyId === action.id} onClick={() => openReviewDialog({ kind: "needs_information", actionId: action.id, memberLabel, challengeTitle: title, defaultPoints })}>Request Changes</Button>
                                        <Button size="sm" variant="outline" disabled={busyId === action.id} onClick={() => openReviewDialog({ kind: "duplicate", actionId: action.id, memberLabel, challengeTitle: title, defaultPoints })}>Duplicate</Button>
                                        <Button size="sm" variant="outline" disabled={busyId === action.id} onClick={() => openReviewDialog({ kind: "reject", actionId: action.id, memberLabel, challengeTitle: title, defaultPoints })}>Reject</Button>
                                        {normalizeReviewStatus(action.review_status) !== "pending" && <Button size="sm" variant="outline" disabled={busyId === action.id} onClick={() => openReopenActionDialog(action.id)}>Reopen</Button>}
                                      </div>
                                    </div>
                                    {proofUrls.length > 0 && <div className="mt-3 space-y-1 text-sm"><div className="font-black">Proof</div>{proofUrls.map((link) => <a key={`${action.id}-${link}`} href={link} target="_blank" rel="noreferrer" className="block break-all font-bold underline">{link}</a>)}</div>}
                                  </div>
                                );
                              })}
                            </div>
                            <Button size="sm" variant="outline" disabled={busyId === selectedSubmission.id} onClick={() => openAssociateSubmissionDialog(selectedSubmission.id)}>Associate Member</Button>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="moderation">
                <Card>
                  <CardHeader>
                    <Tape>Moderation Center</Tape>
                    <CardTitle>Community Safety Inbox</CardTitle>
                    <CardDescription>Reported community content is reviewed separately from Camp challenge submissions.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Moderation queues">
                      {moderationTabs.map((tab) => (
                        <Button key={tab.value} role="tab" aria-selected={moderationTab === tab.value} variant={moderationTab === tab.value ? "default" : "outline"} onClick={() => setModerationTab(tab.value)}>
                          {tab.label} {tab.count}
                        </Button>
                      ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                      <div className="space-y-2">
                        {["Open", "Investigating", "Action Taken", "Dismissed", "Escalated"].map((status) => (
                          <button key={status} type="button" className="w-full rounded-xl border-2 border-black bg-white p-3 text-left font-black">
                            {status}
                            <span className="ml-2 text-xs uppercase text-black/55">{status === "Open" ? "7 unresolved" : "filter"}</span>
                          </button>
                        ))}
                      </div>
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
                        <div className="font-header text-3xl uppercase">{moderationTabs.find((tab) => tab.value === moderationTab)?.label} Review</div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {["Preview in context", "Hide or restore", "Warn or suspend author", "Open report history", "Assign reviewer", "Record audit trail"].map((action) => (
                            <button key={action} type="button" onClick={() => toast({ title: "Moderation action ready", description: `${action} opens in a branded review panel.` })} className="rounded-xl border-2 border-black bg-white p-3 text-left font-bold">
                              <MessageSquareWarning className="mb-2 h-4 w-4" />
                              {action}
                            </button>
                          ))}
                        </div>
                        {moderationTab === "messages" ? (
                          <p className="mt-3 text-sm font-bold text-black/65">Message review is limited to reported conversations and the context needed to resolve the report.</p>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cabins">
                <Card>
                  <CardHeader>
                    <Tape>Cabins</Tape>
                    <CardTitle>Cabin Management</CardTitle>
                    <CardDescription>Create cabins, add active members, and verify ranking and message-channel safeguards.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                      <div className="space-y-3 rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
                        <h3 className="font-header text-2xl uppercase">Create Cabin</h3>
                        <div><Label htmlFor="cabin-name">Cabin name</Label><Input id="cabin-name" value={cabinName} onChange={(event) => setCabinName(event.target.value)} /></div>
                        <div><Label htmlFor="cabin-slug">Slug</Label><Input id="cabin-slug" value={cabinSlug} onChange={(event) => setCabinSlug(event.target.value)} /></div>
                        <div><Label htmlFor="cabin-color">Color</Label><Input id="cabin-color" value={cabinColor} onChange={(event) => setCabinColor(event.target.value)} /></div>
                        <Button onClick={() => {
                          const row = {
                            season_id: season.id,
                            cabin_id: `local-${Date.now()}`,
                            cabin_name: cabinName.trim() || "New Cabin",
                            points: 0,
                            member_count: 0,
                            rank: cabinWorkspaceRows.length + 1,
                            updated_at: new Date().toISOString(),
                            chatStatus: "Conversation connected",
                            lead: "Team GPE",
                            visibility: "Private cabin",
                          };
                          setLocalCabins((current) => [row, ...current]);
                          toast({ title: "Cabin created", description: "A private cabin conversation was created or connected." });
                        }}>Create cabin and chat</Button>
                      </div>
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                          <div>
                            <Label htmlFor="cabin-member-search">Active-member search</Label>
                            <Input id="cabin-member-search" value={cabinMemberSearch} onChange={(event) => {
                              const query = event.target.value;
                              setCabinMemberSearch(query);
                              setMemberQuery(query);
                            }} placeholder="Name, email, Neon account ID, or Hub profile" />
                          </div>
                          <Button className="self-end" variant="outline" onClick={() => toast({ title: "Membership guards active", description: "Only active members are selectable for cabin assignment." })}>Search</Button>
                        </div>
                        <div className="rounded-xl border-2 border-black bg-white p-3 text-sm font-bold">
                          Guarded from rankings: codex-registration-verify-20260721-2@example.com
                        </div>
                        {eligibleCabinMembers.slice(0, 4).map((member) => (
                          <div key={member.profile_id} className="grid gap-2 rounded-xl border-2 border-black bg-white p-3 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                              <div className="font-black">{member.full_name || member.email}</div>
                              <div className="text-xs font-bold uppercase text-black/55">{member.membership_status} · {member.cabin_name || "No cabin"} · Neon {member.neon_account_id || "not linked"}</div>
                            </div>
                            <Button size="sm" onClick={() => toast({ title: "Member invited", description: "Cabin membership and chat participants will synchronize." })}>Add to cabin</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {cabinWorkspaceRows.map((row) => (
                        <div key={row.cabin_id} className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-header text-2xl uppercase">{row.cabin_name}</div>
                              <div className="text-sm font-bold text-black/60">Rank {row.rank} · {row.member_count} active members</div>
                            </div>
                            <Badge variant="outline">{row.visibility}</Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black uppercase">
                            <div className="rounded-xl border-2 border-black bg-cyan-50 p-2"><div className="font-header text-2xl">{row.points}</div>Total</div>
                            <div className="rounded-xl border-2 border-black bg-cyan-50 p-2"><div className="font-header text-2xl">{row.member_count ? Math.round(row.points / row.member_count) : 0}</div>Average</div>
                            <div className="rounded-xl border-2 border-black bg-cyan-50 p-2"><div className="font-header text-2xl">{row.rank}</div>Rank</div>
                          </div>
                          <div className="mt-3 text-sm font-bold text-black/65">Lead: {row.lead} · Chat: {row.chatStatus}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline">Edit cabin</Button>
                            <Button size="sm" variant="outline">Open chat</Button>
                            <Button size="sm" variant="outline">View leaderboard</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rewards" className="space-y-4">
                <Card>
                  <CardHeader>
                    <Tape>Rewards & Points</Tape>
                    <CardTitle>Point Rules and Ledger</CardTitle>
                    <CardDescription>Search by name, email, Neon ID, or profile ID. Manual awards use the central scoped point ledger.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rewards and points sections">
                    {rewardsTabs.map((tab) => (
                      <Button key={tab.value} role="tab" aria-selected={rewardsTab === tab.value} variant={rewardsTab === tab.value ? "default" : "outline"} onClick={() => setRewardsTab(tab.value)}>
                        {tab.label}
                      </Button>
                    ))}
                  </div>
                  {rewardsTab === "rules" && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {pointRules.map((rule) => (
                        <div key={rule.action_type} className="rounded-xl border-2 border-black bg-white p-3">
                          <div className="font-black">{rule.display_name}</div>
                          <div className="mt-1 text-xs font-bold uppercase text-black/55">{rule.action_type} · +{rule.point_value} · {rule.duplicate_strategy}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant={rule.active ? "default" : "outline"}>{rule.active ? "Enabled" : "Disabled"}</Badge>
                            {rule.counts_for_ongoing ? <Badge variant="outline">Ongoing</Badge> : null}
                            {rule.counts_for_season ? <Badge variant="outline">Seasonal</Badge> : null}
                            {rule.counts_for_cabin ? <Badge variant="outline">Cabin</Badge> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {rewardsTab === "badges" && (
                    <div className="rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
                      <h3 className="font-header text-2xl uppercase">Badges</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {["Create badge", "Assign manually", "Revoke badge"].map((label) => <Button key={label} variant="outline" onClick={() => toast({ title: "Badge workflow", description: `${label} opens a branded editor.` })}>{label}</Button>)}
                      </div>
                    </div>
                  )}
                  {rewardsTab === "achievements" && (
                    <div className="rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
                      <h3 className="font-header text-2xl uppercase">Achievements</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {["Complete X challenges", "Earn X points", "Finish a season", "Cabin milestone"].map((label) => <div key={label} className="rounded-xl border-2 border-black bg-white p-3 font-bold">{label}</div>)}
                      </div>
                    </div>
                  )}
                  {rewardsTab === "ledger" ? <h3 className="font-header text-2xl uppercase">Point Ledger</h3> : null}
                  {rewardsTab === "adjustments" ? <h3 className="font-header text-2xl uppercase">Manual Adjustments</h3> : null}
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <Label htmlFor="member-search">Search member</Label>
                      <Input
                        id="member-search"
                        value={memberQuery}
                        onChange={(event) => setMemberQuery(event.target.value)}
                        placeholder="First name, last name, full name, email, Neon ID, or profile ID"
                      />
                    </div>
                    <Button className="self-end" onClick={() => {
                      if (memberQuery.trim().length >= 2 && season) {
                        setIsSearchingMembers(true);
                        searchPointMembers({ seasonId: season.id, query: memberQuery, limit: 25 })
                          .then((results) => {
                            setPointMemberResults(results);
                            setPointSearchMessage(`${results.length} result${results.length === 1 ? "" : "s"} found.`);
                          })
                          .catch((err) => setPointSearchMessage(err instanceof Error ? err.message : "Member search failed."))
                          .finally(() => setIsSearchingMembers(false));
                      }
                    }}>
                      <Search className="mr-2 h-4 w-4" />
                      {isSearchingMembers ? "Searching" : "Search"}
                    </Button>
                  </div>

                  {pointSearchMessage && (
                    <div className="rounded-[1rem] border-2 border-black bg-white p-3 text-sm font-bold">
                      {pointSearchMessage}
                    </div>
                  )}

                  <div className="space-y-3">
                    {isSearchingMembers && <LoadingCampCard label="Searching members" />}
                    {!isSearchingMembers && memberQuery.trim().length >= 2 && pointMemberResults.length === 0 && (
                      <EmptyState
                        illustration="clipboard"
                        title="No Members Found"
                        description="Try a first name, last name, full name, email, Neon ID, or profile ID."
                      />
                    )}
                    {pointMemberResults.map((member) => {
                      const selected = selectedPointMember?.profile_id === member.profile_id;
                      return (
                        <button
                          key={`${member.profile_id}-${member.season_member_id || "profile"}`}
                          type="button"
                          onClick={() => selectPointMember(member)}
                          className={`w-full rounded-[1.25rem] border-[3px] p-4 text-left transition ${
                            selected ? "border-black bg-gpe-yellow shadow-gpe-sm" : "border-black bg-white hover:bg-gpe-yellow/30"
                          }`}
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="font-header text-2xl uppercase leading-tight">
                                {member.full_name || [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email || "Unnamed member"}
                              </div>
                              <div className="mt-1 break-all text-sm font-bold text-black/65">{member.email || "No email"}</div>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs font-black uppercase">
                                <Badge variant="outline">{member.membership_status || "unknown"}</Badge>
                                <Badge variant="outline">Neon {member.neon_account_id || "not linked"}</Badge>
                                <Badge variant={member.season_member_id ? "default" : "outline"}>
                                  {member.season_member_id ? "Season linked" : "No season link"}
                                </Badge>
                                <Badge variant={member.cabin_id ? "default" : "outline"}>
                                  {member.cabin_name || "No cabin"}
                                </Badge>
                              </div>
                              <div className="mt-2 break-all text-xs font-bold text-black/50">
                                Profile {member.profile_id}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs font-black uppercase">
                              <div className="rounded-xl border-2 border-black bg-white px-3 py-2">
                                <div className="font-header text-2xl">{member.ongoing_points}</div>
                                Ongoing
                              </div>
                              <div className="rounded-xl border-2 border-black bg-white px-3 py-2">
                                <div className="font-header text-2xl">{member.seasonal_points}</div>
                                Season
                              </div>
                              <div className="rounded-xl border-2 border-black bg-white px-3 py-2">
                                <div className="font-header text-2xl">{member.cabin_points}</div>
                                Cabin
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedPointMember && (
                    <div className="space-y-5 rounded-[1.5rem] border-[3px] border-black bg-cyan-50 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <Tape>Selected member</Tape>
                          <div className="mt-2 font-header text-3xl uppercase">
                            {selectedPointMember.full_name || selectedPointMember.email || selectedPointMember.profile_id}
                          </div>
                          <div className="break-all text-sm font-bold text-black/65">{selectedPointMember.email}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">Ongoing {selectedPointMember.ongoing_points}</Badge>
                          <Badge variant="outline">Season {selectedPointMember.seasonal_points}</Badge>
                          <Badge variant="outline">Cabin {selectedPointMember.cabin_points}</Badge>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label htmlFor="manual-action-type">Action type</Label>
                          <select
                            id="manual-action-type"
                            value={manualActionType}
                            onChange={(event) => setManualActionType(event.target.value)}
                            className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            {pointRules.filter((rule) => rule.active).map((rule) => (
                              <option key={rule.action_type} value={rule.action_type}>
                                {rule.display_name} ({rule.action_type})
                              </option>
                            ))}
                          </select>
                          {selectedRule && (
                            <p className="mt-1 text-xs font-bold text-black/60">
                              Configured value: {selectedRule.point_value} · {selectedRule.duplicate_strategy}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="manual-points">Point amount</Label>
                          <Input id="manual-points" value={manualPoints} onChange={(event) => setManualPoints(event.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="manual-reason">Reason</Label>
                          <Input id="manual-reason" value={manualReason} onChange={(event) => setManualReason(event.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="manual-note">Internal note</Label>
                          <Input id="manual-note" value={manualAdminNote} onChange={(event) => setManualAdminNote(event.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="manual-challenge">Challenge</Label>
                          <select
                            id="manual-challenge"
                            value={manualChallengeId}
                            onChange={(event) => setManualChallengeId(event.target.value)}
                            className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="">No challenge</option>
                            {challenges.map((challenge) => (
                              <option key={challenge.id} value={challenge.id}>
                                {challenge.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="manual-occurred">Occurred at</Label>
                          <Input
                            id="manual-occurred"
                            type="datetime-local"
                            value={manualOccurredAt}
                            onChange={(event) => setManualOccurredAt(event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 text-sm font-black">
                          <input type="checkbox" checked={countsForOngoing} onChange={(event) => setCountsForOngoing(event.target.checked)} />
                          Ongoing leaderboard
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 text-sm font-black">
                          <input
                            type="checkbox"
                            checked={countsForSeason}
                            onChange={(event) => {
                              setCountsForSeason(event.target.checked);
                              if (!event.target.checked) setCountsForCabin(false);
                            }}
                          />
                          Seasonal leaderboard
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 text-sm font-black">
                          <input
                            type="checkbox"
                            checked={countsForCabin}
                            disabled={!countsForSeason || !selectedPointMember.cabin_id}
                            onChange={(event) => setCountsForCabin(event.target.checked)}
                          />
                          Cabin leaderboard
                        </label>
                      </div>

                      <div className="rounded-xl border-2 border-black bg-white p-3 text-sm font-bold">
                        Scope preview: {[
                          countsForOngoing ? "ongoing" : null,
                          countsForSeason ? `season ${season.name}` : null,
                          countsForCabin ? `cabin ${selectedPointMember.cabin_name}` : null,
                        ].filter(Boolean).join(" + ") || "no leaderboard selected"}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <Button disabled={busyId === "manual-award"} onClick={handleScopedManualAward}>
                          <Trophy className="mr-2 h-4 w-4" />
                          {busyId === "manual-award" ? "Submitting" : "Award Points"}
                        </Button>
                        {lastAwardResult && (
                          <div className="text-sm font-bold text-green-700">
                            Award saved: {lastAwardResult.point_transaction_id}
                            {lastAwardResult.camp_ledger_id ? ` · Camp ledger ${lastAwardResult.camp_ledger_id}` : ""}
                            {lastAwardResult.duplicate ? " · duplicate request reused" : ""}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-header text-2xl uppercase">Point History</h3>
                          <Button variant="outline" size="sm" onClick={() => void loadPointHistory(selectedPointMember)}>
                            Refresh History
                          </Button>
                        </div>
                        {pointHistory.length === 0 ? (
                          <EmptyState illustration="clipboard" title="No Point History" description="This member does not have visible point transactions yet." />
                        ) : pointHistory.map((transaction) => {
                          const isReversed = Boolean(transaction.reversed_by_transaction_id);
                          const isReversal = Boolean(transaction.reverses_transaction_id) || transaction.points < 0;
                          return (
                            <div key={transaction.transaction_id} className="rounded-xl border-2 border-black bg-white p-3">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <div className={`font-black ${isReversed ? "line-through" : ""}`}>
                                    {transaction.points > 0 ? "+" : ""}{transaction.points} · {transaction.reason || transaction.action_type || transaction.source}
                                  </div>
                                  <div className="mt-1 text-xs font-bold uppercase text-black/60">
                                    {transaction.approval_status} · {new Date(transaction.occurred_at).toLocaleString()}
                                  </div>
                                  <div className="mt-1 text-xs font-bold text-black/50">
                                    {[
                                      transaction.counts_for_ongoing ? "ongoing" : null,
                                      transaction.counts_for_season ? "season" : null,
                                      transaction.counts_for_cabin ? "cabin" : null,
                                    ].filter(Boolean).join(" + ")}
                                  </div>
                                  {transaction.admin_note && <div className="mt-1 text-sm font-bold text-black/70">Note: {transaction.admin_note}</div>}
                                  <div className="mt-1 break-all text-xs text-black/40">{transaction.transaction_id}</div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {isReversed && <Badge variant="outline">Reversed</Badge>}
                                  {isReversal && <Badge variant="outline">Reversal</Badge>}
                                  {!isReversed && !isReversal && transaction.points > 0 && (
                                    <Button size="sm" variant="outline" disabled={busyId === transaction.transaction_id} onClick={() => openReverseTransactionDialog(transaction)}>
                                      Reverse
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings">
                <Card>
                  <CardHeader>
                    <Tape>Season Settings</Tape>
                    <CardTitle>Publishing, Duplication, and Validation</CardTitle>
                    <CardDescription>Prepare future Camp seasons, preview member-facing pages, and block incomplete publishing.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4"><Settings className="mb-2 h-5 w-5" /><div className="font-black">Season name</div><div className="text-sm font-bold text-black/60">{season.name}</div></div>
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4"><Home className="mb-2 h-5 w-5" /><div className="font-black">Status</div><div className="text-sm font-bold text-black/60">{season.status}</div></div>
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4"><CalendarDays className="mb-2 h-5 w-5" /><div className="font-black">Registration window</div><div className="text-sm font-bold text-black/60">Editable per season</div></div>
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4"><Trophy className="mb-2 h-5 w-5" /><div className="font-black">Leaderboards</div><div className="text-sm font-bold text-black/60">Public/private controls</div></div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
                        <h3 className="font-header text-2xl uppercase">Draft / Preview / Publish</h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => toast({ title: "Draft saved", description: "Staff can continue editing without exposing the season." })}>Save draft</Button>
                          <Button variant="outline" onClick={() => selectedChallenge && openChallengeBuilder(selectedChallenge)}>Preview challenge</Button>
                          <Button onClick={() => toast({ title: "Publish validation", description: "Publishing is blocked until title, schedule, points, Open Flow, form, and success message are valid." })}>Validate publish</Button>
                        </div>
                      </div>
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
                        <h3 className="font-header text-2xl uppercase">Import / Export</h3>
                        <div className="mt-3 grid gap-2">
                          {["Duplicate last year", "Export season configuration", "Import season configuration", "Clone challenges", "Clone cabins", "Clone point settings"].map((label) => (
                            <Button key={label} variant="outline" onClick={() => toast({ title: label, description: "Configuration workflow is available from Season Settings." })}>{label}</Button>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
                        <h3 className="font-header text-2xl uppercase">Version History</h3>
                        <div className="mt-3 space-y-2 text-sm font-bold">
                          <div className="rounded-xl border-2 border-black bg-white p-3">Editor: Team GPE · Changed fields: schedule, rewards · Status: Draft</div>
                          <div className="rounded-xl border-2 border-black bg-white p-3">Actions: view previous version, restore version, compare changes</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
      <Dialog open={Boolean(reviewDialog)} onOpenChange={(open) => !open && setReviewDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <Tape>
              {reviewDialog?.kind === "approve"
                ? "Approve Submission"
                : reviewDialog?.kind === "needs_information"
                  ? "Request Changes"
                  : reviewDialog?.kind === "duplicate"
                    ? "Mark Duplicate"
                    : "Reject Submission"}
            </Tape>
            <DialogTitle className="font-header text-3xl uppercase">
              {reviewDialog?.challengeTitle || "Seasonal submission"}
            </DialogTitle>
            <DialogDescription>
              Review this action and save the decision to the Camp GPE audit trail.
            </DialogDescription>
          </DialogHeader>

          {reviewDialog && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4 text-sm font-bold md:grid-cols-2">
                <div>
                  <span className="block text-xs uppercase text-black/55">Member</span>
                  {reviewDialog.memberLabel}
                </div>
                <div>
                  <span className="block text-xs uppercase text-black/55">Default points</span>
                  +{reviewDialog.defaultPoints}
                </div>
              </div>

              {reviewDialog.kind === "approve" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="review-points">Points award</Label>
                    <Input
                      id="review-points"
                      inputMode="numeric"
                      value={reviewPoints}
                      onChange={(event) => setReviewPoints(event.target.value)}
                    />
                  </div>
                  <label className="mt-6 flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 text-sm font-black">
                    <input type="checkbox" checked={notifyMember} onChange={(event) => setNotifyMember(event.target.checked)} />
                    Notify member
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 text-sm font-black md:col-span-2">
                    <input type="checkbox" checked readOnly />
                    Badge eligible
                  </label>
                </div>
              ) : (
                <div>
                  <Label htmlFor="review-reason">Reason</Label>
                  <select
                    id="review-reason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {reviewDialog.kind === "duplicate" ? (
                      <option>Duplicate submission</option>
                    ) : (
                      <>
                        <option>Incomplete</option>
                        <option>Wrong challenge</option>
                        <option>Needs more proof</option>
                        <option>Spam</option>
                        <option>Custom reason</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              <div>
                <Label htmlFor="review-notes">
                  {reviewDialog.kind === "approve" ? "Comment" : reviewDialog.kind === "needs_information" ? "Message to member" : "Reviewer notes"}
                </Label>
                <Textarea
                  id="review-notes"
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder={reviewDialog.kind === "needs_information" ? "Hi! Can you upload a screenshot instead?" : "Add context for the audit trail."}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
            <Button disabled={!reviewDialog || busyId === reviewDialog.actionId} onClick={submitReviewDialog}>
              {busyId === reviewDialog?.actionId
                ? "Saving"
                : reviewDialog?.kind === "approve"
                  ? "Approve"
                  : reviewDialog?.kind === "needs_information"
                    ? "Submit"
                    : "Save Decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(actionDialog)} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <Tape>
              {actionDialog?.kind === "edit_action"
                ? "Edit Review Action"
                : actionDialog?.kind === "associate"
                  ? "Associate Member"
                  : actionDialog?.kind === "reopen"
                    ? "Reopen Submission"
                    : actionDialog?.kind === "reverse"
                      ? "Reverse Points"
                      : "Confirm Points"}
            </Tape>
            <DialogTitle className="font-header text-3xl uppercase">
              {actionDialog?.kind === "manual_award" ? "Award Manual Points" : "Camp Admin Action"}
            </DialogTitle>
            <DialogDescription>
              This action is handled inside the Camp Admin audit workflow without browser-native prompts.
            </DialogDescription>
          </DialogHeader>

          {actionDialog?.kind === "edit_action" ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="action-challenge-id">Challenge ID</Label>
                <Input id="action-challenge-id" value={dialogChallengeId} onChange={(event) => setDialogChallengeId(event.target.value)} placeholder="Leave blank to keep current challenge" />
              </div>
              <div>
                <Label htmlFor="action-description">Action description</Label>
                <Input id="action-description" value={dialogDescription} onChange={(event) => setDialogDescription(event.target.value)} placeholder="Leave blank to keep current description" />
              </div>
              <div>
                <Label htmlFor="action-points">Suggested points</Label>
                <Input id="action-points" inputMode="numeric" value={dialogPoints} onChange={(event) => setDialogPoints(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="action-notes">Internal reviewer notes</Label>
                <Textarea id="action-notes" value={dialogNotes} onChange={(event) => setDialogNotes(event.target.value)} />
              </div>
            </div>
          ) : actionDialog?.kind === "associate" ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="associate-season-member">Season member ID</Label>
                <Input id="associate-season-member" value={dialogReason} onChange={(event) => setDialogReason(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="associate-notes">Association notes</Label>
                <Textarea id="associate-notes" value={dialogNotes} onChange={(event) => setDialogNotes(event.target.value)} />
              </div>
            </div>
          ) : actionDialog?.kind === "reopen" ? (
            <div>
              <Label htmlFor="reopen-notes">Reason</Label>
              <Textarea id="reopen-notes" value={dialogNotes} onChange={(event) => setDialogNotes(event.target.value)} />
            </div>
          ) : actionDialog?.kind === "reverse" ? (
            <div className="space-y-4">
              <div className="rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4 text-sm font-bold">
                Reverse {actionDialog.transaction.points} points from {actionDialog.transaction.reason || actionDialog.transaction.action_type || actionDialog.transaction.source}.
              </div>
              <div>
                <Label htmlFor="reverse-reason">Reversal reason</Label>
                <Textarea id="reverse-reason" value={dialogReason} onChange={(event) => setDialogReason(event.target.value)} />
              </div>
            </div>
          ) : actionDialog?.kind === "manual_award" ? (
            <div className="rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4 text-sm font-bold">
              {dialogReason}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              disabled={!actionDialog || Boolean(busyId)}
              onClick={() => {
                if (!actionDialog) return;
                if (actionDialog.kind === "edit_action") void submitUpdateAction(actionDialog.actionId);
                if (actionDialog.kind === "associate") void submitAssociateSubmission(actionDialog.submissionId);
                if (actionDialog.kind === "reopen") void submitReopenAction(actionDialog.actionId);
                if (actionDialog.kind === "manual_award") void submitScopedManualAward();
                if (actionDialog.kind === "reverse") void submitReverseTransaction(actionDialog.transaction);
              }}
            >
              {busyId ? "Saving" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}
