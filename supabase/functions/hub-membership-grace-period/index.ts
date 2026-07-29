import { jsonResponse } from "../_shared/cors.ts";
import { renderMembershipRequiredEmail } from "../_shared/membership-required-email.ts";
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
  member_status: string | null;
  membership_status: string | null;
  membership_pending_started_at: string | null;
  membership_grace_started_at: string | null;
  membership_grace_expires_at: string | null;
  membership_deadline_at: string | null;
  account_status: string | null;
  created_at: string | null;
};

type ReminderAttempt = {
  id: string;
  hub_profile_id: string | null;
  reminder_number: number;
  scheduled_for: string;
  sent_at: string | null;
  resend_message_id: string | null;
  delivery_status: string | null;
  error_message: string | null;
};

const REMINDER_DAYS = [7, 14, 21, 28, 35] as const;
const MEMBERSHIP_URL = "https://www.girlplusenvironment.org/become-a-member";
const HUB_URL = "https://members.girlplusenvironment.org";

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
    membership_reminder_sent_at: null,
    membership_deactivated_at: null,
    membership_deactivation_reason: null,
    membership_grace_started_at: null,
    membership_deadline_at: null,
    deletion_scheduled_at: null,
    deleted_at: null,
    membership_last_synced_at: now,
    updated_at: now,
  });
  await deleteLookupCache(email);
  await claimPendingAwards(profile.id).catch(() => undefined);
}

function profileStart(profile: PendingProfile) {
  return new Date(
    profile.membership_grace_started_at ||
    profile.membership_pending_started_at ||
    profile.created_at ||
    Date.now(),
  );
}

function dueReminderNumber(profile: PendingProfile, now: Date, sentNumbers: Set<number>) {
  const startedAt = profileStart(profile);
  for (let index = 0; index < REMINDER_DAYS.length; index += 1) {
    const reminderNumber = index + 1;
    if (sentNumbers.has(reminderNumber)) continue;
    const dueAt = new Date(startedAt.getTime() + REMINDER_DAYS[index] * 24 * 60 * 60 * 1000);
    if (now.getTime() >= dueAt.getTime()) {
      return { reminderNumber, dueAt, daysAfterStart: REMINDER_DAYS[index] };
    }
  }
  return null;
}

function deadline(profile: PendingProfile) {
  const startedAt = profileStart(profile);
  return new Date(profile.membership_deadline_at || profile.membership_grace_expires_at || startedAt.getTime() + 35 * 24 * 60 * 60 * 1000);
}

async function reminderAttempts(profileId: string) {
  return await supabaseJson<ReminderAttempt[]>(
    `hub_membership_reminder_attempts?select=*&hub_profile_id=eq.${encodeURIComponent(profileId)}&order=reminder_number.asc`,
  );
}

async function createQueuedAttempt(profileId: string, reminderNumber: number, scheduledFor: string) {
  const rows = await supabaseJson<ReminderAttempt[]>("hub_membership_reminder_attempts?on_conflict=hub_profile_id,reminder_number", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      hub_profile_id: profileId,
      reminder_number: reminderNumber,
      scheduled_for: scheduledFor,
      delivery_status: "queued",
      updated_at: new Date().toISOString(),
    }),
  });
  return rows[0];
}

async function patchAttempt(id: string, body: Record<string, unknown>) {
  const res = await supabaseFetch(`hub_membership_reminder_attempts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    throw new Error(`Reminder attempt update failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
}

async function sendMembershipReminder(args: {
  profile: PendingProfile;
  email: string;
  reminderNumber: number;
  dueAt: Date;
  deadlineAt: Date;
}) {
  const attempt = await createQueuedAttempt(args.profile.id, args.reminderNumber, args.dueAt.toISOString());
  if (attempt?.sent_at) return { status: "already_sent", providerMessageId: attempt.resend_message_id || null };

  const daysRemaining = Math.max(0, Math.ceil((args.deadlineAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  const rendered = renderMembershipRequiredEmail({
    firstName: args.profile.first_name || "there",
    recipientEmail: args.email,
    daysRemaining,
    deadlineLabel: args.deadlineAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" }),
    membershipUrl: MEMBERSHIP_URL,
    hubUrl: HUB_URL,
    finalNotice: args.reminderNumber === 5,
  });

  const supabaseUrl = (Deno.env.get("GPE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const secret = Deno.env.get("GPE_EMAIL_SERVICE_SECRET") || "";
  if (!supabaseUrl || !secret) throw new Error("Lifecycle email endpoint is not configured.");

  const res = await fetch(`${supabaseUrl}/functions/v1/gpe-lifecycle-email-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secret}`,
    },
    body: JSON.stringify({
      templateKey: "membership-required",
      templateVersion: 1,
      recipientEmail: args.email,
      recipientUserId: args.profile.id,
      neonAccountId: args.profile.neon_account_id,
      eventType: args.reminderNumber === 5 ? "membership_required_final_notice" : "membership_required_reminder",
      sourceType: "profile",
      sourceId: args.profile.id,
      idempotencyKey: `membership-required:${args.profile.id}:${args.reminderNumber}`,
      category: "membership_lifecycle",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      variables: {
        firstName: args.profile.first_name || "there",
        recipientEmail: args.email,
        daysRemaining,
        deadlineAt: args.deadlineAt.toISOString(),
        reminderNumber: args.reminderNumber,
        membershipUrl: MEMBERSHIP_URL,
        hubUrl: HUB_URL,
        templateSource: "emails/neon/membership/membership-required.html",
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  const status = String(body.status || res.status);
  const providerMessageId = body.providerMessageId ? String(body.providerMessageId) : null;
  await patchAttempt(attempt.id, {
    sent_at: res.ok && ["sent", "already_sent"].includes(status) ? new Date().toISOString() : null,
    resend_message_id: providerMessageId,
    delivery_status: status,
    error_message: res.ok ? null : JSON.stringify(body).slice(0, 500),
  });
  return { status, providerMessageId };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405);
    requireInternalAuth(req);

    const now = new Date();
    const rows = await supabaseJson<PendingProfile[]>(
      "profiles?select=id,email,first_name,last_name,neon_account_id,membership_access_state,member_status,membership_status,membership_pending_started_at,membership_grace_started_at,membership_grace_expires_at,membership_deadline_at,account_status,created_at&membership_access_state=eq.membership_pending&account_status=eq.active&email=not.is.null&limit=500&order=membership_deadline_at.asc",
    );

    const stats = {
      checked: 0,
      activated: 0,
      remindersSent: 0,
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
          neonAccountId: profile.neon_account_id || undefined,
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          authenticatedUserId: profile.id,
          suppressTrace: true,
        });

        if (membership.isActiveMember) {
          await activateProfile(profile, email, membership);
          stats.activated += 1;
          continue;
        }

        const attempts = await reminderAttempts(profile.id);
        const sentNumbers = new Set(
          attempts
            .filter((attempt) => attempt.sent_at || attempt.delivery_status === "sent" || attempt.delivery_status === "already_sent")
            .map((attempt) => Number(attempt.reminder_number)),
        );
        const due = dueReminderNumber(profile, now, sentNumbers);
        if (!due) {
          stats.skipped += 1;
          continue;
        }

        const result = await sendMembershipReminder({
          profile,
          email,
          reminderNumber: due.reminderNumber,
          dueAt: due.dueAt,
          deadlineAt: deadline(profile),
        });
        if (["sent", "already_sent"].includes(result.status)) {
          stats.remindersSent += 1;
        } else {
          stats.skipped += 1;
        }
      } catch (error) {
        stats.failed += 1;
        failures.push({ profileId: profile.id, error: safeError(error) });
      }
    }

    return jsonResponse({ success: true, ...stats, failures });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("hub-membership-grace-period", safeError(error));
    return jsonResponse({ success: false, message: safeError(error) || "Membership reminder automation failed." }, 500);
  }
});
