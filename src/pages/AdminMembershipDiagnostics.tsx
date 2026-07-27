import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Search, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampButton, EmptyState, SectionHeader, StatSticker, Sticker, Tape } from "@/components/camp/CampDesign";
import {
  getMembershipDiagnosticReport,
  type MembershipDiagnosticReport,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => (report ? buildRows(report) : []), [report]);
  const counts = useMemo(() => ({
    pass: rows.filter((row) => row.status === "pass").length,
    warn: rows.filter((row) => row.status === "warn").length,
    fail: rows.filter((row) => row.status === "fail").length,
  }), [rows]);

  async function runDiagnostic(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setReport(await getMembershipDiagnosticReport(email));
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Membership diagnostic could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main space-y-6">
        <SectionHeader
          eyebrow={<Sticker accent="cyan">Admin</Sticker>}
          title="Membership Diagnostics"
          description="Compare Auth, Hub profile, cached membership access, and the live Neon membership decision."
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

        {error ? (
          <div className="rounded-lg border-[3px] border-red-600 bg-red-100 p-4 text-sm font-black text-red-800">
            {error}
          </div>
        ) : null}

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
