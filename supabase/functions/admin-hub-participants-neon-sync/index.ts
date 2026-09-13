import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  extractAccountId,
  extractRows,
  findNeonAccountsByEmail,
  getMemberships,
  neonFetch,
  pickMembershipSummary,
  safeError,
  supabaseFetch,
  type Json,
} from "../_shared/neon-membership.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type SyncMode = "participant" | "bulk_page";

type ParticipantRequest = {
  mode?: SyncMode;
  participantKey?: string;
  profileId?: string | null;
  email?: string | null;
  neonAccountId?: string | null;
  page?: number;
  pageSize?: number;
};

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function firstString(record: Json, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object") {
      const nested = value as Json;
      if (typeof nested.name === "string" && nested.name.trim()) return nested.name.trim();
      if (typeof nested.id === "string" && nested.id.trim()) return nested.id.trim();
    }
  }
  return "";
}

function membershipId(membership: Json | null | undefined) {
  if (!membership) return "";
  return firstString(membership, ["membershipId", "id", "membership_id"]);
}

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;

  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !serviceKey) throw new Error("Supabase Auth verification is not configured.");

  const res = await fetch(`${base}/auth/v1/user`, {
    method: "GET",
    headers: { apikey: serviceKey, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null) as { id?: string; email?: string } | null;
  return user?.id ? user : null;
}

async function isAdmin(userId: string) {
  const res = await supabaseFetch("rpc/is_admin", {
    method: "POST",
    body: JSON.stringify({ check_user_id: userId }),
  });
  if (!res.ok) return false;
  return Boolean(await res.json().catch(() => false));
}

async function accountById(accountId: string) {
  return await neonFetch(`/accounts/${encodeURIComponent(accountId)}`, { method: "GET" }, "admin_participant_account_by_id") as Json;
}

async function resolveAccount(args: { email?: string | null; neonAccountId?: string | null }) {
  if (args.neonAccountId) {
    const account = await accountById(args.neonAccountId);
    return { status: "matched_by_id", account, accountId: args.neonAccountId, ambiguous: false };
  }

  const email = normalizeEmail(args.email);
  if (!email) return { status: "missing_lookup_key", account: null, accountId: "", ambiguous: false };

  const matches = await findNeonAccountsByEmail(email);
  if (matches.length === 1) {
    const accountId = extractAccountId(matches[0]);
    return { status: "matched_by_email", account: matches[0], accountId, ambiguous: false };
  }
  if (matches.length > 1) return { status: "ambiguous_email", account: null, accountId: "", ambiguous: true, matchCount: matches.length };
  return { status: "not_found", account: null, accountId: "", ambiguous: false };
}

async function upsertMembershipCache(args: {
  profileId?: string | null;
  normalizedEmail?: string | null;
  neonAccountId: string;
  neonMembershipId?: string | null;
  membershipStatus?: string | null;
  membershipLevel?: string | null;
  membershipStartAt?: string | null;
  membershipEndAt?: string | null;
}) {
  const payload = {
    user_id: args.profileId || null,
    normalized_email: args.normalizedEmail || null,
    neon_account_id: args.neonAccountId,
    neon_membership_id: args.neonMembershipId || null,
    is_active: ["active", "current"].some((status) => String(args.membershipStatus || "").toLowerCase().includes(status)),
    membership_level: args.membershipLevel || null,
    membership_status: args.membershipStatus || null,
    starts_at: args.membershipStartAt || null,
    expires_at: args.membershipEndAt || null,
    access_state: ["active", "current"].some((status) => String(args.membershipStatus || "").toLowerCase().includes(status)) ? "active" : "inactive",
    source: "neon",
    last_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const res = await supabaseFetch("membership_access?on_conflict=neon_account_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`membership_access upsert failed: ${(await res.text()).slice(0, 500)}`);
  return await res.json().catch(() => null);
}

async function patchProfile(args: {
  profileId?: string | null;
  neonAccountId?: string | null;
  membershipStatus?: string | null;
  membershipLevel?: string | null;
  membershipStartAt?: string | null;
  membershipEndAt?: string | null;
}) {
  if (!args.profileId) return null;
  const accessState = ["active", "current"].some((status) => String(args.membershipStatus || "").toLowerCase().includes(status)) ? "active" : "inactive";
  const res = await supabaseFetch(`profiles?id=eq.${encodeURIComponent(args.profileId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      neon_account_id: args.neonAccountId || null,
      membership_access_state: accessState,
      member_status: accessState,
      membership_status: args.membershipStatus || null,
      membership_level: args.membershipLevel || null,
      membership_start_date: args.membershipStartAt || null,
      membership_end_date: args.membershipEndAt || null,
      membership_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`profile membership patch failed: ${(await res.text()).slice(0, 500)}`);
  return await res.json().catch(() => null);
}

async function refreshDirectory() {
  const res = await supabaseFetch("rpc/admin_refresh_hub_participant_directory", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`directory refresh failed: ${(await res.text()).slice(0, 500)}`);
  return await res.json().catch(() => null);
}

async function syncParticipant(body: ParticipantRequest) {
  const normalizedEmail = normalizeEmail(body.email);
  const match = await resolveAccount({ email: normalizedEmail, neonAccountId: body.neonAccountId });
  if (!match.accountId || match.ambiguous) {
    return {
      ok: !match.ambiguous,
      status: match.status,
      participantKey: body.participantKey || null,
      matchCount: "matchCount" in match ? match.matchCount : 0,
    };
  }

  const memberships = await getMemberships(match.accountId);
  const summary = pickMembershipSummary(memberships);
  const active = memberships.find((membership) => {
    const status = firstString(membership, ["status", "membershipStatus", "currentMembershipStatus", "statusName"]).toLowerCase();
    return status.includes("active") || status.includes("current") || membership.isActive === true;
  }) || memberships[0] || null;
  const neonMembershipId = membershipId(active);

  const [membershipCache, profilePatch] = await Promise.all([
    upsertMembershipCache({
      profileId: body.profileId || null,
      normalizedEmail,
      neonAccountId: match.accountId,
      neonMembershipId,
      membershipStatus: summary.membershipStatus,
      membershipLevel: summary.membershipLevel,
      membershipStartAt: summary.membershipStartAt,
      membershipEndAt: summary.membershipEndAt,
    }),
    patchProfile({
      profileId: body.profileId || null,
      neonAccountId: match.accountId,
      membershipStatus: summary.membershipStatus,
      membershipLevel: summary.membershipLevel,
      membershipStartAt: summary.membershipStartAt,
      membershipEndAt: summary.membershipEndAt,
    }),
  ]);

  const directory = await refreshDirectory();

  return {
    ok: true,
    status: match.status,
    participantKey: body.participantKey || null,
    neonAccountId: match.accountId,
    neonMembershipId: neonMembershipId || null,
    membershipSummary: summary,
    membershipCount: memberships.length,
    membershipCache,
    profilePatch,
    directory,
  };
}

async function syncBulkPage(body: ParticipantRequest) {
  const page = Math.max(Number(body.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(body.pageSize || 100), 1), 200);
  const result = await neonFetch(`/accounts?page=${page}&pageSize=${pageSize}`, { method: "GET" }, "admin_participant_bulk_accounts_page") as Json;
  const rows = extractRows(result);
  return {
    ok: true,
    status: "bulk_page_read_only",
    page,
    pageSize,
    accountCount: rows.length,
    message: "Bulk account pagination is prepared. Field mapping should be verified against live Neon account payloads before enabling automatic cache writes.",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  assertAllowedOrigin(origin);
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

  try {
    const user = await authenticatedUser(req);
    if (!user?.id || !(await isAdmin(user.id))) {
      return jsonResponse({ message: "Admin access required." }, 403, origin);
    }

    const body = await req.json().catch(() => ({})) as ParticipantRequest;
    const mode = body.mode || "participant";
    const result = mode === "bulk_page" ? await syncBulkPage(body) : await syncParticipant(body);
    return jsonResponse(result, 200, origin);
  } catch (error) {
    console.error("admin-hub-participants-neon-sync", safeError(error));
    return jsonResponse({ ok: false, message: safeError(error) }, 500, origin);
  }
});
