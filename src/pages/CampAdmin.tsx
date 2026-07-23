import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Shield, Trophy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, StatSticker, Sticker, Tape } from "@/components/camp/CampDesign";
import {
  type CampChallenge,
  type CampSeason,
  type CampSubmission,
  type AdminAwardResult,
  type AdminPointMember,
  type AdminPointTransaction,
  type HubPointRule,
  associateCampSubmissionMember,
  awardManualPoints,
  getAdminMemberPointHistory,
  getActiveCampSeason,
  getHubCampChallenges,
  getPendingCampSubmissions,
  getPointRules,
  reversePointTransaction,
  searchPointMembers,
  updateCampChallengeContent,
  updateCampSubmissionActionReview,
} from "@/lib/camp";
import { normalizeReviewStatus, reviewStatusClassName, reviewStatusLabel } from "@/lib/review-status";
import { approveSubmission, reopenSubmission, updateSubmissionStatus } from "@/lib/submission-review";

type ReviewFilter = "pending" | "approved" | "needs_information" | "rejected" | "duplicate" | "all";
type ReviewTab = "camp" | "petitions" | "events" | "listings" | "funding" | "resources";

const reviewFilters: Array<{ value: ReviewFilter; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "needs_information", label: "Needs follow-up" },
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
  { value: "all", label: "All submissions" },
];

const reviewTabs: Array<{ value: ReviewTab; label: string; description: string }> = [
  { value: "camp", label: "Seasonal", description: "Seasonal challenge and action review." },
  { value: "petitions", label: "Petitions", description: "Action Network completion claims after unified review migration." },
  { value: "events", label: "Events", description: "Event attendance and registration review after unified review migration." },
  { value: "listings", label: "Listings", description: "Job-board style listing moderation currently uses pending_review." },
  { value: "funding", label: "Funding", description: "Funding listing submissions currently use listing moderation." },
  { value: "resources", label: "Resources", description: "Resource listing submissions currently use listing moderation." },
];

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

export default function CampAdmin() {
  const [season, setSeason] = useState<CampSeason | null>(null);
  const [submissions, setSubmissions] = useState<CampSubmission[]>([]);
  const [challenges, setChallenges] = useState<CampChallenge[]>([]);
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTab>("camp");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("pending");
  const [memberQuery, setMemberQuery] = useState("");
  const [pointMemberResults, setPointMemberResults] = useState<AdminPointMember[]>([]);
  const [selectedPointMember, setSelectedPointMember] = useState<AdminPointMember | null>(null);
  const [pointHistory, setPointHistory] = useState<AdminPointTransaction[]>([]);
  const [pointRules, setPointRules] = useState<HubPointRule[]>([]);
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
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const active = await getActiveCampSeason();
      setSeason(active);
      if (active) {
        const [submissionRows, challengeRows] = await Promise.all([
          getPendingCampSubmissions(active.id),
          getHubCampChallenges(active.id),
        ]);
        setSubmissions(submissionRows);
        setChallenges(challengeRows);
      }
      setPointRules(await getPointRules());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camp admin could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveAction(actionId: string, defaultPoints: number | null) {
    const points = Number(prompt("Points to award?", String(defaultPoints ?? 0)));
    if (!Number.isFinite(points)) return;
    const notes = prompt("Internal reviewer notes?", "") || "";
    setBusyId(actionId);
    setError(null);
    try {
      await approveSubmission({
        id: actionId,
        type: "camp",
      }, {
        points,
        reviewerNotes: notes,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not award points.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAction(actionId: string, status: "rejected" | "needs_information" | "duplicate") {
    const notes = prompt("Reviewer notes?", "") || "";
    setBusyId(actionId);
    setError(null);
    try {
      await updateSubmissionStatus({ id: actionId, type: "camp" }, { status, reviewerNotes: notes });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update submission action.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdateAction(actionId: string, defaultPoints: number | null) {
    const challengeId = prompt("Challenge ID to associate? Leave blank to keep current challenge.", "") || "";
    const otherDescription = prompt("Action description? Leave blank to keep current description.", "") || "";
    const pointsInput = prompt("Suggested points for approval?", String(defaultPoints ?? 0));
    const requestedPoints = pointsInput === null || pointsInput.trim() === "" ? null : Number(pointsInput);
    if (requestedPoints !== null && !Number.isFinite(requestedPoints)) return;
    const notes = prompt("Internal reviewer notes?", "") || "";
    setBusyId(actionId);
    setError(null);
    try {
      await updateCampSubmissionActionReview({
        actionId,
        challengeId: challengeId.trim() || null,
        otherDescription: otherDescription.trim() || null,
        requestedPoints,
        notes,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update submission action.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAssociateSubmission(submissionId: string) {
    const seasonMemberId = prompt("Season member ID to associate with this submission?", "");
    if (!seasonMemberId?.trim()) return;
    const notes = prompt("Association notes?", "") || "";
    setBusyId(submissionId);
    setError(null);
    try {
      await associateCampSubmissionMember({ submissionId, seasonMemberId: seasonMemberId.trim(), notes });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not associate submission with member.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReopenAction(actionId: string) {
    const notes = prompt("Why reopen this submission action?", "Reopened for review") || "";
    setBusyId(actionId);
    setError(null);
    try {
      await reopenSubmission({ id: actionId, type: "camp" }, { reviewerNotes: notes });
      await load();
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
    if (!season || trimmed.length < 2 || activeReviewTab !== "camp") {
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
  }, [activeReviewTab, memberQuery, season]);

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

  async function handleScopedManualAward() {
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
    const confirmed = confirm(
      `Award ${points} point${points === 1 ? "" : "s"} to ${selectedPointMember.full_name || selectedPointMember.email || selectedPointMember.profile_id}?\n\nScope: ${scope}\nReason: ${manualReason}`,
    );
    if (!confirmed) return;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not award manual points.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReverseTransaction(transaction: AdminPointTransaction) {
    const reason = prompt("Why reverse this point transaction?", "Admin correction");
    if (!reason?.trim()) return;
    setBusyId(transaction.transaction_id);
    setError(null);
    try {
      await reversePointTransaction({ transactionId: transaction.transaction_id, reason: reason.trim() });
      if (selectedPointMember) {
        const refreshed = await searchPointMembers({ seasonId: season?.id ?? null, query: selectedPointMember.profile_id, limit: 1 });
        if (refreshed[0]) setSelectedPointMember(refreshed[0]);
        await loadPointHistory(refreshed[0] || selectedPointMember);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reverse points.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleEditChallenge(challenge: CampChallenge) {
    const title = prompt("Challenge title", challenge.title);
    if (title === null) return;
    const shortDescription = prompt("Short description", challenge.short_description || "") ?? challenge.short_description;
    const instructions = prompt("Instructions / how to complete", challenge.instructions || "") ?? challenge.instructions;
    const theme = prompt("Week theme", challenge.theme || "") ?? challenge.theme;
    const weekInput = prompt("Week number", String(challenge.week_number ?? ""));
    const pointsInput = prompt("Point value. Leave blank for pending.", String(challenge.point_value ?? ""));
    const start = prompt("Start date/time", challenge.starts_at || "") ?? challenge.starts_at;
    const end = prompt("End date/time", challenge.ends_at || "") ?? challenge.ends_at;
    const ctaLabel = prompt("CTA label", challenge.cta_label || "") ?? challenge.cta_label;
    const actionUrl = prompt("CTA/action URL", challenge.action_url || "") ?? challenge.action_url;
    const relatedUrl = prompt("Related URL", challenge.related_url || "") ?? challenge.related_url;
    const submissionType = prompt("Submission type", challenge.submission_type || "") ?? challenge.submission_type;
    const verificationMethod = prompt("Verification method", challenge.verification_method || "") ?? challenge.verification_method;
    const displayOrderInput = prompt("Display order", String(challenge.display_order));
    const isFeatured = confirm("Feature this challenge?");
    const isActive = confirm("Active?");
    const isHubVisible = confirm("Visible in the Hub?");

    const weekNumber = weekInput?.trim() ? Number(weekInput) : null;
    const pointValue = pointsInput?.trim() ? Number(pointsInput) : null;
    const displayOrder = displayOrderInput?.trim() ? Number(displayOrderInput) : challenge.display_order;
    if (
      (weekNumber !== null && !Number.isFinite(weekNumber)) ||
      (pointValue !== null && !Number.isFinite(pointValue)) ||
      !Number.isFinite(displayOrder)
    ) {
      setError("Challenge edit cancelled because a numeric field was invalid.");
      return;
    }

    setBusyId(challenge.id);
    setError(null);
    try {
      await updateCampChallengeContent(challenge.id, {
        title: title.trim(),
        short_description: shortDescription?.trim() || null,
        instructions: instructions?.trim() || null,
        theme: theme?.trim() || null,
        week_number: weekNumber,
        point_value: pointValue,
        starts_at: start?.trim() || null,
        ends_at: end?.trim() || null,
        cta_label: ctaLabel?.trim() || null,
        action_url: actionUrl?.trim() || null,
        related_url: relatedUrl?.trim() || null,
        submission_type: submissionType?.trim() || null,
        verification_method: verificationMethod?.trim() || null,
        display_order: displayOrder,
        is_featured: isFeatured,
        is_active: isActive,
        is_hub_visible: isHubVisible,
      });
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

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <div className="mx-auto max-w-6xl space-y-8">
          <SectionHeader
            eyebrow={<Sticker accent="cyan"><Shield className="mr-2 h-4 w-4" /> Team GPE</Sticker>}
            title="Team Review"
            description="Review member submissions, resolve identity, assign points, and keep the audit trail clean."
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
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <StatSticker label="Visible submissions" value={visibleSubmissions.length.toLocaleString()} accent="yellow" />
                <StatSticker label="Filter" value={reviewFilter.replace("_", " ")} accent="cyan" />
                <StatSticker label="Season" value={season.name} accent="orange" />
              </div>
              <Card>
                <CardHeader>
                  <Tape>Season CMS</Tape>
                  <CardTitle>Challenge Schedule</CardTitle>
                  <CardDescription>Edit Camp GPE weeks, themes, timing, points, CTA destinations, ordering, featured status, and Hub visibility.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {challenges.length === 0 ? (
                    <EmptyState
                      illustration="clipboard"
                      title="No Challenges"
                      description="No visible seasonal challenges are configured for this season."
                    />
                  ) : challenges.map((challenge) => (
                    <div key={challenge.id} className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-header text-2xl uppercase">{challenge.title}</div>
                          <div className="mt-1 text-sm font-bold text-black/65">{challenge.theme || "No theme set"}</div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-black uppercase">
                            <Badge variant="outline">Week {challenge.week_number || "Season"}</Badge>
                            <Badge variant="outline">{challenge.point_value == null ? "Points pending" : `${challenge.point_value} points`}</Badge>
                            <Badge variant={challenge.is_featured ? "default" : "outline"}>{challenge.is_featured ? "Featured" : "Standard"}</Badge>
                            <Badge variant={challenge.is_hub_visible ? "default" : "outline"}>{challenge.is_hub_visible ? "Hub visible" : "Hidden"}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link to={`/camp-gpe/challenges/${challenge.slug}`}>
                            <Button size="sm" variant="outline">Preview</Button>
                          </Link>
                          <Button size="sm" disabled={busyId === challenge.id} onClick={() => handleEditChallenge(challenge)}>
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Tape>Review queue</Tape>
                  <CardTitle>Moderation Center</CardTitle>
                  <CardDescription>One review workspace for Camp, actions, listings, and future point-eligible submissions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6" role="tablist" aria-label="Review categories">
                    {reviewTabs.map((tab) => (
                      <Button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={activeReviewTab === tab.value}
                        variant={activeReviewTab === tab.value ? "default" : "sticker"}
                        onClick={() => setActiveReviewTab(tab.value)}
                      >
                        {tab.label}
                      </Button>
                    ))}
                  </div>
                  {activeReviewTab !== "camp" && (
                    <div className="rounded-[1.5rem] border-[3px] border-black bg-gpe-yellow p-4 text-sm font-bold">
                      {reviewTabs.find((tab) => tab.value === activeReviewTab)?.description}
                    </div>
                  )}
                </CardContent>
              </Card>

              {activeReviewTab === "camp" && (
                <>
              <Card>
                <CardHeader>
                  <CardTitle>Seasonal Submission Review</CardTitle>
                  <CardDescription>{season.name}. Points are awarded only after Team GPE approval.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Submission review filters">
                    {reviewFilters.map((filter) => (
                      <Button
                        key={filter.value}
                        type="button"
                        role="tab"
                        aria-selected={reviewFilter === filter.value}
                        variant={reviewFilter === filter.value ? "default" : "outline"}
                        onClick={() => setReviewFilter(filter.value)}
                      >
                        {filter.label}
                      </Button>
                    ))}
                  </div>

                  {visibleSubmissions.length === 0 ? (
                    <EmptyState
                      illustration="clipboard"
                      title="Queue Is Clear"
                      description="No seasonal submissions match the current review filter."
                    />
                  ) : visibleSubmissions.map((submission) => {
                    const fields = submission.submitted_payload?.fields || {};
                    const actions = submission.gpe_camp_submission_actions || [];
                    return (
                      <div key={submission.id} className="rounded-[1.5rem] border-[3px] border-black bg-white p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="text-lg font-black">{submission.challenge_key.replaceAll("_", " ")}</div>
                            <div className="text-sm font-bold text-black/60">{submission.contact_email}</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold uppercase">
                              <Badge variant="outline" className={reviewStatusClassName(submission.review_status)}>
                                {reviewStatusLabel(submission.review_status)}
                              </Badge>
                              <Badge variant={submission.member_link_status === "linked" ? "default" : "outline"}>
                                {submission.member_link_status === "linked" ? "Member linked" : "Identity pending"}
                              </Badge>
                              {submission.user_id ? <Badge variant="outline">Hub profile linked</Badge> : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" disabled={busyId === submission.id} onClick={() => handleAssociateSubmission(submission.id)}>
                              Associate Member
                            </Button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                          <div><span className="font-black">Name:</span> {[fields.firstName, fields.lastName].filter(Boolean).join(" ") || "Not provided"}</div>
                          <div><span className="font-black">Hub profile:</span> {submission.user_id || "Not linked"}</div>
                          <div><span className="font-black">Neon account:</span> {submission.neon_account_id || "Not linked"}</div>
                          <div><span className="font-black">Actions:</span> {Array.isArray(fields.actions) ? fields.actions.join(", ") : String(fields.actions || "None listed")}</div>
                          <div><span className="font-black">Member description:</span> {String(fields.otherAction || fields.notes || "Not provided")}</div>
                          <div><span className="font-black">Source page:</span> {submissionSource(submission, fields)}</div>
                          <div><span className="font-black">Submitted:</span> {new Date(submission.created_at).toLocaleString()}</div>
                        </div>
                        <div className="mt-4 space-y-3">
                          <div className="text-sm font-black uppercase text-black/60">Review Items</div>
                          {actions.length === 0 ? (
                            <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 p-3 text-sm font-bold text-yellow-900">
                              No normalized action rows are attached to this submission yet. Keep this in the reconciliation queue.
                            </div>
                          ) : actions.map((action) => {
                            const challenge = action.gpe_challenges;
                            const title = challenge?.title || action.other_description || "Other seasonal action";
                            const defaultPoints = action.requested_points ?? challenge?.point_value ?? 0;
                            const proofUrls = Array.isArray(action.proof_urls) ? action.proof_urls : [];
                            return (
                              <div key={action.id} className="rounded-[1.25rem] border-2 border-black bg-cyan-50 p-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <div className="font-black">{title}</div>
                                    <div className="mt-1 text-xs font-bold uppercase text-black/60">
                                      {reviewStatusLabel(action.review_status)} · suggested {defaultPoints} point{defaultPoints === 1 ? "" : "s"}
                                      {action.approved_points !== null ? ` · awarded ${action.approved_points}` : ""}
                                    </div>
                                    {challenge && (
                                      <div className="mt-1 text-xs font-bold text-black/60">
                                        {challenge.category} · Team review
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" disabled={busyId === action.id || normalizeReviewStatus(action.review_status) === "approved"} onClick={() => handleApproveAction(action.id, defaultPoints)}>
                                      <Trophy className="mr-2 h-4 w-4" />
                                      Approve
                                    </Button>
                                    <Button size="sm" variant="outline" disabled={busyId === action.id || normalizeReviewStatus(action.review_status) === "approved"} onClick={() => handleUpdateAction(action.id, defaultPoints)}>Edit</Button>
                                    <Button size="sm" variant="outline" disabled={busyId === action.id} onClick={() => handleMarkAction(action.id, "needs_information")}>Needs Info</Button>
                                    <Button size="sm" variant="outline" disabled={busyId === action.id} onClick={() => handleMarkAction(action.id, "duplicate")}>Duplicate</Button>
                                    <Button size="sm" variant="outline" disabled={busyId === action.id} onClick={() => handleMarkAction(action.id, "rejected")}>Reject</Button>
                                    {normalizeReviewStatus(action.review_status) !== "pending" && (
                                      <Button size="sm" variant="outline" disabled={busyId === action.id} onClick={() => handleReopenAction(action.id)}>Reopen</Button>
                                    )}
                                  </div>
                                </div>
                                {proofUrls.length > 0 && (
                                  <div className="mt-3 space-y-1 text-sm">
                                    <div className="font-black">Action proof</div>
                                    {proofUrls.map((link) => (
                                      <a key={`${action.id}-${link}`} href={link} target="_blank" rel="noreferrer" className="block break-all font-bold underline">{link}</a>
                                    ))}
                                  </div>
                                )}
                                {action.reviewer_notes && (
                                  <div className="mt-3 text-sm font-bold text-black/70">Notes: {action.reviewer_notes}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {submission.proof_links.length > 0 && (
                          <div className="mt-4 space-y-1 text-sm">
                            <div className="font-black">Proof links</div>
                            {submission.proof_links.map((link) => (
                              <a key={link} href={link} target="_blank" rel="noreferrer" className="block break-all font-bold underline">{link}</a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Member Search and Manual Points</CardTitle>
                  <CardDescription>Search by name, email, Neon ID, or profile ID. Manual awards use the central scoped point ledger.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
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
                                    <Button size="sm" variant="outline" disabled={busyId === transaction.transaction_id} onClick={() => handleReverseTransaction(transaction)}>
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
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
