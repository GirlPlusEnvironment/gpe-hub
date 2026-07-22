export type Json = Record<string, unknown>;

declare const Deno: {
  env: { get(name: string): string | undefined };
};

export type MembershipCheckOutcome =
  | "active_member_existing_hub_user"
  | "active_member_needs_hub_invite"
  | "inactive_or_expired_member"
  | "nonmember"
  | "ambiguous_account"
  | "lookup_failed";

export type PublicIdentityState =
  | "hub_user_active_member"
  | "hub_user_no_active_membership"
  | "neon_member_needs_hub_activation"
  | "expired_member"
  | "existing_constituent_no_membership"
  | "new_person"
  | "ambiguous_match"
  | "lookup_unavailable";

export type HubAccess = "allowed" | "invite_required" | "membership_required" | "manual_review" | "denied" | "unknown";

export type MembershipCheckResult = {
  matched: boolean;
  isActiveMember: boolean;
  neonAccountId: string | null;
  membershipStatus: string | null;
  membershipLevel: string | null;
  membershipStartAt?: string | null;
  membershipEndAt?: string | null;
  hubAccess: HubAccess;
  outcome: MembershipCheckOutcome;
  publicState: PublicIdentityState;
  hubUserLinked: boolean;
  requiresManualReview: boolean;
  reason?: string;
  databaseWriteFailed?: boolean;
};

export type MembershipLookupInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  neonAccountId?: string;
  authenticatedUserId?: string;
  authenticatedEmail?: string;
  suppressTrace?: boolean;
};

const DEFAULT_NEON_BASE_URL = "https://api.neoncrm.com/v2";
const NEON_API_VERSION = Deno.env.get("NEON_API_VERSION") || "2.11";

class NeonApiError extends Error {
  status: number;
  operation: string;

  constructor(operation: string, status: number, message: string) {
    super(`Neon ${operation} failed (${status}): ${message}`);
    this.name = "NeonApiError";
    this.status = status;
    this.operation = operation;
  }
}

class SupabaseRestError extends Error {
  status: number;
  operation: string;

  constructor(operation: string, status: number, message: string) {
    super(`Supabase ${operation} failed (${status}): ${message}`);
    this.name = "SupabaseRestError";
    this.status = status;
    this.operation = operation;
  }
}

export function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function sanitizeText(value: unknown, max = 500): string {
  return String(value ?? "")
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function getEnv(name: string, required = true): string {
  const value = Deno.env.get(name);
  if (required && !value) throw new Error(`Missing required secret: ${name}`);
  return value || "";
}

export function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic [redacted]").slice(0, 500);
  return "Unknown error";
}

function logDependencyFailure(operation: string, error: unknown) {
  const detail = error instanceof NeonApiError
    ? { operation, dependency: "neon_crm", upstreamStatus: error.status, message: safeError(error) }
    : error instanceof SupabaseRestError
    ? { operation, dependency: "supabase", upstreamStatus: error.status, message: safeError(error) }
    : { operation, message: safeError(error) };
  console.error("membership dependency failure", detail);
}

type MembershipTraceDetail = Record<string, unknown>;

function membershipTrace(traceId: string, step: string, detail: MembershipTraceDetail = {}, suppressTrace = false) {
  if (suppressTrace) return;
  console.info("neon-membership-check trace", {
    traceId,
    step,
    ...detail
  });
}

function neonBaseUrl() {
  const configured = Deno.env.get("NEON_API_BASE_URL") || Deno.env.get("NEON_BASE_URL") || DEFAULT_NEON_BASE_URL;
  const trimmed = configured.trim().replace(/\/+$/, "");
  if (/^https:\/\/api\.neoncrm\.com$/i.test(trimmed)) {
    return `${trimmed}/v2`;
  }
  return trimmed;
}

function serviceHeaders(extra: HeadersInit = {}): HeadersInit {
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    ...extra
  };
}

export async function supabaseFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = getEnv("SUPABASE_URL").replace(/\/$/, "");
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders(init.headers || {})
  });
}

async function assertSupabaseOk(res: Response, operation: string) {
  if (res.ok) return;
  const text = await res.text();
  throw new SupabaseRestError(operation, res.status, text.slice(0, 500));
}

async function supabaseRows<T = Json>(path: string, operation: string): Promise<T[]> {
  const res = await supabaseFetch(path);
  await assertSupabaseOk(res, operation);
  return await res.json();
}

function neonHeaders(): HeadersInit {
  const auth = btoa(`${getEnv("NEON_ORG_ID")}:${getEnv("NEON_API_KEY")}`);
  return {
    "Content-Type": "application/json",
    "Authorization": `Basic ${auth}`,
    "NEON-API-VERSION": NEON_API_VERSION
  };
}

export async function neonFetch(path: string, init: RequestInit = {}, operation = path) {
  const res = await fetch(`${neonBaseUrl()}${path}`, {
    ...init,
    headers: { ...neonHeaders(), ...(init.headers || {}) }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new NeonApiError(operation, res.status, text.slice(0, 220));
  }
  return res.json().catch(() => ({}));
}

export function extractRows(result: unknown): Json[] {
  const data = result as Json;
  const embedded = (data._embedded || {}) as Json;
  const candidates = [
    data.searchResults,
    data.results,
    data.accounts,
    data.memberships,
    data.data,
    embedded.accounts,
    embedded.memberships,
    embedded.items
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Json[];
  }
  return [];
}

export function extractAccountId(record: Json): string {
  const account = (record.account || {}) as Json;
  return String(record.accountId || record.id || account.id || account.accountId || "");
}

function lower(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export async function findNeonAccountsByEmail(email: string): Promise<Json[]> {
  const searchBody = (emailField: string) => ({
    searchFields: [{ field: emailField, operator: "EQUAL", value: email }],
    outputFields: ["Account ID", "First Name", "Last Name", emailField],
    pagination: { pageSize: 10, currentPage: 1 }
  });
  const initFor = (emailField: string) => ({
    method: "POST",
    body: JSON.stringify(searchBody(emailField))
  });
  try {
    const result = await neonFetch("/accounts/search", initFor("Email"), "account_search_by_email");
    return extractRows(result).filter((row) => extractAccountId(row));
  } catch (error) {
    if (error instanceof NeonApiError && error.status === 400) {
      logDependencyFailure("account_search_by_email", error);
      const fallbackResult = await neonFetch("/accounts/search", initFor("Email 1"), "account_search_by_email_1");
      return extractRows(fallbackResult).filter((row) => extractAccountId(row));
    }
    throw error;
  }
}

export function resolveAccountMatch(accounts: Json[], firstName?: string, lastName?: string) {
  if (accounts.length === 0) return { status: "none" as const, neonAccountId: null };
  if (accounts.length === 1) return { status: "matched" as const, neonAccountId: extractAccountId(accounts[0]) };

  const normalizedFirst = lower(firstName);
  const normalizedLast = lower(lastName);
  if (normalizedFirst && normalizedLast) {
    const sameName = accounts.filter((row) =>
      lower(row.firstName || row["First Name"]) === normalizedFirst &&
      lower(row.lastName || row["Last Name"]) === normalizedLast
    );
    if (sameName.length === 1) return { status: "matched" as const, neonAccountId: extractAccountId(sameName[0]) };
  }

  return { status: "ambiguous" as const, neonAccountId: null };
}

export async function getMemberships(accountId: string): Promise<Json[]> {
  const result = await neonFetch(`/accounts/${encodeURIComponent(accountId)}/memberships`, { method: "GET" }, "account_memberships");
  return extractRows(result);
}

function nestedString(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Json;
    return String(record.name || record.value || record.label || record.status || "").trim();
  }
  return "";
}

function firstString(record: Json, keys: string[]): string {
  for (const key of keys) {
    const value = nestedString(record[key]);
    if (value) return value;
  }
  return "";
}

function membershipStatus(membership: Json): string {
  return firstString(membership, [
    "status",
    "membershipStatus",
    "currentMembershipStatus",
    "statusName",
    "membershipStatusName",
    "termStatus"
  ]);
}

function membershipLevel(membership: Json): string {
  return firstString(membership, [
    "level",
    "membershipLevel",
    "membershipLevelName",
    "levelName",
    "membershipName",
    "termLevel"
  ]);
}

function dateString(membership: Json, keys: string[]): string | null {
  for (const key of keys) {
    const value = nestedString(membership[key]);
    if (value) return value;
  }
  return null;
}

function membershipStartAt(membership: Json): string | null {
  return dateString(membership, [
    "startsAt",
    "startAt",
    "startDate",
    "membershipStartDate",
    "membership_start_date",
    "termStartDate",
    "joinDate",
    "joinedDate",
    "validFrom",
    "dateFrom"
  ]);
}

function membershipEndAt(membership: Json): string | null {
  return dateString(membership, [
    "expiresAt",
    "expirationDate",
    "expireDate",
    "expiryDate",
    "endAt",
    "endDate",
    "membershipExpirationDate",
    "membership_expiration_date",
    "membershipEndDate",
    "termEndDate",
    "validThrough",
    "dateTo"
  ]);
}

function parseDateMillis(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: string | null): string | null {
  const millis = parseDateMillis(value);
  if (millis === null) return null;
  return new Date(millis).toISOString().slice(0, 10);
}

export function pickMembershipSummary(memberships: Json[]) {
  const first = memberships[0] || {};
  const active = memberships.find(isEligibleMembership);
  const selected = active || first;
  return {
    membershipStatus: membershipStatus(selected) || (active ? "Active" : null),
    membershipLevel: membershipLevel(selected) || null,
    membershipStartAt: isoDate(membershipStartAt(selected)),
    membershipEndAt: isoDate(membershipEndAt(selected))
  };
}

export function isEligibleMembership(membership: Json): boolean {
  const eligibleLevels = (Deno.env.get("ELIGIBLE_MEMBERSHIP_LEVELS") || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const eligibleStatuses = (Deno.env.get("ELIGIBLE_MEMBERSHIP_STATUSES") || "active,current").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const active = membership.isActive === true || membership.primaryActiveMembership === true;
  const level = membershipLevel(membership).toLowerCase();
  const status = membershipStatus(membership).toLowerCase();
  const inactiveStatus = ["expired", "inactive", "lapsed", "cancel", "canceled", "cancelled", "terminated", "suspended"].some((item) =>
    status.includes(item)
  );
  const startMillis = parseDateMillis(membershipStartAt(membership));
  const endMillis = parseDateMillis(membershipEndAt(membership));
  const now = Date.now();
  const levelOk = eligibleLevels.length === 0 || eligibleLevels.includes(level);
  const statusOk = !inactiveStatus && (active || eligibleStatuses.some((item) => status.includes(item)));
  const dateOk = (startMillis === null || startMillis <= now) && (endMillis === null || endMillis >= now);
  return levelOk && statusOk && dateOk;
}

export function hasEligibleMembership(memberships: Json[]): boolean {
  return memberships.some(isEligibleMembership);
}

type HubProfileRecord = {
  id: string;
  email?: string | null;
  neon_account_id?: string | null;
  member_status?: string | null;
  membership_level?: string | null;
  membership_start_date?: string | null;
  membership_end_date?: string | null;
  membership_last_synced_at?: string | null;
  membership_access_state?: string | null;
};

const HUB_PROFILE_FIELDS = [
  "id",
  "email",
  "neon_account_id",
  "member_status"
].join(",");

async function profileById(userId: string): Promise<HubProfileRecord | null> {
  const rows = await supabaseRows<HubProfileRecord>(
    `profiles?select=${HUB_PROFILE_FIELDS}&id=eq.${encodeURIComponent(userId)}&limit=1`,
    "profile_lookup_by_auth_user_id"
  );
  return rows[0]?.id ? rows[0] : null;
}

async function profileByEmail(email: string): Promise<HubProfileRecord | null> {
  const rows = await supabaseRows<HubProfileRecord>(
    `profiles?select=${HUB_PROFILE_FIELDS}&email=eq.${encodeURIComponent(email)}&limit=1`,
    "profile_lookup_by_email"
  );
  return rows[0]?.id ? rows[0] : null;
}

async function profileByNeonAccountId(accountId: string): Promise<HubProfileRecord | null> {
  const rows = await supabaseRows<HubProfileRecord>(
    `profiles?select=${HUB_PROFILE_FIELDS}&neon_account_id=eq.${encodeURIComponent(accountId)}&limit=1`,
    "profile_lookup_by_neon_account_id"
  );
  return rows[0]?.id ? rows[0] : null;
}

async function syncHubProfileMembership(args: {
  profile: HubProfileRecord;
  accountId: string;
  summary: ReturnType<typeof pickMembershipSummary>;
  isActive: boolean;
}) {
  const currentStatus = lower(profile.member_status);
  const protectedStatuses = new Set(["team", "admin", "staff", "moderator"]);
  const now = new Date().toISOString();
  const legacyBody: Json = {
    neon_account_id: args.accountId,
    updated_at: now
  };
  const body: Json = {
    ...legacyBody,
    membership_level: args.summary.membershipLevel,
    membership_start_date: args.summary.membershipStartAt,
    membership_end_date: args.summary.membershipEndAt,
    membership_last_synced_at: now,
    membership_access_state: args.isActive
      ? "active"
      : args.summary.membershipEndAt
      ? "expired"
      : "inactive",
    updated_at: now
  };
  if (!protectedStatuses.has(currentStatus)) {
    legacyBody.member_status = args.isActive
      ? "active"
      : args.summary.membershipEndAt
      ? "expired"
      : "inactive";
    body.member_status = args.isActive
      ? "active"
      : args.summary.membershipEndAt
      ? "expired"
      : "inactive";
  }
  const res = await supabaseFetch(`profiles?id=eq.${encodeURIComponent(args.profile.id)}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  try {
    await assertSupabaseOk(res, "profile_membership_sync_update");
  } catch (error) {
    if (
      error instanceof SupabaseRestError &&
      /membership_(level|start_date|end_date|last_synced_at|access_state)|column/i.test(error.message)
    ) {
      const legacyRes = await supabaseFetch(`profiles?id=eq.${encodeURIComponent(args.profile.id)}`, {
        method: "PATCH",
        body: JSON.stringify(legacyBody)
      });
      await assertSupabaseOk(legacyRes, "profile_membership_legacy_sync_update");
      return;
    }
    throw error;
  }
}

async function syncHubProfileResolution(args: {
  profile: HubProfileRecord;
  accessState: "not_found" | "manual_review" | "sync_error";
}) {
  const currentStatus = lower(args.profile.member_status);
  const protectedStatuses = new Set(["team", "admin", "staff", "moderator"]);
  const now = new Date().toISOString();
  const body: Json = {
    membership_access_state: args.accessState,
    membership_last_synced_at: now,
    updated_at: now
  };
  if (!protectedStatuses.has(currentStatus)) {
    body.member_status = args.accessState === "manual_review" ? "pending_review" : "inactive";
  }
  const res = await supabaseFetch(`profiles?id=eq.${encodeURIComponent(args.profile.id)}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  try {
    await assertSupabaseOk(res, "profile_membership_resolution_update");
  } catch (error) {
    if (error instanceof SupabaseRestError && /membership_(last_synced_at|access_state)|column/i.test(error.message)) {
      return;
    }
    throw error;
  }
}

async function upsertMembershipAccess(args: {
  email: string;
  accountId: string;
  profile: HubProfileRecord | null;
  authenticatedUserId?: string;
  summary: ReturnType<typeof pickMembershipSummary>;
  isActive: boolean;
}) {
  const body = {
    user_id: args.profile?.id || args.authenticatedUserId || null,
    neon_account_id: args.accountId,
    normalized_email: args.email,
    is_active: args.isActive,
    access_state: args.isActive
      ? "active"
      : args.summary.membershipEndAt
      ? "expired"
      : "inactive",
    membership_level: args.summary.membershipLevel,
    membership_status: args.summary.membershipStatus,
    starts_at: args.summary.membershipStartAt,
    expires_at: args.summary.membershipEndAt,
    source: "neon",
    last_verified_at: new Date().toISOString()
  };
  const res = await supabaseFetch("membership_access?on_conflict=neon_account_id", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify(body)
  });
  try {
    await assertSupabaseOk(res, "membership_access_upsert");
  } catch (error) {
    if (error instanceof SupabaseRestError && /access_state|column/i.test(error.message)) {
      const { access_state: _accessState, ...legacyBody } = body;
      const legacyRes = await supabaseFetch("membership_access?on_conflict=neon_account_id", {
        method: "POST",
        headers: { "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify(legacyBody)
      });
      await assertSupabaseOk(legacyRes, "membership_access_legacy_upsert");
      return;
    }
    throw error;
  }
}

export async function existingHubAccess(
  email: string,
  accountId: string,
  summary?: ReturnType<typeof pickMembershipSummary>,
  traceId?: string,
  authenticatedUserId?: string,
  suppressTrace = false
) {
  const accountRows = await supabaseRows(
    `membership_access?select=*&neon_account_id=eq.${encodeURIComponent(accountId)}&limit=1`,
    "membership_access_lookup_by_neon_account_id"
  );
  membershipTrace(traceId || "unknown", "membership_access_lookup_by_neon_account_id", {
    found: Boolean(accountRows[0]),
    linkedUserId: Boolean(accountRows[0]?.user_id),
    isActive: Boolean(accountRows[0]?.is_active)
  }, suppressTrace);
  if (
    accountRows[0]?.user_id &&
    accountRows[0]?.is_active &&
    (!authenticatedUserId || accountRows[0].user_id === authenticatedUserId)
  ) {
    return accountRows[0];
  }

  const emailRows = await supabaseRows(
    `membership_access?select=*&normalized_email=eq.${encodeURIComponent(email)}&limit=1`,
    "membership_access_lookup_by_email"
  );
  membershipTrace(traceId || "unknown", "membership_access_lookup_by_email", {
    found: Boolean(emailRows[0]),
    linkedUserId: Boolean(emailRows[0]?.user_id),
    isActive: Boolean(emailRows[0]?.is_active)
  }, suppressTrace);
  if (
    emailRows[0]?.user_id &&
    emailRows[0]?.is_active &&
    (!authenticatedUserId || emailRows[0].user_id === authenticatedUserId)
  ) {
    return emailRows[0];
  }

  const profile = authenticatedUserId
    ? await profileById(authenticatedUserId) || await profileByNeonAccountId(accountId) || await profileByEmail(email)
    : await profileByNeonAccountId(accountId) || await profileByEmail(email);
  membershipTrace(traceId || "unknown", "hub_profile_lookup_for_linking", {
    found: Boolean(profile),
    matchedAuthenticatedUser: Boolean(authenticatedUserId && profile?.id === authenticatedUserId),
    profileHasNeonAccountId: Boolean(profile?.neon_account_id),
    memberStatus: profile?.member_status || null
  }, suppressTrace);
  if (!profile) {
    if (summary) {
      await upsertMembershipAccess({ email, accountId, profile: null, authenticatedUserId, summary, isActive: true });
      membershipTrace(traceId || "unknown", "membership_access_upsert", {
        succeeded: true,
        linkedUserId: false,
        isActive: true
      }, suppressTrace);
    }
    return null;
  }

  if (summary) {
    await syncHubProfileMembership({ profile, accountId, summary, isActive: true });
  }
  membershipTrace(traceId || "unknown", "profile_membership_sync_update", {
    succeeded: true,
    profileId: profile.id,
    neonAccountId: accountId
  }, suppressTrace);
  if (summary) {
    await upsertMembershipAccess({ email, accountId, profile, authenticatedUserId, summary, isActive: true });
    membershipTrace(traceId || "unknown", "membership_access_upsert", {
      succeeded: true,
      linkedUserId: true,
      isActive: true
    }, suppressTrace);
  }
  return { user_id: profile.id, is_active: true, neon_account_id: accountId, normalized_email: email };
}

export async function existingHubProfile(email: string) {
  return profileByEmail(email);
}

export async function resolveMembership(input: MembershipLookupInput): Promise<MembershipCheckResult> {
  const traceId = crypto.randomUUID();
  const suppressTrace = Boolean(input.suppressTrace);
  const trace = (step: string, detail: MembershipTraceDetail = {}) => membershipTrace(traceId, step, detail, suppressTrace);
  const email = normalizeEmail(input.authenticatedEmail || input.email);
  const firstName = sanitizeText(input.firstName, 120);
  const lastName = sanitizeText(input.lastName, 120);
  const suppliedAccountId = sanitizeText(input.neonAccountId, 80);
  const authenticatedUserId = sanitizeText(input.authenticatedUserId, 80);

  trace("email_normalization", {
    receivedEmail: sanitizeText(input.email, 320),
    normalizedEmail: email,
    hasFirstName: Boolean(firstName),
    hasLastName: Boolean(lastName),
    hasSuppliedNeonAccountId: Boolean(suppliedAccountId),
    hasAuthenticatedUser: Boolean(authenticatedUserId)
  });

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    trace("final_decision", {
      outcome: "lookup_failed",
      hubAccess: "unknown",
      reason: "invalid_email"
    });
    return {
      matched: false,
      isActiveMember: false,
      neonAccountId: null,
      membershipStatus: null,
      membershipLevel: null,
      membershipStartAt: null,
      membershipEndAt: null,
      hubAccess: "unknown",
      outcome: "lookup_failed",
      publicState: "lookup_unavailable",
      hubUserLinked: false,
      requiresManualReview: false,
      reason: "A valid email is required."
    };
  }

  try {
    let hubProfile = null;
    try {
      hubProfile = authenticatedUserId
        ? await profileById(authenticatedUserId) || await existingHubProfile(email)
        : await existingHubProfile(email);
      trace(authenticatedUserId ? "hub_profile_lookup_by_auth_user_id_or_email" : "hub_profile_lookup_by_email", {
        found: Boolean(hubProfile),
        matchedAuthenticatedUser: Boolean(authenticatedUserId && hubProfile?.id === authenticatedUserId),
        profileHasNeonAccountId: Boolean(hubProfile?.neon_account_id),
        memberStatus: hubProfile?.member_status || null
      });
    } catch (error) {
      logDependencyFailure("hub_profile_lookup", error);
      throw error;
    }
    let neonAccountId = suppliedAccountId;
    if (!neonAccountId) {
      let accounts: Json[] = [];
      try {
        accounts = await findNeonAccountsByEmail(email);
        trace("neon_constituent_lookup", {
          found: accounts.length > 0,
          matchCount: accounts.length,
          accountIds: suppressTrace ? undefined : accounts.map(extractAccountId).filter(Boolean)
        });
      } catch (error) {
        logDependencyFailure("neon_account_search", error);
        throw error;
      }
      const match = resolveAccountMatch(accounts, firstName, lastName);
      trace("neon_constituent_match", {
        status: match.status,
        neonAccountId: suppressTrace ? undefined : match.neonAccountId
      });
      if (match.status === "none") {
        let databaseWriteFailed = false;
        if (hubProfile) {
          try {
            await syncHubProfileResolution({ profile: hubProfile, accessState: "not_found" });
          } catch (error) {
            databaseWriteFailed = true;
            logDependencyFailure("profile_membership_not_found_update", error);
          }
        }
        trace("final_decision", {
          outcome: "nonmember",
          hubAccess: "membership_required",
          reason: "no_neon_constituent_found",
          liveLookupCompleted: true,
          databaseWriteFailed
        });
        return {
          matched: false,
          isActiveMember: false,
          neonAccountId: null,
          membershipStatus: null,
          membershipLevel: null,
          membershipStartAt: null,
          membershipEndAt: null,
          hubAccess: "membership_required",
          outcome: "nonmember",
          publicState: hubProfile ? "hub_user_no_active_membership" : "new_person",
          hubUserLinked: Boolean(hubProfile),
          requiresManualReview: false,
          databaseWriteFailed
        };
      }
      if (match.status === "ambiguous") {
        let databaseWriteFailed = false;
        if (hubProfile) {
          try {
            await syncHubProfileResolution({ profile: hubProfile, accessState: "manual_review" });
          } catch (error) {
            databaseWriteFailed = true;
            logDependencyFailure("profile_membership_manual_review_update", error);
          }
        }
        trace("final_decision", {
          outcome: "ambiguous_account",
          hubAccess: "manual_review",
          reason: "multiple_neon_constituents_found",
          liveLookupCompleted: true,
          databaseWriteFailed
        });
        return {
          matched: true,
          isActiveMember: false,
          neonAccountId: null,
          membershipStatus: null,
          membershipLevel: null,
          membershipStartAt: null,
          membershipEndAt: null,
          hubAccess: "manual_review",
          outcome: "ambiguous_account",
          publicState: "ambiguous_match",
          hubUserLinked: Boolean(hubProfile),
          requiresManualReview: true,
          databaseWriteFailed,
          reason: "Multiple Neon accounts matched the submitted email."
        };
      }
      neonAccountId = match.neonAccountId || "";
    }

    if (!neonAccountId) throw new Error("Neon account could not be resolved.");

    let memberships: Json[] = [];
    try {
      memberships = await getMemberships(neonAccountId);
      trace("neon_membership_lookup", {
        neonAccountId: suppressTrace ? undefined : neonAccountId,
        membershipCount: memberships.length,
        rawMembershipStatuses: memberships.map(membershipStatus),
        rawMembershipLevels: memberships.map(membershipLevel)
      });
    } catch (error) {
      logDependencyFailure("neon_membership_lookup", error);
      throw error;
    }
    const isActiveMember = hasEligibleMembership(memberships);
    const summary = pickMembershipSummary(memberships);
    trace("eligibility_evaluation", {
      isActiveMember,
      membershipStatus: summary.membershipStatus,
      membershipLevel: summary.membershipLevel,
      membershipStartAt: summary.membershipStartAt,
      membershipEndAt: summary.membershipEndAt,
      eligibleMembershipCount: memberships.filter(isEligibleMembership).length
    });
    if (!isActiveMember) {
      let databaseWriteFailed = false;
      try {
        if (hubProfile) {
          await syncHubProfileMembership({ profile: hubProfile, accountId: neonAccountId, summary, isActive: false });
          trace("profile_membership_sync_update", {
            succeeded: true,
            profileId: hubProfile.id,
            isActive: false
          });
        }
        await upsertMembershipAccess({ email, accountId: neonAccountId, profile: hubProfile, authenticatedUserId: authenticatedUserId || undefined, summary, isActive: false });
        trace("membership_access_upsert", {
          succeeded: true,
          linkedUserId: Boolean(hubProfile),
          isActive: false
        });
      } catch (error) {
        databaseWriteFailed = true;
        logDependencyFailure("membership_access_cache_update", error);
        trace("membership_access_upsert", {
          succeeded: false,
          isActive: false,
          error: safeError(error)
        });
      }
      trace("final_decision", {
        outcome: memberships.length > 0 ? "inactive_or_expired_member" : "nonmember",
        hubAccess: "membership_required",
        liveLookupCompleted: true,
        databaseWriteFailed
      });
      return {
        matched: true,
        isActiveMember: false,
        neonAccountId,
        membershipStatus: summary.membershipStatus,
        membershipLevel: summary.membershipLevel,
        membershipStartAt: summary.membershipStartAt,
        membershipEndAt: summary.membershipEndAt,
        hubAccess: "membership_required",
        outcome: memberships.length > 0 ? "inactive_or_expired_member" : "nonmember",
        publicState: memberships.length > 0 ? "expired_member" : hubProfile ? "hub_user_no_active_membership" : "existing_constituent_no_membership",
        hubUserLinked: Boolean(hubProfile),
        requiresManualReview: false,
        databaseWriteFailed
      };
    }

    let hubAccess = null;
    try {
      hubAccess = await existingHubAccess(email, neonAccountId, summary, traceId, authenticatedUserId || undefined, suppressTrace);
    } catch (error) {
      logDependencyFailure("hub_access_lookup", error);
      throw error;
    }
    trace("final_decision", {
      outcome: hubAccess ? "active_member_existing_hub_user" : "active_member_needs_hub_invite",
      hubAccess: hubAccess ? "allowed" : "invite_required",
      liveLookupCompleted: true,
      hubUserLinked: Boolean(hubAccess || hubProfile)
    });
    return {
      matched: true,
      isActiveMember: true,
      neonAccountId,
      membershipStatus: summary.membershipStatus || "Active",
      membershipLevel: summary.membershipLevel,
      membershipStartAt: summary.membershipStartAt,
      membershipEndAt: summary.membershipEndAt,
      hubAccess: hubAccess ? "allowed" : "invite_required",
      outcome: hubAccess ? "active_member_existing_hub_user" : "active_member_needs_hub_invite",
      publicState: hubAccess ? "hub_user_active_member" : "neon_member_needs_hub_activation",
      hubUserLinked: Boolean(hubAccess || hubProfile),
      requiresManualReview: false
    };
  } catch (error) {
    console.error("neon-membership-resolver", safeError(error));
    const reason = error instanceof NeonApiError
      ? `Neon CRM ${error.operation} returned HTTP ${error.status}.`
      : error instanceof SupabaseRestError
      ? `Supabase ${error.operation} returned HTTP ${error.status}.`
      : "Membership lookup failed.";
    trace("final_decision", {
      outcome: "lookup_failed",
      hubAccess: "unknown",
      error: safeError(error)
    });
    return {
      matched: false,
      isActiveMember: false,
      neonAccountId: null,
      membershipStatus: null,
      membershipLevel: null,
      membershipStartAt: null,
      membershipEndAt: null,
      hubAccess: "unknown",
      outcome: "lookup_failed",
      publicState: "lookup_unavailable",
      hubUserLinked: false,
      requiresManualReview: false,
      reason
    };
  }
}
