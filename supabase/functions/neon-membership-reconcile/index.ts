import {
  type Json,
  normalizeEmail,
  resolveMembership,
  safeError,
  sanitizeText,
  supabaseFetch,
} from "../_shared/neon-membership.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type AuthUser = {
  id: string;
  email?: string | null;
  raw_user_meta_data?: Json | null;
  user_metadata?: Json | null;
};

type ProfileRow = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  neon_account_id?: string | null;
  member_status?: string | null;
  membership_access_state?: string | null;
  membership_last_synced_at?: string | null;
};

type Candidate = {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  neonAccountId?: string;
  source: "auth" | "profile";
};

const PROTECTED_STATUSES = new Set(["team", "admin", "staff", "moderator"]);
const STALE_DAYS_DEFAULT = 30;
const MAX_LIMIT = 10_000;

function serviceRoleKey() {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return key;
}

function supabaseUrl() {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!url) throw new Error("Missing SUPABASE_URL.");
  return url;
}

function isAuthorized(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
  const configuredToken = Deno.env.get("MEMBERSHIP_RECONCILIATION_TOKEN") || "";
  return bearer === serviceRoleKey() || (configuredToken.length >= 32 && bearer === configuredToken);
}

async function readBody(req: Request) {
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) return {};
  return await req.json().catch(() => ({}));
}

async function listAuthUsers(limit: number): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  for (let page = 1; users.length < limit; page += 1) {
    const perPage = Math.min(1000, limit - users.length);
    const res = await fetch(`${supabaseUrl()}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: {
        apikey: serviceRoleKey(),
        authorization: `Bearer ${serviceRoleKey()}`,
      },
    });
    if (!res.ok) {
      throw new Error(`auth_admin_users_list failed with HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const body = await res.json().catch(() => ({}));
    const pageUsers = Array.isArray(body.users) ? body.users as AuthUser[] : [];
    users.push(...pageUsers);
    if (pageUsers.length < perPage) break;
  }
  return users;
}

async function listProfiles(limit: number): Promise<ProfileRow[]> {
  const rows: ProfileRow[] = [];
  for (let offset = 0; rows.length < limit; offset += 1000) {
    const upper = Math.min(offset + 999, limit - 1);
    const res = await supabaseFetch(
      "profiles?select=id,email,first_name,last_name,full_name,neon_account_id,member_status,membership_access_state,membership_last_synced_at&email=not.is.null&order=created_at.asc",
      { headers: { Range: `${offset}-${upper}` } }
    );
    if (!res.ok) {
      throw new Error(`profiles_reconciliation_candidates failed with HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const page = await res.json() as ProfileRow[];
    rows.push(...page);
    if (page.length < upper - offset + 1) break;
  }
  return rows.slice(0, limit);
}

async function ensureProfileForUser(user: AuthUser, email: string) {
  const metadata = user.raw_user_meta_data || user.user_metadata || {};
  const firstName = sanitizeText(metadata.first_name, 120);
  const lastName = sanitizeText(metadata.last_name, 120);
  const fullName = sanitizeText(metadata.full_name, 160) || [firstName, lastName].filter(Boolean).join(" ");
  const body: Json = {
    id: user.id,
    email,
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    updated_at: new Date().toISOString(),
  };
  const res = await supabaseFetch("profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`profile_upsert_for_auth_user failed with HTTP ${res.status}`);
}

function shouldCheckProfile(profile: ProfileRow, staleBefore: number, includeSynced: boolean) {
  const status = String(profile.member_status || "").trim().toLowerCase();
  const accessState = String(profile.membership_access_state || "").trim().toLowerCase();
  const syncedAt = Date.parse(profile.membership_last_synced_at || "");
  const recentlySynced = Number.isFinite(syncedAt) && syncedAt >= staleBefore;
  if (PROTECTED_STATUSES.has(status)) return false;
  if (includeSynced) return true;
  if (
    recentlySynced &&
    ["active", "inactive", "expired", "pending_review"].includes(status) &&
    ["active", "inactive", "expired", "not_found", "manual_review"].includes(accessState)
  ) {
    return false;
  }
  if (!status || ["unknown", "pending", "pending_review", "inactive", "expired"].includes(status)) return true;
  if (!accessState || ["unknown", "sync_error"].includes(accessState)) return true;
  if (!profile.neon_account_id && !["not_found", "manual_review"].includes(accessState)) return true;
  return !recentlySynced;
}

function candidateFromProfile(profile: ProfileRow): Candidate | null {
  const email = normalizeEmail(profile.email);
  if (!email) return null;
  return {
    id: profile.id,
    email,
    firstName: sanitizeText(profile.first_name, 120),
    lastName: sanitizeText(profile.last_name, 120),
    neonAccountId: sanitizeText(profile.neon_account_id, 80),
    source: "profile",
  };
}

function candidateFromAuthUser(user: AuthUser): Candidate | null {
  const email = normalizeEmail(user.email);
  if (!email) return null;
  const metadata = user.raw_user_meta_data || user.user_metadata || {};
  return {
    id: user.id,
    email,
    firstName: sanitizeText(metadata.first_name, 120),
    lastName: sanitizeText(metadata.last_name, 120),
    source: "auth",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);
  if (!isAuthorized(req)) return jsonResponse({ message: "Unauthorized." }, 401, origin);

  const startedAt = new Date().toISOString();
  const body = await readBody(req) as Json;
  const dryRun = body.dryRun === true;
  const includeSynced = body.includeSynced === true;
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(body.limit || MAX_LIMIT)));
  const staleDays = Math.max(0, Math.min(366, Number(body.staleDays || STALE_DAYS_DEFAULT)));
  const staleBefore = Date.now() - staleDays * 24 * 60 * 60 * 1000;

  const counts = {
    totalUsersChecked: 0,
    authUsersWithoutProfilesCreated: 0,
    protectedProfilesSkipped: 0,
    activeMembersUpdated: 0,
    inactiveOrExpiredMembersUpdated: 0,
    contactOnlyRecords: 0,
    noNeonMatch: 0,
    ambiguousMatches: 0,
    lookupFailures: 0,
    databaseWriteFailures: 0,
    dryRunCandidates: 0,
  };

  try {
    const [authUsers, profiles] = await Promise.all([listAuthUsers(limit), listProfiles(limit)]);
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    const candidatesByEmail = new Map<string, Candidate>();

    for (const profile of profiles) {
      if (PROTECTED_STATUSES.has(String(profile.member_status || "").trim().toLowerCase())) {
        counts.protectedProfilesSkipped += 1;
        continue;
      }
      if (!shouldCheckProfile(profile, staleBefore, includeSynced)) continue;
      const candidate = candidateFromProfile(profile);
      if (candidate) candidatesByEmail.set(candidate.email, candidate);
    }

    for (const user of authUsers) {
      const email = normalizeEmail(user.email);
      if (!email || profilesById.has(user.id)) continue;
      const candidate = candidateFromAuthUser(user);
      if (!candidate) continue;
      candidatesByEmail.set(email, candidate);
      if (!dryRun) {
        try {
          await ensureProfileForUser(user, email);
          counts.authUsersWithoutProfilesCreated += 1;
        } catch {
          counts.databaseWriteFailures += 1;
        }
      }
    }

    const candidates = Array.from(candidatesByEmail.values()).slice(0, limit);
    counts.dryRunCandidates = dryRun ? candidates.length : 0;

    for (const candidate of candidates) {
      counts.totalUsersChecked += 1;
      if (dryRun) continue;
      try {
        const result = await resolveMembership({
          email: candidate.email,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          neonAccountId: candidate.neonAccountId,
          authenticatedUserId: candidate.id,
          authenticatedEmail: candidate.email,
          suppressTrace: true,
        });

        if (result.databaseWriteFailed) counts.databaseWriteFailures += 1;
        if (result.outcome === "lookup_failed") {
          counts.lookupFailures += 1;
        } else if (result.isActiveMember) {
          counts.activeMembersUpdated += 1;
        } else if (result.outcome === "inactive_or_expired_member") {
          counts.inactiveOrExpiredMembersUpdated += 1;
        } else if (result.outcome === "ambiguous_account") {
          counts.ambiguousMatches += 1;
        } else if (result.matched && result.neonAccountId) {
          counts.contactOnlyRecords += 1;
        } else {
          counts.noNeonMatch += 1;
        }
      } catch (error) {
        counts.lookupFailures += 1;
        console.error("membership reconciliation item failed", { message: safeError(error) });
      }
    }

    console.info("membership reconciliation complete", {
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun,
      includeSynced,
      staleDays,
      ...counts,
    });

    return jsonResponse({
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun,
      includeSynced,
      staleDays,
      counts,
    }, 200, origin);
  } catch (error) {
    console.error("membership reconciliation failed", { message: safeError(error) });
    return jsonResponse({
      message: "Membership reconciliation could not be completed.",
      outcome: "sync_error",
      failureReason: safeError(error),
      counts,
    }, 500, origin);
  }
});
