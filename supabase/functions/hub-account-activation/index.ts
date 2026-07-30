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
  supabaseFetch,
} from "../_shared/neon-membership.ts";
import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendLifecycleEmail } from "../_shared/lifecycle-email.ts";

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

type HubActivationAction = "invite" | "recover";

const MAX_BODY_BYTES = 20_000;
const PUBLIC_MESSAGE =
  "If that email belongs to an active GPE member, we’ll send secure Hub access instructions.";

function supabaseUrl() {
  const url = (Deno.env.get("GPE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))?.replace(/\/$/, "");
  if (!url) throw new Error("Missing SUPABASE_URL.");
  return url;
}

function serviceRoleKey() {
  const key = Deno.env.get("GPE_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return key;
}

function anonKey() {
  const key = Deno.env.get("GPE_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (!key) throw new Error("Missing SUPABASE_ANON_KEY.");
  return key;
}

function hubResetUrl() {
  const configured = Deno.env.get("GPE_HUB_RESET_URL") || Deno.env.get("GPE_HUB_LOGIN_URL");
  if (configured) return configured.replace(/\/login\/?$/, "/reset-password");
  return "https://members.girlplusenvironment.org/reset-password";
}

function hubInviteUrl() {
  const configured = Deno.env.get("GPE_HUB_INVITE_URL") || Deno.env.get("GPE_HUB_LOGIN_URL");
  if (configured) return configured.replace(/\/login\/?$/, "/accept-invite");
  return "https://members.girlplusenvironment.org/accept-invite";
}

function safeRedirectLog(url: string) {
  try {
    const parsed = new URL(url);
    return { host: parsed.host, pathname: parsed.pathname };
  } catch {
    return { host: "invalid", pathname: "" };
  }
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
  const redirectUrl = hubResetUrl();
  const res = await fetch(`${supabaseUrl()}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectUrl)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey(),
      authorization: `Bearer ${anonKey()}`,
    },
    body: JSON.stringify({
      email,
    }),
  });
  if (!res.ok) throw new Error(`auth_recover failed with HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function sendInvite(email: string, membership: ReturnType<typeof pickMembershipSummary>, neonAccountId: string) {
  const res = await fetch(`${supabaseUrl()}/auth/v1/invite?redirect_to=${encodeURIComponent(hubInviteUrl())}`, {
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
  const body = await res.json().catch(() => ({})) as Json;
  if (!res.ok) throw new Error(`auth_invite failed with HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function upsertProvisionedHubProfile(args: {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  neonAccountId: string;
  membership: ReturnType<typeof pickMembershipSummary>;
}) {
  const now = new Date().toISOString();
  const fullName = [args.firstName, args.lastName].filter(Boolean).join(" ");
  const profilePayload: Json = {
    id: args.userId,
    email: args.email,
    neon_account_id: args.neonAccountId,
    member_status: "active",
    membership_status: "active",
    membership_level: args.membership.membershipLevel || null,
    membership_start_date: args.membership.membershipStartAt || null,
    membership_end_date: args.membership.membershipEndAt || null,
    membership_access_state: "active",
    account_status: "active",
    membership_last_synced_at: now,
    membership_pending_started_at: null,
    membership_grace_expires_at: null,
    membership_reminder_sent_at: null,
    membership_deactivated_at: null,
    membership_deactivation_reason: null,
    membership_grace_started_at: null,
    membership_deadline_at: null,
    deletion_scheduled_at: null,
    deleted_at: null,
    updated_at: now,
  };
  if (args.firstName) profilePayload.first_name = args.firstName;
  if (args.lastName) profilePayload.last_name = args.lastName;
  if (fullName) profilePayload.full_name = fullName;
  const res = await supabaseFetch("profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(profilePayload),
  });
  if (!res.ok) throw new Error(`hub_profile_upsert failed with HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const rows = await res.json().catch(() => []) as Json[];
  return rows[0] as Json | undefined;
}

function authUserFromInviteResponse(body: Json): AuthUser | null {
  const direct = body as AuthUser;
  if (direct?.id) return direct;
  const nestedUser = body.user as AuthUser | undefined;
  if (nestedUser?.id) return nestedUser;
  return null;
}

async function sendHubReadyEmail(args: {
  email: string;
  firstName?: string;
  neonAccountId: string;
  userId: string;
  action: HubActivationAction;
}) {
  const hubAccessInstructions = args.action === "recover"
    ? "We also sent password reset instructions in case you need a fresh sign-in link."
    : "We also sent a secure account setup email. Use that link first if you have not created your Hub password yet.";
  const result = await sendLifecycleEmail({
    templateKey: "hub-welcome",
    recipientEmail: args.email,
    recipientUserId: args.userId,
    neonAccountId: args.neonAccountId,
    eventType: "hub_profile_provisioned",
    sourceType: "hub_account_activation",
    sourceId: args.userId,
    idempotencyKey: `hub-ready:${args.userId}`,
    category: "hub_lifecycle",
    variables: {
      firstName: args.firstName || "there",
      hubUrl: "https://members.girlplusenvironment.org",
      profileUrl: "https://members.girlplusenvironment.org/profile",
      campUrl: "https://members.girlplusenvironment.org/camp-gpe",
      resourcesUrl: "https://members.girlplusenvironment.org/resources",
      hubAccessInstructions,
    },
  });
  return Boolean(result?.ok && ["sent", "already_sent"].includes(String(result.status)));
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

    const membership = pickMembershipSummary(memberships);
    const users = await authUsersByEmail(email);
    const confirmedUser = users.find((user) => Boolean(user.email_confirmed_at || user.confirmed_at));
    let provisionedUser: AuthUser | null = null;
    let action: HubActivationAction;
    if (confirmedUser) {
      await sendPasswordRecovery(email);
      provisionedUser = confirmedUser;
      action = "recover";
      console.info("hub activation sent password recovery", {
        action: "recover",
        redirect: safeRedirectLog(hubResetUrl()),
      });
    } else {
      const inviteBody = await sendInvite(email, membership, match.neonAccountId);
      provisionedUser = authUserFromInviteResponse(inviteBody);
      if (!provisionedUser?.id) {
        const refreshedUsers = await authUsersByEmail(email);
        provisionedUser = refreshedUsers[0] || null;
      }
      action = "invite";
      console.info("hub activation sent invite", {
        action: "invite",
        redirect: safeRedirectLog(hubInviteUrl()),
      });
    }

    if (provisionedUser?.id) {
      await upsertProvisionedHubProfile({
        userId: provisionedUser.id,
        email,
        firstName,
        lastName,
        neonAccountId: match.neonAccountId,
        membership,
      });
      const hubReadyQueued = await sendHubReadyEmail({
        email,
        firstName,
        neonAccountId: match.neonAccountId,
        userId: provisionedUser.id,
        action,
      });
      console.info("hub activation provisioned profile", {
        hubProfileLinked: true,
        hubReadyQueued,
        action,
      });
    } else {
      console.warn("hub activation could not confirm auth user after successful auth handoff", {
        hubProfileLinked: false,
        action,
      });
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
