import {
  type Json,
  normalizeEmail,
  resolveMembership,
  safeError,
  sanitizeText,
  supabaseFetch,
} from "../_shared/neon-membership.ts";
import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { recordPointEventForLeadAction } from "../_shared/form-submission.ts";

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
const HUB_URL = "https://members.girlplusenvironment.org/";
const MEMBERSHIP_URL = "https://www.girlplusenvironment.org/become-a-member";

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

function hubInviteUrl() {
  const configured = Deno.env.get("GPE_HUB_INVITE_URL") || Deno.env.get("GPE_HUB_LOGIN_URL");
  if (configured) return configured.replace(/\/login\/?$/, "/accept-invite");
  return "https://members.girlplusenvironment.org/accept-invite";
}

function hubResetUrl() {
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

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: anonKey(),
      authorization,
    },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null) as Json | null;
  const id = typeof user?.id === "string" ? user.id : "";
  if (!id) return null;
  return {
    id,
    email: typeof user?.email === "string" ? user.email : null,
  };
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
    if (!res.ok) throw new Error(`auth_admin_users_list failed with HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = await res.json().catch(() => ({})) as Json;
    const users = Array.isArray(body.users) ? body.users as AuthUser[] : [];
    matches.push(...users.filter((user) => normalizeEmail(user.email) === email));
    if (users.length < 1000) break;
  }
  return matches;
}

async function pendingInvitation(email: string) {
  const res = await supabaseFetch([
    "hub_invitations?select=id,status,sent_at,created_at,source,source_id",
    `normalized_email=eq.${encodeURIComponent(email)}`,
    "status=in.(pending,sent)",
    "order=created_at.desc",
    "limit=1",
  ].join("&"));
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []) as Json[];
  return rows[0] || null;
}

async function recentInvitationCount(filters: string[]) {
  const res = await supabaseFetch([
    "hub_invitations?select=id",
    ...filters,
  ].join("&"));
  if (!res.ok) return 0;
  const rows = await res.json().catch(() => []) as Json[];
  return rows.length;
}

async function assertInvitationRateLimit(args: { email: string; requesterId: string }) {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const requesterRecent = await recentInvitationCount([
    `source_id=eq.${encodeURIComponent(args.requesterId)}`,
    `created_at=gte.${encodeURIComponent(oneHourAgo)}`,
    "limit=21",
  ]);
  if (requesterRecent >= 20) {
    return "Too many invitations have been sent from this account recently. Try again later.";
  }
  const recipientRecent = await recentInvitationCount([
    `normalized_email=eq.${encodeURIComponent(args.email)}`,
    `created_at=gte.${encodeURIComponent(oneDayAgo)}`,
    "limit=4",
  ]);
  if (recipientRecent >= 3) {
    return "This email has reached the invitation limit for today.";
  }
  return "";
}

async function sendAuthInvite(args: {
  email: string;
  firstName: string;
  lastName: string;
  personalMessage: string;
  neonAccountId: string | null;
  memberStatus: "active" | "membership_pending";
  membershipLevel?: string | null;
  invitedBy: string;
}) {
  const res = await fetch(`${supabaseUrl()}/auth/v1/invite?redirect_to=${encodeURIComponent(hubInviteUrl())}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey(),
      authorization: `Bearer ${serviceRoleKey()}`,
    },
    body: JSON.stringify({
      email: args.email,
      data: {
        first_name: args.firstName || undefined,
        last_name: args.lastName || undefined,
        personal_message: args.personalMessage || undefined,
        neon_account_id: args.neonAccountId || undefined,
        member_status: args.memberStatus,
        membership_access_state: args.memberStatus === "active" ? "active" : "membership_pending",
        membership_level: args.membershipLevel || undefined,
        invited_by: args.invitedBy,
        invitation_source: "hub_invite_page",
      },
    }),
  });
  if (!res.ok) throw new Error(`auth_invite failed with HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return await res.json().catch(() => ({})) as Json;
}

async function recordInvitation(args: {
  existingInvitationId?: string | null;
  email: string;
  neonAccountId: string | null;
  invitedBy: string;
  status: "pending" | "sent";
}) {
  const payload = {
    source: "hub_invite_page",
    source_id: args.invitedBy,
    normalized_email: args.email,
    neon_account_id: args.neonAccountId,
    status: args.status,
    sent_at: args.status === "sent" ? new Date().toISOString() : null,
  };
  if (args.existingInvitationId) {
    await supabaseFetch(`hub_invitations?id=eq.${encodeURIComponent(args.existingInvitationId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return args.existingInvitationId;
  }
  const res = await supabaseFetch("hub_invitations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`hub_invitation_insert failed with HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const rows = await res.json().catch(() => []) as Json[];
  return typeof rows[0]?.id === "string" ? rows[0].id : null;
}

async function recordInvitePoints(args: {
  invitationId: string | null;
  requester: { id: string; email?: string | null };
  inviteeEmail: string;
  activeMember: boolean;
}) {
  if (!args.invitationId || !args.requester.email) return null;
  try {
    return await recordPointEventForLeadAction({
      eventType: "MEMBER_INVITED",
      email: args.requester.email,
      leadAction: { user_id: args.requester.id },
      source: "hub_invitation",
      sourceId: args.invitationId,
      metadata: {
        invitationId: args.invitationId,
        inviteeEmail: args.inviteeEmail,
        invitedMemberStatus: args.activeMember ? "active" : "membership_pending",
      },
    }) as Json;
  } catch (error) {
    console.error("hub-invitation-request point_event", safeError(error));
    return { status: "failed", message: safeError(error) };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  assertAllowedOrigin(origin);
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

  try {
    const requester = await authenticatedUser(req);
    if (!requester?.id) return jsonResponse({ message: "Sign in before sending Hub invitations." }, 401, origin);

    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const firstName = sanitizeText(body.firstName, 120);
    const lastName = sanitizeText(body.lastName, 120);
    const personalMessage = sanitizeText(body.personalMessage, 1_000);
    const resend = body.action === "resend";
    const sendAnyway = body.sendAnyway === true;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return jsonResponse({ status: "invalid_email", message: "Enter a valid email address." }, 400, origin);
    }
    const rateLimitMessage = await assertInvitationRateLimit({ email, requesterId: requester.id });
    if (rateLimitMessage) {
      return jsonResponse({ status: "rate_limited", message: rateLimitMessage, recipientEmail: email }, 429, origin);
    }

    const users = await authUsersByEmail(email);
    const confirmedUser = users.find((user) => Boolean(user.email_confirmed_at || user.confirmed_at));
    if (confirmedUser) {
      return jsonResponse({
        status: "existing_account",
        message: "This email already has a Hub account.",
        recipientEmail: email,
        hubUrl: HUB_URL,
        resetPasswordUrl: hubResetUrl(),
      }, 200, origin);
    }

    const pending = await pendingInvitation(email);
    const hasPendingAuthUser = users.some((user) => !user.email_confirmed_at && !user.confirmed_at);
    if ((pending || hasPendingAuthUser) && !resend) {
      return jsonResponse({
        status: "pending_invitation",
        message: "An invitation has already been sent to this email.",
        recipientEmail: email,
        invitationStatus: String(pending?.status || "pending"),
        sentAt: pending?.sent_at || pending?.created_at || null,
      }, 200, origin);
    }

    const membership = await resolveMembership({ email, firstName, lastName });
    const activeMember =
      membership.outcome === "active_member_existing_hub_user" ||
      membership.outcome === "active_member_needs_hub_invite" ||
      membership.isActiveMember === true;
    if (!activeMember && !sendAnyway) {
      return jsonResponse({
        status: "membership_required",
        message: "This email isn’t currently associated with a GPE membership.",
        recipientEmail: email,
        membershipUrl: MEMBERSHIP_URL,
        canSendAnyway: true,
        membershipOutcome: membership.outcome,
      }, 200, origin);
    }

    await sendAuthInvite({
      email,
      firstName,
      lastName,
      personalMessage,
      neonAccountId: membership.neonAccountId || null,
      memberStatus: activeMember ? "active" : "membership_pending",
      membershipLevel: membership.membershipLevel,
      invitedBy: requester.id,
    });
    const invitationId = await recordInvitation({
      existingInvitationId: typeof pending?.id === "string" ? pending.id : null,
      email,
      neonAccountId: membership.neonAccountId || null,
      invitedBy: requester.id,
      status: "sent",
    });
    const pointResult = await recordInvitePoints({ invitationId, requester, inviteeEmail: email, activeMember });

    return jsonResponse({
      status: "sent",
      message: "Invitation sent successfully ✨",
      recipientEmail: email,
      sentAt: new Date().toISOString(),
      invitationStatus: "sent",
      invitationLink: null,
      invitationId,
      pointEventStatus: pointResult?.status || "not_attempted",
      pointsAwarded: Number(pointResult?.awardedPoints || 0),
      membershipOutcome: activeMember ? "active_member_needs_hub_invite" : "membership_pending",
    }, 200, origin);
  } catch (error) {
    console.error("hub-invitation-request", safeError(error));
    return jsonResponse({ status: "failed", message: "Invitation could not be sent right now." }, 502, origin);
  }
});
