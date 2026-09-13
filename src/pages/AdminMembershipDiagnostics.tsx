import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, List, RefreshCw, Search, ServerCog, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampButton, EmptyState, SectionHeader, StatSticker, Sticker, Tape } from "@/components/camp/CampDesign";
import {
  getChallengeDiagnosticReport,
  getAdminMemberPetitionHistory,
  getAdminMembershipLoadTable,
  getCrmConfigurationReport,
  getMembershipDiagnosticReport,
  getPetitionReconciliationReport,
  reconcilePetitionSigners,
  type AdminMemberPetitionHistory,
  type AdminMembershipLoadRow,
  type ChallengeDiagnosticReport,
  type CrmConfigurationCheck,
  type CrmConfigurationReport,
  type MembershipDiagnosticReport,
  type PetitionReconciliationReport,
  type PetitionReconciliationRow,
} from "@/lib/membership-diagnostics";

type CheckStatus = "pass" | "warn" | "fail";

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusFor(active: boolean, warning = false): CheckStatus {
  if (active) return warning ? "warn" : "pass";
  return "fail";
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-5 w-5 text-green-700" />;
  if (status === "warn") return <AlertTriangle className="h-5 w-5 text-orange-700" />;
  return <XCircle className="h-5 w-5 text-red-700" />;
}

function DiagnosticRow({
  label,
  value,
  status,
}: {
  label: string;
  value: unknown;
  status: CheckStatus;
}) {
  return (
    <div className="grid gap-3 border-t-[3px] border-black px-4 py-3 md:grid-cols-12 md:items-center">
      <div className="flex items-center gap-2 font-black md:col-span-4">
        <StatusIcon status={status} />
        {label}
      </div>
      <div className="break-words rounded-lg border-2 border-black bg-white px-3 py-2 font-mono text-xs md:col-span-8">
        {formatValue(value)}
      </div>
    </div>
  );
}

function CrmCheckRow({ check }: { check: CrmConfigurationCheck }) {
  return (
    <div className="grid gap-3 border-t-[3px] border-black px-4 py-3 md:grid-cols-12 md:items-center">
      <div className="flex items-center gap-2 font-black md:col-span-4">
        <StatusIcon status={check.status} />
        <span>{check.label}</span>
      </div>
      <div className="md:col-span-2">
        <span className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase">
          {check.required ? "Required" : "Optional"}
        </span>
      </div>
      <div className="break-words text-sm font-bold md:col-span-6">
        <div className="font-mono text-xs uppercase text-black/55">{check.key}</div>
        {check.message}
      </div>
    </div>
  );
}

function displayEmail(value: string | null | undefined) {
  return value || "Unknown";
}

function shortId(value: string | null | undefined) {
  if (!value) return "None";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...`;
}

function statusAccent(value: string | null | undefined): "cyan" | "yellow" | "orange" | "pink" {
  if (value === "succeeded" || value === "awarded" || value === "active" || value === "success") return "cyan";
  if (value === "pending" || value === "pending_identity" || value === "pending_membership") return "yellow";
  if (value === "failed") return "orange";
  return "pink";
}

function pipelineStatus(row: PetitionReconciliationRow, key: string) {
  const value = row.pipelineStatus?.[key];
  if (typeof value === "string" && value) return value;
  if (key === "petition" || key === "actionNetwork") return row.leadActionId || row.submissionId ? "success" : "pending";
  if (key === "neon") return row.neonSyncStatus === "succeeded" ? "success" : row.neonSyncStatus;
  if (key === "hub") return row.hubIdentityStatus === "succeeded" ? "success" : row.hubIdentityStatus;
  if (key === "points") return row.pointsStatus === "awarded" ? "success" : row.pointsStatus;
  if (key === "camp") return row.pointsStatus === "awarded" ? "success" : "pending";
  if (key === "automation") return row.invitationStatus === "succeeded" ? "success" : row.invitationStatus;
  return "pending";
}

function statusSymbol(value: string) {
  if (value === "success" || value === "succeeded" || value === "awarded") return "✅";
  if (value === "failed") return "❌";
  return "⚠";
}

function PetitionReconciliationRowView({ row }: { row: PetitionReconciliationRow }) {
  const [open, setOpen] = useState(false);
  const steps = [
    ["Petition", "petition"],
    ["Action Network", "actionNetwork"],
    ["Neon", "neon"],
    ["Hub", "hub"],
    ["Points", "points"],
    ["Camp", "camp"],
    ["Automation", "automation"],
  ];
  return (
    <div className="border-t-[3px] border-black">
      <button type="button" onClick={() => setOpen((current) => !current)} className="grid w-full gap-3 px-4 py-3 text-left text-sm md:grid-cols-12 md:items-start">
        <div className="md:col-span-3">
          <div className="font-black">{row.displayName || [row.firstName, row.lastName].filter(Boolean).join(" ") || "Unknown"}</div>
          <div className="mt-1 break-all font-mono text-[11px] text-black/65">{displayEmail(row.email)}</div>
          <div className="mt-1 font-mono text-[11px] uppercase text-black/50">Hub {shortId(row.hubProfileId)}</div>
        </div>
        <div className="md:col-span-3">
          <div className="font-black">{row.petitionTitle || row.actionSlug}</div>
          <div className="mt-1 break-words font-mono text-[11px] text-black/55">{row.actionSlug}</div>
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-4">
          <Sticker accent={statusAccent(row.neonSyncStatus)}>Neon {row.neonSyncStatus}</Sticker>
          <Sticker accent={statusAccent(row.membershipStatus)}>Member {row.membershipStatus}</Sticker>
          <Sticker accent={statusAccent(row.hubIdentityStatus)}>Hub {row.hubIdentityStatus}</Sticker>
          <Sticker accent={statusAccent(row.pointsStatus)}>Points {row.pointsStatus}</Sticker>
          <Sticker accent={statusAccent(row.invitationStatus)}>Invite {row.invitationStatus}</Sticker>
        </div>
        <div className="break-words font-mono text-[11px] md:col-span-2">
          <div>Neon: {shortId(row.neonAccountId)}</div>
          <div>Record: {shortId(row.submissionId || row.leadActionId)}</div>
          <div className="mt-1 font-bold uppercase">{open ? "Hide pipeline" : "Show pipeline"}</div>
          {row.reconciliationError ? <div className="mt-1 text-red-700">{row.reconciliationError}</div> : null}
        </div>
      </button>
      {open ? (
        <div className="grid gap-2 border-t-2 border-black bg-[#f6f1e7] p-4 md:grid-cols-7">
          {steps.map(([label, key]) => {
            const value = pipelineStatus(row, key);
            return (
              <div key={key} className="rounded-lg border-2 border-black bg-white p-2 text-xs font-black">
                <div>{statusSymbol(value)} {label}</div>
                <div className="mt-1 break-words font-mono text-[11px] uppercase text-black/55">{value}</div>
              </div>
            );
          })}
          <div className="rounded-lg border-2 border-black bg-white p-2 text-xs font-bold md:col-span-7">
            Signed {formatDate(row.occurredAt)} · Campaign {formatValue(row.campaignSlug)} · Signature {shortId(row.providerSignatureId)}
          </div>
          <div className="rounded-lg border-2 border-black bg-white p-3 text-xs font-bold md:col-span-7">
            <div className="mb-2 font-black uppercase">Point Events</div>
            {row.pointEvents && row.pointEvents.length > 0 ? (
              <div className="grid gap-2">
                {row.pointEvents.map((event) => (
                  <div key={event.id} className="grid gap-2 rounded-md border-2 border-black bg-[#f6f1e7] p-2 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <div className="font-black">{event.eventType}</div>
                      <div className="font-mono text-[11px] text-black/55">{event.rule}</div>
                    </div>
                    <div className="md:col-span-2">
                      <Sticker accent={statusAccent(event.status)}>{event.status}</Sticker>
                    </div>
                    <div className="font-mono md:col-span-2">
                      Points {event.points}<br />
                      Awarded {event.awardedPoints}<br />
                      Pending {event.pendingPoints}
                    </div>
                    <div className="break-words font-mono text-[11px] md:col-span-5">
                      <div>Transaction: {shortId(event.transactionId)}</div>
                      <div>Pending award: {shortId(event.pendingAwardId)}</div>
                      <div>Ledger: {shortId(event.ledgerId)}</div>
                      <div>At: {formatDate(event.occurredAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border-2 border-black bg-[#fff7cc] p-2">
                No point events found for this petition action.
              </div>
            )}
          </div>
        </div>
      ) : null}
      </div>
  );
}

const membershipPageSize = 25;

function MemberPetitionHistoryPanel({ history }: { history: AdminMemberPetitionHistory }) {
  return (
    <div className="border-t-[3px] border-black bg-[#f6f1e7] p-4">
      <div className="mb-3 text-sm font-black">
        {history.displayName} · <span className="font-mono text-xs">{displayEmail(history.email)}</span>
      </div>
      {history.petitions.length > 0 ? (
        <div className="grid gap-2">
          {history.petitions.map((petition) => (
            <div key={petition.leadActionId} className="grid gap-2 rounded-lg border-2 border-black bg-white p-3 text-xs font-bold md:grid-cols-12">
              <div className="md:col-span-4">
                <div className="font-black">{petition.petitionTitle || petition.actionSlug || "Petition"}</div>
                <div className="break-all font-mono text-[11px] text-black/55">{petition.actionSlug || petition.campaignSlug || "No slug"}</div>
              </div>
              <div className="md:col-span-2">
                <Sticker accent={statusAccent(petition.status)}>{petition.status}</Sticker>
              </div>
              <div className="font-mono text-[11px] md:col-span-3">
                <div>Signed {formatDate(petition.occurredAt)}</div>
                <div>Signature {shortId(petition.providerSignatureId)}</div>
              </div>
              <div className="break-all font-mono text-[11px] md:col-span-3">
                <div>Transaction {shortId(petition.transactionId)}</div>
                <div>Lead action {shortId(petition.leadActionId)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-black bg-white p-3 text-sm font-bold">No petition records found for this participant.</div>
      )}
    </div>
  );
}

function buildRows(report: MembershipDiagnosticReport) {
  const profile = report.local.profile;
  const access = report.local.membershipAccess;
  const live = report.live;
  const profileActive = profile?.memberStatus === "active" && profile?.membershipAccessState === "active";
  const accessActive = access?.isActive === true && (!access.accessState || access.accessState === "active");
  const liveActive = live?.isActiveMember === true && live.hubAccess === "allowed";
  const profileNeon = profile?.neonAccountId || null;
  const accessNeon = access?.neonAccountId || null;
  const syntheticNeonId = Boolean((profileNeon || accessNeon || "").match(/[a-z]/i));
  const neonIdsAgree = Boolean(profileNeon && accessNeon && profileNeon === accessNeon);

  return [
    { label: "Supabase Auth user", value: report.local.auth.userId, status: statusFor(report.local.auth.exists) },
    { label: "Hub profile", value: profile?.id, status: statusFor(Boolean(profile)) },
    {
      label: "Profile membership",
      value: `${formatValue(profile?.memberStatus)} / ${formatValue(profile?.membershipAccessState)}`,
      status: statusFor(Boolean(profileActive), Boolean(profile && !profileActive)),
    },
    {
      label: "Profile Neon Account ID",
      value: profileNeon,
      status: statusFor(Boolean(profileNeon), syntheticNeonId),
    },
    {
      label: "membership_access row",
      value: access?.id,
      status: statusFor(Boolean(access)),
    },
    {
      label: "membership_access active",
      value: `${formatValue(access?.isActive)} / ${formatValue(access?.accessState)}`,
      status: statusFor(Boolean(accessActive), Boolean(access && !accessActive)),
    },
    {
      label: "Cached Neon Account ID",
      value: accessNeon,
      status: statusFor(Boolean(accessNeon), syntheticNeonId),
    },
    {
      label: "Neon IDs agree",
      value: neonIdsAgree,
      status: statusFor(neonIdsAgree),
    },
    {
      label: "Live Neon lookup",
      value: report.liveError || live?.outcome,
      status: statusFor(Boolean(liveActive), Boolean(live && !liveActive)),
    },
    {
      label: "Live Hub access",
      value: live?.hubAccess,
      status: statusFor(Boolean(liveActive), Boolean(live && !liveActive)),
    },
    {
      label: "Membership level",
      value: live?.membershipLevel || access?.membershipLevel || profile?.membershipLevel,
      status: statusFor(Boolean(live?.membershipLevel || access?.membershipLevel || profile?.membershipLevel)),
    },
    {
      label: "Last local sync",
      value: formatDate(profile?.membershipLastSyncedAt || access?.lastVerifiedAt || null),
      status: statusFor(Boolean(profile?.membershipLastSyncedAt || access?.lastVerifiedAt)),
    },
  ];
}

export default function AdminMembershipDiagnostics() {
  const [email, setEmail] = useState("hub-qa-member@girlplusenvironment.org");
  const [report, setReport] = useState<MembershipDiagnosticReport | null>(null);
  const [challengeReport, setChallengeReport] = useState<ChallengeDiagnosticReport | null>(null);
  const [crmReport, setCrmReport] = useState<CrmConfigurationReport | null>(null);
  const [petitionReport, setPetitionReport] = useState<PetitionReconciliationReport | null>(null);
  const [membershipRows, setMembershipRows] = useState<AdminMembershipLoadRow[]>([]);
  const [membershipQuery, setMembershipQuery] = useState("");
  const [membershipStatus, setMembershipStatus] = useState("all");
  const [membershipPetitionFilter, setMembershipPetitionFilter] = useState("all");
  const [membershipSort, setMembershipSort] = useState("name_asc");
  const [membershipPage, setMembershipPage] = useState(0);
  const [membershipDetail, setMembershipDetail] = useState<AdminMemberPetitionHistory | null>(null);
  const [petitionQuery, setPetitionQuery] = useState("");
  const [crmLoading, setCrmLoading] = useState(false);
  const [petitionLoading, setPetitionLoading] = useState(false);
  const [petitionReconciling, setPetitionReconciling] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipDetailLoading, setMembershipDetailLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [petitionError, setPetitionError] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);

  const rows = useMemo(() => (report ? buildRows(report) : []), [report]);
  const counts = useMemo(() => ({
    pass: rows.filter((row) => row.status === "pass").length,
    warn: rows.filter((row) => row.status === "warn").length,
    fail: rows.filter((row) => row.status === "fail").length,
  }), [rows]);
  const membershipTotal = Number(membershipRows[0]?.total_count || 0);
  const membershipTotalPages = Math.max(Math.ceil(membershipTotal / membershipPageSize), 1);
  const filteredPetitionRows = useMemo(() => {
    if (!petitionReport) return [];
    const query = petitionQuery.trim().toLowerCase();
    if (!query) return petitionReport.rows;
    return petitionReport.rows.filter((row) => {
      const values = [
        row.displayName,
        row.firstName,
        row.lastName,
        row.email,
        row.petitionTitle,
        row.actionSlug,
        row.campaignSlug,
        row.hubProfileId,
        row.neonAccountId,
        row.providerSignatureId,
        row.submissionId,
        row.leadActionId,
      ];
      return values.some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [petitionQuery, petitionReport]);

  async function runDiagnostic(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setReport(await getMembershipDiagnosticReport(email));
      setChallengeReport(await getChallengeDiagnosticReport());
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Membership diagnostic could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMembershipTable(nextPage = membershipPage) {
    setMembershipLoading(true);
    setMembershipError(null);
    try {
      const data = await getAdminMembershipLoadTable({
        query: membershipQuery,
        status: membershipStatus,
        petitionFilter: membershipPetitionFilter,
        sort: membershipSort,
        limit: membershipPageSize,
        offset: nextPage * membershipPageSize,
      });
      setMembershipRows(data);
      setMembershipPage(nextPage);
    } catch (err) {
      setMembershipRows([]);
      setMembershipError(err instanceof Error ? err.message : "Membership table could not be loaded.");
    } finally {
      setMembershipLoading(false);
    }
  }

  async function openMemberPetitions(row: AdminMembershipLoadRow) {
    if (row.petition_count <= 0) {
      setMembershipDetail({
        participantKey: row.participant_key,
        profileId: row.profile_id,
        displayName: row.display_name,
        email: row.email,
        petitions: [],
      });
      return;
    }
    setMembershipDetailLoading(true);
    setMembershipError(null);
    try {
      setMembershipDetail(await getAdminMemberPetitionHistory(row.participant_key));
    } catch (err) {
      setMembershipError(err instanceof Error ? err.message : "Petition history could not be loaded.");
    } finally {
      setMembershipDetailLoading(false);
    }
  }

  async function runCrmConfigurationCheck() {
    setCrmLoading(true);
    setCrmError(null);
    try {
      setCrmReport(await getCrmConfigurationReport());
    } catch (err) {
      setCrmReport(null);
      setCrmError(err instanceof Error ? err.message : "CRM configuration could not be loaded.");
    } finally {
      setCrmLoading(false);
    }
  }

  async function loadPetitionReconciliation() {
    setPetitionLoading(true);
    setPetitionError(null);
    try {
      setPetitionReport(await getPetitionReconciliationReport());
    } catch (err) {
      setPetitionReport(null);
      setPetitionError(err instanceof Error ? err.message : "Petition reconciliation table could not be loaded.");
    } finally {
      setPetitionLoading(false);
    }
  }

  async function runPetitionReconciliation() {
    setPetitionReconciling(true);
    setPetitionError(null);
    try {
      setPetitionReport(await reconcilePetitionSigners());
    } catch (err) {
      setPetitionError(err instanceof Error ? err.message : "Petition signers could not be reconciled.");
    } finally {
      setPetitionReconciling(false);
    }
  }

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main space-y-6">
        <SectionHeader
          eyebrow={<Sticker accent="cyan">Admin</Sticker>}
          title="Admin Diagnostics"
          description="Compare membership identity state and Camp challenge health before release checks."
          action={
            <>
              <Link to="/admin"><CampButton variant="outline">Admin Hub</CampButton></Link>
              <Link to="/"><CampButton variant="outline">Home</CampButton></Link>
            </>
          }
        />

        <form onSubmit={runDiagnostic} className="gpe-card gpe-paper grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Label htmlFor="diagnostic-email">Member email</Label>
            <Input
              id="diagnostic-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="gpe-press">
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Run Check
          </Button>
        </form>

        <div className="gpe-card overflow-hidden p-0">
          <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Tape>Membership Search</Tape>
              <h2 className="mt-3 font-header text-3xl uppercase">All Members</h2>
            </div>
            <Button type="button" disabled={membershipLoading} onClick={() => void loadMembershipTable(0)} className="gpe-press">
              {membershipLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
              Load Table
            </Button>
          </div>

          <div className="grid gap-3 border-t-[3px] border-black bg-[#f6f1e7] p-4 lg:grid-cols-[1fr_auto_auto_auto]">
            <div>
              <Label htmlFor="membership-table-search">Search</Label>
              <Input
                id="membership-table-search"
                value={membershipQuery}
                onChange={(event) => setMembershipQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadMembershipTable(0);
                }}
                placeholder="Name, email, petition, Hub profile ID, Neon ID"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="membership-status-filter">Status</Label>
              <select id="membership-status-filter" value={membershipStatus} onChange={(event) => setMembershipStatus(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">All statuses</option>
                <option value="hub_active">Hub active</option>
                <option value="hub_incomplete">Hub incomplete</option>
                <option value="missing_hub">Missing Hub</option>
                <option value="missing_neon">Missing Neon</option>
                <option value="active">Active member</option>
                <option value="needs_reconciliation">Needs reconciliation</option>
              </select>
            </div>
            <div>
              <Label htmlFor="membership-petition-filter">Petitions</Label>
              <select id="membership-petition-filter" value={membershipPetitionFilter} onChange={(event) => setMembershipPetitionFilter(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">All</option>
                <option value="has_petitions">Has petitions</option>
                <option value="no_petitions">No petitions</option>
              </select>
            </div>
            <div>
              <Label htmlFor="membership-sort">Sort</Label>
              <select id="membership-sort" value={membershipSort} onChange={(event) => setMembershipSort(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="name_asc">Name</option>
                <option value="created_desc">Newest</option>
                <option value="petitions_desc">Petitions</option>
                <option value="latest_petition_desc">Latest petition</option>
              </select>
            </div>
          </div>

          {membershipError ? (
            <div className="border-t-[3px] border-black bg-red-100 p-4 text-sm font-black text-red-800">
              {membershipError}
            </div>
          ) : null}

          {membershipRows.length > 0 ? (
            <>
              <div className="grid grid-cols-12 gap-3 bg-black px-4 py-3 text-xs font-bold uppercase text-white">
                <div className="col-span-3">Name</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Petitions</div>
                <div className="col-span-2">IDs</div>
              </div>
              {membershipRows.map((row) => (
                <div key={row.participant_key} className="grid gap-3 border-t-[3px] border-black px-4 py-3 text-sm md:grid-cols-12 md:items-start">
                  <div className="md:col-span-3">
                    <div className="font-black">{row.display_name || "Unknown"}</div>
                    <div className="mt-1 font-mono text-[11px] uppercase text-black/50">{formatDate(row.created_at)}</div>
                  </div>
                  <div className="break-all font-mono text-xs font-bold md:col-span-3">{displayEmail(row.email)}</div>
                  <div className="flex flex-wrap gap-1 md:col-span-2">
                    <Sticker accent={statusAccent(row.hub_status)}>Hub {row.hub_status}</Sticker>
                    <Sticker accent={statusAccent(row.membership_status)}>Member {row.membership_status}</Sticker>
                    <Sticker accent={statusAccent(row.neon_status)}>Neon {row.neon_status}</Sticker>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void openMemberPetitions(row)} disabled={membershipDetailLoading}>
                      {row.petition_count} petition{row.petition_count === 1 ? "" : "s"}
                    </Button>
                    {row.latest_petition_at ? (
                      <div className="mt-1 text-xs font-bold text-black/60">{formatDate(row.latest_petition_at)}</div>
                    ) : null}
                  </div>
                  <div className="break-all font-mono text-[11px] md:col-span-2">
                    <div>Hub {shortId(row.profile_id)}</div>
                    <div>Auth {shortId(row.auth_user_id)}</div>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-black p-4 text-sm font-bold">
                <div>Page {membershipPage + 1} of {membershipTotalPages} · {membershipTotal.toLocaleString()} member rows</div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={membershipPage === 0 || membershipLoading} onClick={() => void loadMembershipTable(Math.max(membershipPage - 1, 0))}>Previous</Button>
                  <Button type="button" variant="outline" disabled={membershipPage + 1 >= membershipTotalPages || membershipLoading} onClick={() => void loadMembershipTable(membershipPage + 1)}>Next</Button>
                </div>
              </div>
              {membershipDetail ? <MemberPetitionHistoryPanel history={membershipDetail} /> : null}
            </>
          ) : (
            <div className="border-t-[3px] border-black p-4 text-sm font-bold text-black/65">
              Click Load Table to show all known participants from the production member directory.
            </div>
          )}
        </div>

        {error ? (
          <div className="rounded-lg border-[3px] border-red-600 bg-red-100 p-4 text-sm font-black text-red-800">
            {error}
          </div>
        ) : null}

        <div className="gpe-card overflow-hidden p-0">
          <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Tape>CRM configuration</Tape>
              <h2 className="mt-3 font-header text-3xl uppercase">Neon Readiness</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold text-black/70">
                Validate the required CRM settings before testing membership creation, Office Hours automation, event registration, or petition logging.
              </p>
            </div>
            <Button type="button" disabled={crmLoading} onClick={() => void runCrmConfigurationCheck()} className="gpe-press">
              {crmLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ServerCog className="mr-2 h-4 w-4" />}
              Run Validation
            </Button>
          </div>

          {crmError ? (
            <div className="border-t-[3px] border-black bg-red-100 p-4 text-sm font-black text-red-800">
              {crmError}
            </div>
          ) : null}

          {crmReport ? (
            <>
              <div className="grid gap-4 border-t-[3px] border-black bg-[#f6f1e7] p-4 md:grid-cols-4">
                <StatSticker label="CRM status" value={crmReport.status} accent={crmReport.status === "blocked" ? "orange" : crmReport.status === "warning" ? "yellow" : "cyan"} />
                <StatSticker label="Membership" value={crmReport.membershipCreationEnabled ? "enabled" : "disabled"} accent={crmReport.membershipCreationEnabled ? "cyan" : "orange"} />
                <StatSticker label="Activities" value={crmReport.activityLoggingEnabled ? "enabled" : "disabled"} accent={crmReport.activityLoggingEnabled ? "cyan" : "orange"} />
                <StatSticker label="Office Hours" value={crmReport.officeHoursAutomationReady ? "ready" : "blocked"} accent={crmReport.officeHoursAutomationReady ? "cyan" : "orange"} />
              </div>
              <div className="grid grid-cols-12 gap-3 bg-black px-4 py-3 text-xs font-bold uppercase text-white">
                <div className="col-span-4">Check</div>
                <div className="col-span-2">Need</div>
                <div className="col-span-6">Result</div>
              </div>
              {crmReport.checks.map((check) => (
                <CrmCheckRow key={check.key} check={check} />
              ))}
              {crmReport.blockers.length > 0 ? (
                <div className="border-t-[3px] border-black bg-red-100 p-4 text-sm font-black text-red-900">
                  Membership creation remains disabled: {crmReport.blockers.join(" ")}
                </div>
              ) : null}
            </>
          ) : (
            <div className="border-t-[3px] border-black p-4 text-sm font-bold text-black/65">
              Run validation to check whether production has the Neon membership, activity, Office Hours, Hub invite, and Action Network settings required for end-to-end certification.
            </div>
          )}
        </div>

        <div className="gpe-card overflow-hidden p-0">
          <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Tape>Action Network</Tape>
              <h2 className="mt-3 font-header text-3xl uppercase">Petition Pipeline</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold text-black/70">
                Audit the normal petition lifecycle across Action Network, Neon, Hub linking, points, Camp, and automation. Reconciliation is for historical cleanup only.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={petitionLoading || petitionReconciling} onClick={() => void loadPetitionReconciliation()} className="gpe-press">
                {petitionLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Load Table
              </Button>
              <Button type="button" disabled={petitionLoading || petitionReconciling} onClick={() => void runPetitionReconciliation()} className="gpe-press">
                {petitionReconciling ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ServerCog className="mr-2 h-4 w-4" />}
                Reconcile Signers
              </Button>
            </div>
          </div>

          {petitionError ? (
            <div className="border-t-[3px] border-black bg-red-100 p-4 text-sm font-black text-red-800">
              {petitionError}
            </div>
          ) : null}

          {petitionReport ? (
            <>
              <div className="border-t-[3px] border-black bg-[#f6f1e7] p-4">
                <Label htmlFor="petition-table-search">Search petition table</Label>
                <Input
                  id="petition-table-search"
                  value={petitionQuery}
                  onChange={(event) => setPetitionQuery(event.target.value)}
                  placeholder="Name, email, petition title, Hub profile ID"
                  className="mt-1"
                />
              </div>
              <div className="grid gap-4 border-t-[3px] border-black bg-[#f6f1e7] p-4 md:grid-cols-4">
                <StatSticker label="Rows" value={`${filteredPetitionRows.length}/${petitionReport.rows.length}`} accent="cyan" />
                <StatSticker label="Missing Neon" value={filteredPetitionRows.filter((row) => !row.neonAccountId).length} accent="orange" />
                <StatSticker label="Pending points" value={filteredPetitionRows.filter((row) => row.pointsStatus.startsWith("pending")).length} accent="yellow" />
                <StatSticker label="Reconciled" value={petitionReport.reconciled ?? 0} accent="cyan" />
              </div>
              <div className="grid grid-cols-12 gap-3 bg-black px-4 py-3 text-xs font-bold uppercase text-white">
                <div className="col-span-3">Signer</div>
                <div className="col-span-3">Petition</div>
                <div className="col-span-4">Status</div>
                <div className="col-span-2">Links</div>
              </div>
              {filteredPetitionRows.length > 0 ? (
                filteredPetitionRows.map((row) => (
                  <PetitionReconciliationRowView key={`${row.submissionId || row.leadActionId}-${row.providerSignatureId}`} row={row} />
                ))
              ) : (
                <div className="border-t-[3px] border-black p-4 text-sm font-bold text-black/65">
                  No Action Network petition signer rows matched this search.
                </div>
              )}
            </>
          ) : (
            <div className="border-t-[3px] border-black p-4 text-sm font-bold text-black/65">
              Load the reconciliation table before running a backfill. Reconciliation creates or matches Neon constituent records only; it does not create Neon memberships or active Hub logins.
            </div>
          )}
        </div>

        {report ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <StatSticker label="Passing" value={counts.pass} accent="cyan" />
              <StatSticker label="Warnings" value={counts.warn} accent="yellow" />
              <StatSticker label="Failing" value={counts.fail} accent="orange" />
            </div>

            <div className="gpe-card overflow-hidden p-0">
              <Tape className="m-4">Identity state</Tape>
              <div className="grid grid-cols-12 gap-3 bg-black px-4 py-3 text-xs font-bold uppercase text-white">
                <div className="col-span-4">Check</div>
                <div className="col-span-8">Result</div>
              </div>
              {rows.map((row) => (
                <DiagnosticRow key={row.label} {...row} />
              ))}
            </div>
            {challengeReport ? (
              <div className="gpe-card overflow-hidden p-0">
                <Tape className="m-4">Challenge health</Tape>
                <div className="grid grid-cols-12 gap-3 bg-black px-4 py-3 text-xs font-bold uppercase text-white">
                  <div className="col-span-4">Check</div>
                  <div className="col-span-8">Result</div>
                </div>
                {challengeReport.checks.map((row) => (
                  <DiagnosticRow key={row.label} {...row} />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No Diagnostic Loaded"
            description="Run a check to view the current membership identity state."
            illustration="clipboard"
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
