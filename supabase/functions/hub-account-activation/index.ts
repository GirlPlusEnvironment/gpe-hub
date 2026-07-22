import {
  type Json,
  extractAccountId,
  findNeonAccountsByEmail,
  getMemberships,
  hasEligibleMembership,
  normalizeEmail,
  pickMembershipSummary,
  resolveAccountMatch,
  safeError,
  sanitizeText,
} from "../_shared/neon-membership.ts";
import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type AuthUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

const MAX_BODY_BYTES = 20_000;
const PUBLIC_MESSAGE =
  "If that email belongs to an active GPE member, we’ll send secure Hub access instructions.";

function supabaseUrl() {
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!url) throw new Error("Missing SUPABASE_URL.");
  return url;
}

function serviceRoleKey() {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return key;
}

function anonKey() {
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!key) throw new Error("Missing SUPABASE_ANON_KEY.");
  return key;
}

function hubRedirectUrl() {
  const configured = Deno.env.get("GPE_HUB_RESET_URL") || Deno.env.get("GPE_HUB_LOGIN_URL");
  if (configured) return configured.replace(/\/login\/?$/, "/reset-password");
  return "https://members.girlplusenvironment.org/reset-password";
}

async function readBody(req: Request): Promise<Json> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) throw new Error("Content-Type must be application/json.");
  const body = await req.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  return JSON.parse(body);
}

async function authUsersByEmail(email: string): Promise<AuthUser[]> {
  const matches: AuthUser[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await fetch(`${supabaseUrl()}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: {
        apikey: serviceRoleKey(),
        authorization: `Bearer ${serviceRoleKey()}`,
      },
    });
    if (!res.ok) {
      throw new Error(`auth_admin_users_list failed with HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const body = await res.json().catch(() => ({})) as Json;
    const users = Array.isArray(body.users) ? body.users as AuthUser[] : [];
    matches.push(...users.filter((user) => normalizeEmail(user.email) === email));
    if (users.length < 1000) break;
  }
  return matches;
}

async function sendPasswordRecovery(email: string) {
  const res = await fetch(`${supabaseUrl()}/auth/v1/recover`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey(),
      authorization: `Bearer ${anonKey()}`,
    },
    body: JSON.stringify({
      email,
      redirect_to: hubRedirectUrl(),
    }),
  });
  if (!res.ok) throw new Error(`auth_recover failed with HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function sendInvite(email: string, membership: ReturnType<typeof pickMembershipSummary>, neonAccountId: string) {
  const res = await fetch(`${supabaseUrl()}/auth/v1/invite?redirect_to=${encodeURIComponent(hubRedirectUrl())}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey(),
      authorization: `Bearer ${serviceRoleKey()}`,
    },
    body: JSON.stringify({
      email,
      data: {
        neon_account_id: neonAccountId,
        member_status: "active",
        membership_level: membership.membershipLevel || undefined,
      },
    }),
  });
  if (!res.ok) throw new Error(`auth_invite failed with HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  assertAllowedOrigin(origin);
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

  try {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const firstName = sanitizeText(body.firstName, 120);
    const lastName = sanitizeText(body.lastName, 120);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return jsonResponse({ message: PUBLIC_MESSAGE, requestAccepted: true }, 200, origin);
    }

    const accounts = await findNeonAccountsByEmail(email);
    const match = resolveAccountMatch(accounts, firstName, lastName);
    if (match.status !== "matched" || !match.neonAccountId) {
      console.info("hub activation requested without active Neon match", {
        accountMatchStatus: match.status,
        accountMatchCount: accounts.length,
      });
      return jsonResponse({ message: PUBLIC_MESSAGE, requestAccepted: true }, 200, origin);
    }

    const memberships = await getMemberships(match.neonAccountId);
    if (!hasEligibleMembership(memberships)) {
      console.info("hub activation requested without eligible Neon membership", {
        neonAccountLinked: Boolean(extractAccountId({ accountId: match.neonAccountId })),
        membershipCount: memberships.length,
      });
      return jsonResponse({ message: PUBLIC_MESSAGE, requestAccepted: true }, 200, origin);
    }

    const users = await authUsersByEmail(email);
    const confirmedUser = users.find((user) => Boolean(user.email_confirmed_at || user.confirmed_at));
    if (confirmedUser) {
      await sendPasswordRecovery(email);
    } else {
      await sendInvite(email, pickMembershipSummary(memberships), match.neonAccountId);
    }

    return jsonResponse({ message: PUBLIC_MESSAGE, requestAccepted: true }, 200, origin);
  } catch (error) {
    console.error("hub-account-activation", safeError(error));
    return jsonResponse({
      message: "We could not process Hub access right now. Please try again shortly.",
      requestAccepted: false,
    }, 502, origin);
  }
});
