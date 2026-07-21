import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, Shield, Trophy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  type CampSeason,
  type CampSeasonMember,
  type CampSubmission,
  addManualCampPoints,
  associateCampSubmissionMember,
  getActiveCampSeason,
  getPendingCampSubmissions,
  searchSeasonMembers,
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
  { value: "camp", label: "Camp", description: "Camp GPE challenge and action review." },
  { value: "petitions", label: "Petitions", description: "Action Network completion claims after unified review migration." },
  { value: "events", label: "Events", description: "Event attendance and registration review after unified review migration." },
  { value: "listings", label: "Listings", description: "Job-board style listing moderation currently uses pending_review." },
  { value: "funding", label: "Funding", description: "Funding listing submissions currently use listing moderation." },
  { value: "resources", label: "Resources", description: "Resource listing submissions currently use listing moderation." },
];

function submissionSource(submission: CampSubmission, fields: Record<string, unknown>) {
  const payload = submission.submitted_payload as (CampSubmission["submitted_payload"] & { source?: unknown }) | null;
  return String(payload?.source || fields.sourcePage || "Camp challenge form");
}

export default function CampAdmin() {
  const [season, setSeason] = useState<CampSeason | null>(null);
  const [submissions, setSubmissions] = useState<CampSubmission[]>([]);
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTab>("camp");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("pending");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<CampSeasonMember[]>([]);
  const [manualPoints, setManualPoints] = useState("10");
  const [manualReason, setManualReason] = useState("Manual Camp GPE adjustment");
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
      if (active) setSubmissions(await getPendingCampSubmissions(active.id));
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

  async function handleSearch() {
    if (!season) return;
    setError(null);
    try {
      setMemberResults(await searchSeasonMembers(season.id, memberQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Member search failed.");
    }
  }

  async function handleManualAward(member: CampSeasonMember) {
    if (!season) return;
    const points = Number(manualPoints);
    if (!Number.isFinite(points)) {
      setError("Enter a valid point amount.");
      return;
    }
    setBusyId(member.id);
    setError(null);
    try {
      await addManualCampPoints({
        seasonId: season.id,
        seasonMemberId: member.id,
        points,
        reason: manualReason,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add manual points.");
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
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border-[3px] border-black bg-cyan-200 px-4 py-2 text-xs font-black uppercase">
                <Shield className="h-4 w-4" />
                Team GPE
              </div>
              <h1 className="gpe-heading text-4xl md:text-6xl">Team Review</h1>
              <p className="mt-3 max-w-2xl text-sm font-bold text-black/70">
                Review member submissions, resolve identity, assign points, and keep the audit trail clean.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={load}>Refresh</Button>
              <Link to="/leaderboard"><Button variant="outline">Leaderboard</Button></Link>
            </div>
          </div>

          {error && (
            <div className="rounded-[1.5rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : !season ? (
            <Card>
              <CardContent className="py-8 text-sm font-bold text-black/70">No active Camp season is configured.</CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
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
                        variant={activeReviewTab === tab.value ? "default" : "outline"}
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
                  <CardTitle>Camp Submission Review</CardTitle>
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
                    <p className="text-sm font-bold text-black/60">No challenge submissions yet.</p>
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
                            const title = challenge?.title || action.other_description || "Other Camp action";
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
                  <CardDescription>Use this for corrections, manual submissions, and audited point adjustments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <Label htmlFor="member-search">Member email</Label>
                      <Input id="member-search" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="member@example.com" />
                    </div>
                    <Button className="self-end" onClick={handleSearch}>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor="manual-points">Points</Label>
                      <Input id="manual-points" value={manualPoints} onChange={(event) => setManualPoints(event.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="manual-reason">Reason</Label>
                      <Input id="manual-reason" value={manualReason} onChange={(event) => setManualReason(event.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {memberResults.map((member) => (
                      <div key={member.id} className="flex flex-col gap-3 rounded-[1.25rem] border-[3px] border-black bg-white p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-black">{member.contact_email}</div>
                          <div className="text-xs font-bold uppercase text-black/60">{member.status}</div>
                        </div>
                        <Button disabled={busyId === member.id} onClick={() => handleManualAward(member)}>Add Points</Button>
                      </div>
                    ))}
                  </div>
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
