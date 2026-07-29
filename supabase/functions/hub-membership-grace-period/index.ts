import { jsonResponse } from "../_shared/cors.ts";
import { sendLifecycleEmail } from "../_shared/lifecycle-email.ts";
import { resolveMembership, safeError, supabaseFetch } from "../_shared/neon-membership.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type PendingProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  neon_account_id: string | null;
  membership_access_state: string | null;
  membership_grace_expires_at: string | null;
  membership_reminder_sent_at: string | null;
  account_status: string | null;
};

function requireInternalAuth(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const emailSecret = Deno.env.get("GPE_EMAIL_SERVICE_SECRET") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!token || (token !== emailSecret && token !== serviceRoleKey)) {
    throw new Response(JSON.stringify({ message: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function supabaseJson<T>(path: string, init: RequestInit = {}) {
  const res = await supabaseFetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Supabase request failed (${res.status}): ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body as T;
}

async function patchProfile(id: string, body: Record<string, unknown>) {
  const res = await supabaseFetch(`profiles?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Profile update failed (${res.status}): ${text.slice(0, 500)}`);
  }
}

async function claimPendingAwards(profileId: string) {
  await supabaseJson("rpc/service_claim_pending_point_awards_for_profile", {
    method: "POST",
    body: JSON.stringify({ p_profile_id: profileId }),
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405);
    requireInternalAuth(req);

    const now = new Date();
    const rows = await supabaseJson<PendingProfile[]>(
      "profiles?select=id,email,first_name,last_name,neon_account_id,membership_access_state,membership_grace_expires_at,membership_reminder_sent_at,account_status&membership_access_state=eq.membership_pending&account_status=eq.active&email=not.is.null&limit=500&order=membership_grace_expires_at.asc",
    );

    const stats = {
      checked: 0,
      activated: 0,
      remindersSent: 0,
      deactivated: 0,
      skipped: 0,
      failed: 0,
    };
    const failures: Array<{ profileId: string; error: string }> = [];

    for (const profile of rows) {
      stats.checked += 1;
      try {
        const email = profile.email?.trim().toLowerCase();
        if (!email) {
          stats.skipped += 1;
          continue;
        }

        const membership = await resolveMembership({
          email,
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          authenticatedUserId: profile.id,
          suppressTrace: true,
        });

        if (membership.isActiveMember) {
          await patchProfile(profile.id, {
            account_status: "active",
            membership_access_state: "active",
            member_status: "active",
            neon_account_id: membership.neonAccountId || profile.neon_account_id,
            membership_level: membership.membershipLevel,
            membership_start_date: membership.membershipStartAt,
            membership_end_date: membership.membershipEndAt,
            membership_pending_started_at: null,
            membership_grace_expires_at: null,
            membership_reminder_sent_at: null,
            membership_deactivated_at: null,
            membership_deactivation_reason: null,
            membership_last_synced_at: now.toISOString(),
            updated_at: now.toISOString(),
          });
          await claimPendingAwards(profile.id).catch(() => undefined);
          stats.activated += 1;
          continue;
        }

        const expiresAt = profile.membership_grace_expires_at
          ? new Date(profile.membership_grace_expires_at)
          : new Date(now.getTime() - 1);
        const msRemaining = expiresAt.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

        if (msRemaining <= 0) {
          await patchProfile(profile.id, {
            account_status: "deactivated",
            membership_access_state: "membership_grace_expired",
            member_status: "inactive",
            membership_deactivated_at: now.toISOString(),
            membership_deactivation_reason: "membership_grace_expired",
            membership_last_synced_at: now.toISOString(),
            updated_at: now.toISOString(),
          });
          await sendLifecycleEmail({
            templateKey: "win-back",
            recipientEmail: email,
            recipientUserId: profile.id,
            neonAccountId: profile.neon_account_id,
            eventType: "membership_grace_expired",
            sourceType: "profile",
            sourceId: profile.id,
            idempotencyKey: `membership-grace-expired:${profile.id}`,
            category: "membership_lifecycle",
            variables: {
              firstName: profile.first_name || "there",
              membershipUrl: "https://www.girlplusenvironment.org/become-a-member",
              membershipHelpUrl: "https://members.girlplusenvironment.org/membership-help",
            },
          });
          stats.deactivated += 1;
          continue;
        }

        if (daysRemaining <= 1 && !profile.membership_reminder_sent_at) {
          await sendLifecycleEmail({
            templateKey: "hub-user-nonmember",
            recipientEmail: email,
            recipientUserId: profile.id,
            neonAccountId: profile.neon_account_id,
            eventType: "membership_grace_reminder",
            sourceType: "profile",
            sourceId: profile.id,
            idempotencyKey: `membership-grace-reminder:${profile.id}`,
            category: "membership_lifecycle",
            variables: {
              firstName: profile.first_name || "there",
              daysRemaining,
              membershipUrl: "https://www.girlplusenvironment.org/become-a-member",
              membershipHelpUrl: "https://members.girlplusenvironment.org/membership-help",
            },
          });
          await patchProfile(profile.id, {
            membership_reminder_sent_at: now.toISOString(),
            membership_last_synced_at: now.toISOString(),
            updated_at: now.toISOString(),
          });
          stats.remindersSent += 1;
          continue;
        }

        stats.skipped += 1;
      } catch (error) {
        stats.failed += 1;
        failures.push({ profileId: profile.id, error: safeError(error) });
      }
    }

    return jsonResponse({ success: true, ...stats, failures });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("hub-membership-grace-period", safeError(error));
    return jsonResponse({ success: false, message: safeError(error) || "Grace-period automation failed." }, 500);
  }
});
