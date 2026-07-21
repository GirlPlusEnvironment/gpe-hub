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
  hubAccess: HubAccess;
  outcome: MembershipCheckOutcome;
  publicState: PublicIdentityState;
  hubUserLinked: boolean;
  requiresManualReview: boolean;
  reason?: string;
};

export type MembershipLookupInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  neonAccountId?: string;
};

const NEON_BASE_URL = Deno.env.get("NEON_BASE_URL") || "https://api.neoncrm.com/v2";
const NEON_API_VERSION = Deno.env.get("NEON_API_VERSION") || "2.11";

export function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function sanitizeText(value: unknown, max = 500): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
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

function neonHeaders(): HeadersInit {
  const auth = btoa(`${getEnv("NEON_ORG_ID")}:${getEnv("NEON_API_KEY")}`);
  return {
    "Content-Type": "application/json",
    "Authorization": `Basic ${auth}`,
    "NEON-API-VERSION": NEON_API_VERSION
  };
}

export async function neonFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${NEON_BASE_URL}${path}`, {
    ...init,
    headers: { ...neonHeaders(), ...(init.headers || {}) }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Neon request failed (${res.status}): ${text.slice(0, 220)}`);
  }
  return res.json().catch(() => ({}));
}

export function extractRows(result: unknown): Json[] {
  const data = result as Json;
  const candidates = [data.searchResults, data.results, data.accounts, data.memberships, data.data];
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
  const result = await neonFetch("/accounts/search", {
    method: "POST",
    body: JSON.stringify({
      searchFields: [{ field: "Email", operator: "EQUAL", value: email }],
      outputFields: ["Account ID", "First Name", "Last Name", "Email"],
      pagination: { pageSize: 10, currentPage: 1 }
    })
  });
  return extractRows(result).filter((row) => extractAccountId(row));
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
  const result = await neonFetch(`/accounts/${encodeURIComponent(accountId)}/memberships`, { method: "GET" });
  return extractRows(result);
}

function membershipStatus(membership: Json): string {
  return String(membership.status || membership.membershipStatus || membership.statusName || "");
}

function membershipLevel(membership: Json): string {
  const levelRecord = (membership.level || {}) as Json;
  return String(levelRecord.name || membership.membershipLevel || membership.levelName || "");
}

export function pickMembershipSummary(memberships: Json[]) {
  const first = memberships[0] || {};
  const active = memberships.find(isEligibleMembership);
  const selected = active || first;
  return {
    membershipStatus: membershipStatus(selected) || (active ? "Active" : null),
    membershipLevel: membershipLevel(selected) || null
  };
}

export function isEligibleMembership(membership: Json): boolean {
  const eligibleLevels = (Deno.env.get("ELIGIBLE_MEMBERSHIP_LEVELS") || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const eligibleStatuses = (Deno.env.get("ELIGIBLE_MEMBERSHIP_STATUSES") || "active,current").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const active = membership.isActive === true || membership.primaryActiveMembership === true;
  const level = membershipLevel(membership).toLowerCase();
  const status = membershipStatus(membership).toLowerCase();
  const levelOk = eligibleLevels.length === 0 || eligibleLevels.includes(level);
  const statusOk = active || eligibleStatuses.some((item) => status.includes(item));
  return levelOk && statusOk;
}

export function hasEligibleMembership(memberships: Json[]): boolean {
  return memberships.some(isEligibleMembership);
}

export async function existingHubAccess(email: string, accountId: string) {
  const byAccount = await supabaseFetch(`membership_access?select=*&neon_account_id=eq.${encodeURIComponent(accountId)}&limit=1`);
  const accountRows = byAccount.ok ? await byAccount.json() : [];
  if (accountRows[0]?.user_id && accountRows[0]?.is_active) return accountRows[0];

  const byEmail = await supabaseFetch(`membership_access?select=*&normalized_email=eq.${encodeURIComponent(email)}&limit=1`);
  const emailRows = byEmail.ok ? await byEmail.json() : [];
  return emailRows[0]?.user_id && emailRows[0]?.is_active ? emailRows[0] : null;
}

export async function existingHubProfile(email: string) {
  const res = await supabaseFetch(`profiles?select=id,email&email=eq.${encodeURIComponent(email)}&limit=1`);
  const rows = res.ok ? await res.json() : [];
  return rows[0]?.id ? rows[0] : null;
}

export async function resolveMembership(input: MembershipLookupInput): Promise<MembershipCheckResult> {
  const email = normalizeEmail(input.email);
  const firstName = sanitizeText(input.firstName, 120);
  const lastName = sanitizeText(input.lastName, 120);
  const suppliedAccountId = sanitizeText(input.neonAccountId, 80);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return {
      matched: false,
      isActiveMember: false,
      neonAccountId: null,
      membershipStatus: null,
      membershipLevel: null,
      hubAccess: "unknown",
      outcome: "lookup_failed",
      publicState: "lookup_unavailable",
      hubUserLinked: false,
      requiresManualReview: false,
      reason: "A valid email is required."
    };
  }

  try {
    const hubProfile = await existingHubProfile(email);
    let neonAccountId = suppliedAccountId;
    if (!neonAccountId) {
      const accounts = await findNeonAccountsByEmail(email);
      const match = resolveAccountMatch(accounts, firstName, lastName);
      if (match.status === "none") {
        return {
          matched: false,
          isActiveMember: false,
          neonAccountId: null,
          membershipStatus: null,
          membershipLevel: null,
          hubAccess: "membership_required",
          outcome: "nonmember",
          publicState: hubProfile ? "hub_user_no_active_membership" : "new_person",
          hubUserLinked: Boolean(hubProfile),
          requiresManualReview: false
        };
      }
      if (match.status === "ambiguous") {
        return {
          matched: true,
          isActiveMember: false,
          neonAccountId: null,
          membershipStatus: null,
          membershipLevel: null,
          hubAccess: "manual_review",
          outcome: "ambiguous_account",
          publicState: "ambiguous_match",
          hubUserLinked: Boolean(hubProfile),
          requiresManualReview: true,
          reason: "Multiple Neon accounts matched the submitted email."
        };
      }
      neonAccountId = match.neonAccountId || "";
    }

    if (!neonAccountId) throw new Error("Neon account could not be resolved.");

    const memberships = await getMemberships(neonAccountId);
    const isActiveMember = hasEligibleMembership(memberships);
    const summary = pickMembershipSummary(memberships);
    if (!isActiveMember) {
      return {
        matched: true,
        isActiveMember: false,
        neonAccountId,
        membershipStatus: summary.membershipStatus,
        membershipLevel: summary.membershipLevel,
        hubAccess: "membership_required",
        outcome: memberships.length > 0 ? "inactive_or_expired_member" : "nonmember",
        publicState: memberships.length > 0 ? "expired_member" : hubProfile ? "hub_user_no_active_membership" : "existing_constituent_no_membership",
        hubUserLinked: Boolean(hubProfile),
        requiresManualReview: false
      };
    }

    const hubAccess = await existingHubAccess(email, neonAccountId);
    return {
      matched: true,
      isActiveMember: true,
      neonAccountId,
      membershipStatus: summary.membershipStatus || "Active",
      membershipLevel: summary.membershipLevel,
      hubAccess: hubAccess ? "allowed" : "invite_required",
      outcome: hubAccess ? "active_member_existing_hub_user" : "active_member_needs_hub_invite",
      publicState: hubAccess ? "hub_user_active_member" : "neon_member_needs_hub_activation",
      hubUserLinked: Boolean(hubAccess || hubProfile),
      requiresManualReview: false
    };
  } catch (error) {
    console.error("neon-membership-resolver", safeError(error));
    return {
      matched: false,
      isActiveMember: false,
      neonAccountId: null,
      membershipStatus: null,
      membershipLevel: null,
      hubAccess: "unknown",
      outcome: "lookup_failed",
      publicState: "lookup_unavailable",
      hubUserLinked: false,
      requiresManualReview: false,
      reason: "Membership lookup failed."
    };
  }
}
