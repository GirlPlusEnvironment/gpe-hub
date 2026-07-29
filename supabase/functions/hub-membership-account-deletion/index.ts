import { jsonResponse } from "../_shared/cors.ts";
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
  membership_deadline_at: string | null;
  membership_grace_expires_at: string | null;
  account_status: string | null;
  created_at: string | null;
};

type ReminderAttempt = {
  id: string;
  reminder_number: number;
  sent_at: string | null;
  delivery_status: string | null;
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
    throw new Error(`Profile update failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
}

async function audit(input: {
  profileId: string;
  email: string;
  action: string;
  result: string;
  details?: Record<string, unknown>;
}) {
  await supabaseFetch("hub_membership_deletion_audit", {
    method: "POST",
    body: JSON.stringify({
      hub_profile_id: input.profileId,
      auth_user_id: input.profileId,
      normalized_email: input.email,
      action: input.action,
      result: input.result,
      details: input.details || {},
    }),
  }).catch(() => undefined);
}

async function claimPendingAwards(profileId: string) {
  await supabaseJson("rpc/service_claim_pending_point_awards_for_profile", {
    method: "POST",
    body: JSON.stringify({ p_profile_id: profileId }),
  });
}

async function deleteLookupCache(email: string) {
  await supabaseFetch(`membership_lookup_cache?normalized_email=eq.${encodeURIComponent(email)}`, {
    method: "DELETE",
  }).catch(() => undefined);
}

async function activateProfile(profile: PendingProfile, email: string, membership: Awaited<ReturnType<typeof resolveMembership>>) {
  const now = new Date().toISOString();
  await patchProfile(profile.id, {
    account_status: "active",
    membership_access_state: "active",
    member_status: "active",
    membership_status: "active",
    neon_account_id: membership.neonAccountId || profile.neon_account_id,
    membership_level: membership.membershipLevel,
    membership_start_date: membership.membershipStartAt,
    membership_end_date: membership.membershipEndAt,
    membership_pending_started_at: null,
    membership_grace_expires_at: null,
    membership_grace_started_at: null,
    membership_deadline_at: null,
    deletion_scheduled_at: null,
    deleted_at: null,
    membership_last_synced_at: now,
    updated_at: now,
  });
  await deleteLookupCache(email);
  await claimPendingAwards(profile.id).catch(() => undefined);
  await audit({ profileId: profile.id, email, action: "membership_grace_final_check", result: "activated" });
}

function deadline(profile: PendingProfile) {
  const fallback = new Date(profile.created_at || Date.now()).getTime() + 35 * 24 * 60 * 60 * 1000;
  return new Date(profile.membership_deadline_at || profile.membership_grace_expires_at || fallback);
}

async function finalReminderWasSent(profileId: string) {
  const rows = await supabaseJson<ReminderAttempt[]>(
    `hub_membership_reminder_attempts?select=id,reminder_number,sent_at,delivery_status&hub_profile_id=eq.${encodeURIComponent(profileId)}&reminder_number=eq.5&limit=1`,
  );
  const row = rows[0];
  return Boolean(row && (row.sent_at || row.delivery_status === "sent" || row.delivery_status === "already_sent"));
}

async function deleteAuthUser(userId: string) {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase Auth admin credentials are not configured.");
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
  });
  if (res.status === 404) return { alreadyDeleted: true };
  if (!res.ok) {
    throw new Error(`Supabase Auth deletion failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
  return { alreadyDeleted: false };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405);
    requireInternalAuth(req);

    const now = new Date();
    const rows = await supabaseJson<PendingProfile[]>(
      "profiles?select=id,email,first_name,last_name,neon_account_id,membership_access_state,membership_deadline_at,membership_grace_expires_at,account_status,created_at&membership_access_state=eq.membership_pending&account_status=in.(active,deletion_scheduled,deletion_failed)&email=not.is.null&limit=200&order=membership_deadline_at.asc",
    );

    const stats = {
      checked: 0,
      activated: 0,
      scheduled: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
    };
    const failures: Array<{ profileId: string; error: string }> = [];

    for (const profile of rows) {
      stats.checked += 1;
      const email = profile.email?.trim().toLowerCase();
      try {
        if (!email) {
          stats.skipped += 1;
          continue;
        }

        if (deadline(profile).getTime() > now.getTime()) {
          stats.skipped += 1;
          continue;
        }

        if (!(await finalReminderWasSent(profile.id))) {
          stats.skipped += 1;
          await audit({ profileId: profile.id, email, action: "membership_deletion_skipped", result: "final_notice_missing" });
          continue;
        }

        const membership = await resolveMembership({
          email,
          neonAccountId: profile.neon_account_id || undefined,
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          authenticatedUserId: profile.id,
          bypassCache: true,
          suppressTrace: true,
        });

        if (membership.isActiveMember) {
          await activateProfile(profile, email, membership);
          stats.activated += 1;
          continue;
        }

        if (profile.account_status !== "deletion_scheduled") {
          await patchProfile(profile.id, {
            account_status: "deletion_scheduled",
            membership_access_state: "deletion_scheduled",
            member_status: "inactive",
            membership_status: "deletion_scheduled",
            deletion_scheduled_at: now.toISOString(),
            membership_last_synced_at: now.toISOString(),
            updated_at: now.toISOString(),
          });
          await audit({ profileId: profile.id, email, action: "membership_deletion_scheduled", result: "scheduled" });
          stats.scheduled += 1;
        }

        try {
          const result = await deleteAuthUser(profile.id);
          await audit({
            profileId: profile.id,
            email,
            action: "membership_auth_account_delete",
            result: result.alreadyDeleted ? "already_deleted" : "deleted",
          });
          stats.deleted += 1;
        } catch (error) {
          await patchProfile(profile.id, {
            account_status: "deletion_failed",
            membership_access_state: "membership_pending",
            membership_status: "deletion_failed",
            membership_deactivation_reason: safeError(error),
            updated_at: now.toISOString(),
          }).catch(() => undefined);
          await audit({
            profileId: profile.id,
            email,
            action: "membership_auth_account_delete",
            result: "failed",
            details: { error: safeError(error) },
          });
          throw error;
        }
      } catch (error) {
        stats.failed += 1;
        failures.push({ profileId: profile.id, error: safeError(error) });
      }
    }

    return jsonResponse({ success: true, ...stats, failures });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("hub-membership-account-deletion", safeError(error));
    return jsonResponse({ success: false, message: safeError(error) || "Membership account deletion automation failed." }, 500);
  }
});
