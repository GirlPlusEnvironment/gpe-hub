import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Database, ExternalLink, RefreshCw, Search, ShieldAlert, SlidersHorizontal, Trophy, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, StatSticker, Sticker, Tape } from "@/components/camp/CampDesign";
import { supabase } from "@/lib/supabaseClient";
import {
  awardManualPoints,
  getAdminHubMemberRoster,
  getAdminHubParticipantDetail,
  getPointRules,
  logAdminParticipantAction,
  refreshAdminHubParticipantDirectory,
  type AdminHubMemberRosterRow,
  type AdminHubParticipantDetail,
  type HubPointRule,
} from "@/lib/camp";
import { toast } from "@/hooks/use-toast";

type HubStatusFilter = "all" | "hub_active" | "hub_incomplete" | "missing_hub";
type NeonStatusFilter = "all" | "linked" | "missing_neon" | "active" | "expired" | "membership_record_without_neon_id";
type ReconciliationFilter = "all" | "matched" | "missing_hub" | "missing_neon" | "needs_reconciliation" | "unmatched";
type CampStatusFilter = "all" | "none" | "registered" | "active" | "inactive" | "withdrawn";
type PointsFilter = "all" | "has_points" | "no_points" | "pending_points";
type ActivityFilter = "all" | "recent" | "inactive" | "incomplete_signup" | "pending_invite";
type SortKey = "last_activity_desc" | "name_asc" | "joined_desc" | "points_desc" | "reconciliation";

type AwardDraft = {
  participant: AdminHubMemberRosterRow;
  points: string;
  reason: string;
  note: string;
  actionType: string;
  idempotencyKey: string;
};

const pageSize = 25;

const hubFilters: Array<{ value: HubStatusFilter; label: string }> = [
  { value: "all", label: "All Hub" },
  { value: "hub_active", label: "Hub Active" },
  { value: "hub_incomplete", label: "Hub Incomplete" },
  { value: "missing_hub", label: "Missing Hub" },
];

const neonFilters: Array<{ value: NeonStatusFilter; label: string }> = [
  { value: "all", label: "All Neon" },
  { value: "linked", label: "Neon Linked" },
  { value: "active", label: "Neon Member" },
  { value: "expired", label: "Expired" },
  { value: "missing_neon", label: "Missing Neon" },
  { value: "membership_record_without_neon_id", label: "Membership no ID" },
];

const reconciliationFilters: Array<{ value: ReconciliationFilter; label: string }> = [
  { value: "all", label: "All Matches" },
  { value: "matched", label: "Matched" },
  { value: "missing_hub", label: "Neon not in Hub" },
  { value: "missing_neon", label: "Hub missing Neon" },
  { value: "needs_reconciliation", label: "Needs Reconciliation" },
  { value: "unmatched", label: "Unmatched" },
];

const campFilters: Array<{ value: CampStatusFilter; label: string }> = [
  { value: "all", label: "All Camp" },
  { value: "active", label: "Camp Enrolled" },
  { value: "registered", label: "Camp Pending" },
  { value: "none", label: "No Camp Row" },
  { value: "inactive", label: "Camp Inactive" },
  { value: "withdrawn", label: "Withdrawn" },
];

const pointsFilters: Array<{ value: PointsFilter; label: string }> = [
  { value: "all", label: "All Points" },
  { value: "has_points", label: "Has Points" },
  { value: "no_points", label: "No Points" },
  { value: "pending_points", label: "Pending Points" },
];

const activityFilters: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "All Activity" },
  { value: "recent", label: "Recent" },
  { value: "inactive", label: "Inactive" },
  { value: "incomplete_signup", label: "Incomplete Signup" },
  { value: "pending_invite", label: "Pending Invite" },
];

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "last_activity_desc", label: "Last activity" },
  { value: "name_asc", label: "Name" },
  { value: "joined_desc", label: "Joined" },
  { value: "points_desc", label: "Points" },
  { value: "reconciliation", label: "Reconciliation" },
];

function statusLabel(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ");
}

function statusVariant(status: string | null | undefined): "default" | "outline" | "destructive" {
  const value = String(status || "");
  if (["hub_active", "linked", "active", "matched"].includes(value)) return "default";
  if (["needs_reconciliation", "missing_neon", "missing_hub"].includes(value)) return "destructive";
  return "outline";
}

function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : "Unknown";
}

function createIdempotencyKey(profileId: string) {
  return `hub-members:${profileId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export default function AdminHubMembers() {
  const [query, setQuery] = useState("");
  const [hubStatus, setHubStatus] = useState<HubStatusFilter>("all");
  const [neonStatus, setNeonStatus] = useState<NeonStatusFilter>("all");
  const [reconciliationStatus, setReconciliationStatus] = useState<ReconciliationFilter>("all");
  const [campStatus, setCampStatus] = useState<CampStatusFilter>("all");
  const [pointsFilter, setPointsFilter] = useState<PointsFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sort, setSort] = useState<SortKey>("last_activity_desc");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdminHubMemberRosterRow[]>([]);
  const [pointRules, setPointRules] = useState<HubPointRule[]>([]);
  const [detail, setDetail] = useState<AdminHubParticipantDetail | null>(null);
  const [awardDraft, setAwardDraft] = useState<AwardDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(Math.ceil(Number(totalCount) / pageSize), 1);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRows, rules] = await Promise.all([
        getAdminHubMemberRoster({
          query: query.trim() || undefined,
          limit: pageSize,
          offset: page * pageSize,
          hubStatus,
          neonStatus,
          reconciliationStatus,
          campStatus,
          pointsFilter,
          activityFilter,
          sort,
        }),
        pointRules.length ? Promise.resolve(pointRules) : getPointRules(),
      ]);
      setRows(nextRows);
      setPointRules(rules);
    } catch (err) {
      setError(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activityFilter, campStatus, hubStatus, neonStatus, page, pointRules, pointsFilter, query, reconciliationStatus, sort]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const stats = useMemo(() => ({
    visible: rows.length,
    needsReconciliation: rows.filter((row) => row.reconciliation_status === "needs_reconciliation").length,
    missingHub: rows.filter((row) => row.reconciliation_status === "missing_hub").length,
    missingNeon: rows.filter((row) => row.reconciliation_status === "missing_neon").length,
  }), [rows]);

  async function refreshDirectory() {
    setBusy("directory-refresh");
    setError(null);
    try {
      const result = await refreshAdminHubParticipantDirectory();
      toast({ title: "Directory refreshed", description: `${result.refreshedCount ?? 0} participant rows rebuilt.` });
      await loadRoster();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  async function openDetail(participantKey: string) {
    setDetailLoading(true);
    setError(null);
    try {
      setDetail(await getAdminHubParticipantDetail(participantKey));
    } catch (err) {
      setError(err);
    } finally {
      setDetailLoading(false);
    }
  }

  function openAward(participant: AdminHubMemberRosterRow) {
    if (!participant.profile_id) {
      setError(new Error("Points require a Hub profile. Reconcile this participant before awarding points."));
      return;
    }
    setAwardDraft({
      participant,
      points: "10",
      reason: "",
      note: "",
      actionType: "manual_admin_award",
      idempotencyKey: createIdempotencyKey(participant.profile_id),
    });
  }

  async function submitAward() {
    if (!awardDraft?.participant.profile_id) return;
    const points = Number(awardDraft.points);
    if (!Number.isFinite(points) || points === 0) {
      setError(new Error("Enter a non-zero point amount."));
      return;
    }
    if (!awardDraft.reason.trim()) {
      setError(new Error("Manual point awards require a permanent reason."));
      return;
    }

    setBusy("award-points");
    setError(null);
    try {
      const result = await awardManualPoints({
        profileId: awardDraft.participant.profile_id,
        points,
        reason: awardDraft.reason.trim(),
        actionType: awardDraft.actionType,
        adminNote: awardDraft.note.trim() || null,
        countsForOngoing: true,
        countsForSeason: false,
        countsForCabin: false,
        idempotencyKey: awardDraft.idempotencyKey,
      });
      setAwardDraft(null);
      toast({ title: "Points saved", description: `Transaction ${result.point_transaction_id || "created"}${result.duplicate ? " reused" : ""}.` });
      await refreshDirectory();
      if (detail) await openDetail(detail.participant.participant_key);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  async function refreshNeonStatus(participant: AdminHubMemberRosterRow) {
    setBusy(`neon-${participant.participant_key}`);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-hub-participants-neon-sync", {
        body: {
          mode: "participant",
          participantKey: participant.participant_key,
          email: participant.email,
          neonAccountId: participant.neon_account_id,
          profileId: participant.profile_id,
        },
      });
      if (error) throw error;
      await logAdminParticipantAction({
        participantKey: participant.participant_key,
        profileId: participant.profile_id,
        action: "refresh_neon_status",
        reason: "Admin refreshed Neon status from Hub Members.",
        newState: (data && typeof data === "object" ? data as Record<string, unknown> : {}),
      }).catch(() => null);
      toast({ title: "Neon refresh prepared", description: "The sync function returned updated status data." });
      await refreshDirectory();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  function errorText() {
    if (!error) return "";
    if (error instanceof Error) return error.message;
    if (typeof error === "object") return JSON.stringify(error, null, 2);
    return String(error);
  }

  const activeRules = pointRules.filter((rule) => rule.active);

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main space-y-6">
        <SectionHeader
          eyebrow={<Sticker accent="yellow">Admin</Sticker>}
          title="Hub Members"
          description="People directory for Hub identity, Neon membership, Camp participation, actions, and administrative point adjustments."
          action={
            <>
              <Link to="/admin"><CampButton variant="outline">Admin Hub</CampButton></Link>
              <Link to="/admin/camp?tab=rewards"><CampButton variant="outline">Team Review Rewards</CampButton></Link>
              <CampButton variant="cyan" onClick={refreshDirectory} disabled={busy === "directory-refresh"}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {busy === "directory-refresh" ? "Refreshing" : "Refresh Directory"}
              </CampButton>
            </>
          }
        />

        {error && (
          <div className="rounded-[1.25rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error instanceof Error ? error.message : "Admin action failed."}</span>
              <Button size="sm" variant="outline" onClick={() => setShowErrorDetails((current) => !current)}>
                {showErrorDetails ? "Hide details" : "Show details"}
              </Button>
            </div>
            {showErrorDetails && <pre className="mt-3 overflow-auto rounded-lg bg-white p-3 text-xs font-normal text-black">{errorText()}</pre>}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <StatSticker label="Visible" value={stats.visible.toLocaleString()} accent="yellow" />
          <StatSticker label="Needs Review" value={stats.needsReconciliation.toLocaleString()} accent="orange" />
          <StatSticker label="Missing Hub" value={stats.missingHub.toLocaleString()} accent="cyan" />
          <StatSticker label="Missing Neon" value={stats.missingNeon.toLocaleString()} accent="pink" />
        </div>

        <Card>
          <CardHeader>
            <Tape>Directory</Tape>
            <CardTitle>Participant Index</CardTitle>
            <CardDescription>Search by name, email, Neon account ID, membership ID, or Hub profile ID.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <div>
                <Label htmlFor="hub-members-search">Search</Label>
                <Input
                  id="hub-members-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void loadRoster();
                  }}
                  placeholder="Name, email, Neon ID, membership ID, or profile ID"
                />
              </div>
              <div>
                <Label htmlFor="hub-members-sort">Sort</Label>
                <select id="hub-members-sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <Button className="self-end" onClick={() => void loadRoster()} disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? "Searching" : "Search"}
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Hub", hubStatus, setHubStatus, hubFilters],
                ["Neon", neonStatus, setNeonStatus, neonFilters],
                ["Reconciliation", reconciliationStatus, setReconciliationStatus, reconciliationFilters],
                ["Camp", campStatus, setCampStatus, campFilters],
                ["Points", pointsFilter, setPointsFilter, pointsFilters],
                ["Activity", activityFilter, setActivityFilter, activityFilters],
              ].map(([label, value, setter, options]) => (
                <div key={label as string}>
                  <Label>{label as string}</Label>
                  <select
                    value={value as string}
                    onChange={(event) => {
                      (setter as (next: string) => void)(event.target.value);
                      setPage(0);
                    }}
                    className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {(options as Array<{ value: string; label: string }>).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <LoadingCampCard label="Loading Hub members" />
            <LoadingCampCard label="Loading Hub members" />
            <LoadingCampCard label="Loading Hub members" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState illustration="clipboard" title="No Participants Found" description="Refresh the directory or adjust the search and filters." />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-[1.25rem] border-[3px] border-black bg-white lg:block">
              <table className="min-w-full divide-y-2 divide-black text-sm">
                <thead className="bg-black text-left text-xs font-black uppercase text-white">
                  <tr>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Hub</th>
                    <th className="px-3 py-3">Neon</th>
                    <th className="px-3 py-3">Points</th>
                    <th className="px-3 py-3">Activity</th>
                    <th className="px-3 py-3">Identity</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/20">
                  {rows.map((row) => (
                    <tr key={row.participant_key} className="align-top">
                      <td className="px-3 py-3">
                        <button className="text-left font-black underline-offset-4 hover:underline" onClick={() => void openDetail(row.participant_key)}>
                          {row.display_name}
                        </button>
                        <div className="mt-1 break-all text-xs text-black/50">{row.profile_id || row.auth_user_id || row.participant_key}</div>
                      </td>
                      <td className="px-3 py-3 break-all text-xs font-bold">{row.email || "No email"}</td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-[13rem] flex-wrap gap-1">
                          <Badge variant={statusVariant(row.hub_profile_status)}>{statusLabel(row.hub_profile_status)}</Badge>
                          <Badge variant="outline">{statusLabel(row.hub_account_status)}</Badge>
                          {row.invitation_status && <Badge variant="outline">invite {statusLabel(row.invitation_status)}</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-[13rem] flex-wrap gap-1">
                          <Badge variant={statusVariant(row.neon_account_status)}>{statusLabel(row.neon_account_status)}</Badge>
                          <Badge variant={statusVariant(row.neon_membership_status)}>{statusLabel(row.neon_membership_status)}</Badge>
                          {row.neon_account_id && <Badge variant="outline">{row.neon_account_id}</Badge>}
                          {row.neon_membership_id && <Badge variant="outline">Membership {row.neon_membership_id}</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs font-black uppercase">
                        <div>Hub {row.current_hub_points}</div>
                        <div>Season {row.current_season_points}</div>
                        <div>Camp {row.current_camp_points}</div>
                      </td>
                      <td className="px-3 py-3 text-xs font-bold">
                        <div>{dateLabel(row.last_activity_at)}</div>
                        <div className="text-black/50">{row.past_actions_count} action{row.past_actions_count === 1 ? "" : "s"}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-[13rem] flex-wrap gap-1">
                          <Badge variant={statusVariant(row.reconciliation_status)}>{statusLabel(row.reconciliation_status)}</Badge>
                          <Badge variant="outline">{statusLabel(row.identity_confidence)}</Badge>
                          {row.camp_status && <Badge variant="outline">Camp {statusLabel(row.camp_status)}</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => void openDetail(row.participant_key)}>Details</Button>
                          <Button size="sm" disabled={!row.profile_id} onClick={() => openAward(row)}>
                            <Trophy className="mr-2 h-4 w-4" />
                            Award
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 lg:hidden">
              {rows.map((row) => (
                <button key={row.participant_key} type="button" onClick={() => void openDetail(row.participant_key)} className="rounded-[1.25rem] border-[3px] border-black bg-white p-4 text-left shadow-gpe-sm">
                  <div className="font-header text-2xl uppercase">{row.display_name}</div>
                  <div className="break-all text-sm font-bold text-black/60">{row.email || "No email"}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={statusVariant(row.hub_profile_status)}>{statusLabel(row.hub_profile_status)}</Badge>
                    <Badge variant={statusVariant(row.neon_membership_status)}>{statusLabel(row.neon_membership_status)}</Badge>
                    <Badge variant={statusVariant(row.reconciliation_status)}>{statusLabel(row.reconciliation_status)}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black uppercase">
                    <div className="rounded-lg border-2 border-black bg-gpe-yellow/30 p-2">Hub {row.current_hub_points}</div>
                    <div className="rounded-lg border-2 border-black bg-cyan-50 p-2">Season {row.current_season_points}</div>
                    <div className="rounded-lg border-2 border-black bg-white p-2">{dateLabel(row.last_activity_at)}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-bold text-black/60">
                Page {page + 1} of {totalPages} · {Number(totalCount).toLocaleString()} participant{Number(totalCount) === 1 ? "" : "s"}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page === 0} onClick={() => setPage((current) => Math.max(current - 1, 0))}>Previous</Button>
                <Button variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />

      <Dialog open={Boolean(detail) || detailLoading} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{detail?.participant.display_name || "Participant details"}</DialogTitle>
            <DialogDescription>Identity, status, point history, past actions, and admin audit log.</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <LoadingCampCard label="Loading participant detail" />
          ) : detail ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoPanel title="Identity" rows={[
                  ["Name", detail.participant.display_name],
                  ["Email", detail.participant.email || "Unknown"],
                  ["Profile ID", detail.participant.profile_id || "None"],
                  ["Auth user ID", detail.participant.auth_user_id || "None"],
                  ["Neon account ID", detail.participant.neon_account_id || "None"],
                  ["Neon membership ID", detail.participant.neon_membership_id || "None"],
                ]} />
                <InfoPanel title="Status" rows={[
                  ["Hub profile", statusLabel(detail.participant.hub_profile_status)],
                  ["Hub account", statusLabel(detail.participant.hub_account_status)],
                  ["Neon membership", statusLabel(detail.participant.neon_membership_status)],
                  ["Camp", statusLabel(detail.participant.camp_status)],
                  ["Invitation", statusLabel(detail.participant.invitation_status)],
                  ["Reconciliation", statusLabel(detail.participant.reconciliation_status)],
                ]} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openAward(detail.participant)} disabled={!detail.participant.profile_id}>
                  <Trophy className="mr-2 h-4 w-4" />
                  Award Points
                </Button>
                <Button size="sm" variant="outline" disabled={busy === `neon-${detail.participant.participant_key}`} onClick={() => void refreshNeonStatus(detail.participant)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Neon Status
                </Button>
                <Button size="sm" variant="outline" onClick={() => void logAdminParticipantAction({ participantKey: detail.participant.participant_key, profileId: detail.participant.profile_id, action: "manual_reconciliation_review", reason: "Reviewed in Hub Members admin." }).then(() => openDetail(detail.participant.participant_key))}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark Reviewed
                </Button>
              </div>

              <DetailSection title="Point History" empty="No point history found.">
                {detail.pointHistory.map((entry) => (
                  <div key={entry.transactionId || `${entry.date}-${entry.reason}`} className="rounded-xl border-2 border-black bg-white p-3 text-sm">
                    <div className="font-black">{entry.points && entry.points > 0 ? "+" : ""}{entry.points ?? 0} - {entry.reason || entry.ruleKey || "Point transaction"}</div>
                    <div className="mt-1 grid gap-1 text-xs font-bold text-black/60 md:grid-cols-3">
                      <div>Date: {entry.date ? new Date(entry.date).toLocaleString() : "Unknown"}</div>
                      <div>Rule: {entry.ruleKey || "None"}</div>
                      <div>Source: {entry.sourceType || "Unknown"}</div>
                      <div>Record: {entry.sourceRecordId || "None"}</div>
                      <div>Transaction: {entry.transactionId || "None"}</div>
                      <div>Awarded by: {entry.awardedBy || "automatic/unknown"}</div>
                    </div>
                    {entry.adminNote && <div className="mt-2 text-xs font-bold text-black/70">Note: {entry.adminNote}</div>}
                  </div>
                ))}
              </DetailSection>

              <DetailSection title="Past Actions" empty="No past actions found.">
                {detail.pastActions.map((action) => (
                  <div key={action.id || `${action.actionSlug}-${action.occurredAt}`} className="rounded-xl border-2 border-black bg-white p-3 text-sm">
                    <div className="font-black">{action.actionSlug || action.actionType || action.provider || "Hub action"}</div>
                    <div className="mt-1 grid gap-1 text-xs font-bold text-black/60 md:grid-cols-3">
                      <div>Provider: {action.provider || "Unknown"}</div>
                      <div>Points: {action.pointsStatus || "n/a"}</div>
                      <div>Neon: {action.neonSyncStatus || "n/a"}</div>
                      <div>Hub identity: {action.hubIdentityStatus || "n/a"}</div>
                      <div>Record: {action.formSubmissionId || action.providerSignatureId || action.id || "None"}</div>
                      <div>Occurred: {action.occurredAt ? new Date(action.occurredAt).toLocaleString() : "Unknown"}</div>
                    </div>
                  </div>
                ))}
              </DetailSection>

              <DetailSection title="Admin Audit" empty="No admin audit events found.">
                {detail.auditLog.map((entry) => (
                  <div key={entry.id || `${entry.action}-${entry.createdAt}`} className="rounded-xl border-2 border-black bg-white p-3 text-sm">
                    <div className="font-black">{statusLabel(entry.action)}</div>
                    <div className="mt-1 text-xs font-bold text-black/60">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "Unknown"} · Admin {entry.adminId || "unknown"}</div>
                    {entry.reason && <div className="mt-2 text-xs font-bold text-black/70">Reason: {entry.reason}</div>}
                  </div>
                ))}
              </DetailSection>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(awardDraft)} onOpenChange={(open) => !open && setAwardDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award Points</DialogTitle>
            <DialogDescription>Manual awards create canonical point transactions and require a permanent reason.</DialogDescription>
          </DialogHeader>
          {awardDraft && (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-black bg-gpe-yellow/30 p-3 text-sm font-bold">
                {awardDraft.participant.display_name} · {awardDraft.participant.email || "No email"}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="award-points">Points</Label>
                  <Input id="award-points" value={awardDraft.points} onChange={(event) => setAwardDraft({ ...awardDraft, points: event.target.value })} />
                </div>
                <div>
                  <Label htmlFor="award-rule">Point category</Label>
                  <select id="award-rule" value={awardDraft.actionType} onChange={(event) => setAwardDraft({ ...awardDraft, actionType: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {(activeRules.length ? activeRules : [{ action_type: "manual_admin_award", display_name: "Manual admin award" } as HubPointRule]).map((rule) => (
                      <option key={rule.action_type} value={rule.action_type}>{rule.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="award-reason">Reason</Label>
                <Input id="award-reason" value={awardDraft.reason} onChange={(event) => setAwardDraft({ ...awardDraft, reason: event.target.value })} placeholder="+10 - Volunteered at Camp GPE kickoff" />
              </div>
              <div>
                <Label htmlFor="award-note">Internal note</Label>
                <Textarea id="award-note" value={awardDraft.note} onChange={(event) => setAwardDraft({ ...awardDraft, note: event.target.value })} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardDraft(null)}>Cancel</Button>
            <Button disabled={busy === "award-points"} onClick={() => void submitAward()}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              {busy === "award-points" ? "Saving" : "Confirm Award"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoPanel({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-xl border-2 border-black bg-white p-3">
      <div className="mb-2 flex items-center gap-2 font-black uppercase"><Database className="h-4 w-4" />{title}</div>
      <div className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <div className="text-xs font-black uppercase text-black/50">{label}</div>
            <div className="break-all font-bold">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] | React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="space-y-3 rounded-[1.25rem] border-[3px] border-black bg-cyan-50 p-4">
      <div className="flex items-center gap-2 font-header text-2xl uppercase">
        {title === "Past Actions" ? <ExternalLink className="h-5 w-5" /> : title === "Point History" ? <Trophy className="h-5 w-5" /> : <Users className="h-5 w-5" />}
        {title}
      </div>
      {hasChildren ? children : <div className="rounded-xl border-2 border-black bg-white p-3 text-sm font-bold">{empty}</div>}
    </div>
  );
}
