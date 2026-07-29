import { jsonResponse } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { safeError, supabaseFetch } from "../_shared/neon-membership.ts";
import { normalizeEmail, readJson, sanitizeText, ValidationError } from "../_shared/validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type Json = Record<string, unknown>;

const ALLOWED_TEMPLATES = new Set([
  "public-action-follow-up",
  "petition-thank-you",
  "action-network-petition-thank-you",
  "event-follow-up",
  "survey-thank-you",
  "volunteer-interest",
  "camp-gpe-submission",
  "graduate-highlight-submission",
  "hub-welcome",
  "complete-your-profile",
  "first-badge",
  "member-welcome",
  "existing-member-hub-invite",
  "hub-user-nonmember",
  "membership-required",
  "hub-activated",
  "pending-points",
  "points-earned",
  "badge-unlocked",
  "challenge-completed",
  "weekly-progress",
  "monthly-digest",
  "leaderboard-update",
  "camp-reminder",
  "become-a-member",
  "member-anniversary",
  "renewal-reminder",
  "win-back",
  "invite-friend",
  "invited-friend-joined",
  "post-event-follow-up",
  "resource-released",
  "jobs-digest",
  "newsletter"
]);

function internalSecretFailure(req: Request): Response | null {
  const expected = Deno.env.get("GPE_EMAIL_SERVICE_SECRET");
  if (!expected) {
    return jsonResponse({ message: "Lifecycle email sender is not configured." }, 503, null);
  }
  const auth = req.headers.get("authorization") || "";
  const explicit = req.headers.get("x-gpe-lifecycle-email-secret") || "";
  if (auth !== `Bearer ${expected}` && explicit !== expected) {
    return jsonResponse({ message: "Unauthorized." }, 401, null);
  }
  return null;
}

async function hasSuppression(email: string) {
  const res = await supabaseFetch(`gpe_email_suppressions?select=id&recipient_email=eq.${encodeURIComponent(email)}&limit=1`);
  if (!res.ok) return false;
  const rows = await res.json();
  return Boolean(rows[0]);
}

async function hasOptedOut(email: string, category: string) {
  const res = await supabaseFetch([
    "gpe_email_preferences?select=opted_in",
    `recipient_email=eq.${encodeURIComponent(email)}`,
    `category=eq.${encodeURIComponent(category)}`,
    "limit=1"
  ].join("&"));
  if (!res.ok) return false;
  const rows = await res.json();
  return rows[0]?.opted_in === false;
}

async function upsertDelivery(input: Json) {
  const res = await supabaseFetch("gpe_email_deliveries?on_conflict=idempotency_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error(`Could not record lifecycle email delivery: ${(await res.text()).slice(0, 300)}`);
  const rows = await res.json();
  return rows[0] as Json;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, null);
    const secretFailure = internalSecretFailure(req);
    if (secretFailure) return secretFailure;

    const body = await readJson(req, 120_000) as Json;
    const templateKey = sanitizeText(body.templateKey, 120);
    const recipientEmail = normalizeEmail(body.recipientEmail);
    const subject = sanitizeText(body.subject, 240);
    const html = String(body.html || "");
    const text = String(body.text || "");
    const idempotencyKey = sanitizeText(body.idempotencyKey, 300);
    const category = sanitizeText(body.category || "hub_lifecycle", 80);
    const sourceType = sanitizeText(body.sourceType, 120) || null;
    const rawSourceId = sanitizeText(body.sourceId, 80);
    const sourceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawSourceId)
      ? rawSourceId
      : null;

    if (!ALLOWED_TEMPLATES.has(templateKey)) throw new ValidationError("Unknown lifecycle email template.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) throw new ValidationError("Recipient email is required.");
    if (!subject) throw new ValidationError("Subject is required.");
    if (!html || !text) throw new ValidationError("HTML and plain text are required.");
    if (!idempotencyKey) throw new ValidationError("Idempotency key is required.");

    const delivery = await upsertDelivery({
      template_key: templateKey,
      template_version: Number(body.templateVersion || 1),
      recipient_email: recipientEmail,
      recipient_user_id: body.recipientUserId || null,
      neon_account_id: sanitizeText(body.neonAccountId, 120) || null,
      event_type: sanitizeText(body.eventType, 120) || templateKey,
      source_type: sourceType,
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      subject,
      variables: body.variables && typeof body.variables === "object" && !Array.isArray(body.variables) ? body.variables : {},
      provider: "resend",
      queued_at: new Date().toISOString()
    });

    if (delivery.sent_at) {
      return jsonResponse({ ok: true, status: "already_sent", deliveryId: delivery.id }, 200, null);
    }

    if (await hasSuppression(recipientEmail)) {
      await supabaseFetch(`gpe_email_deliveries?id=eq.${encodeURIComponent(String(delivery.id))}`, {
        method: "PATCH",
        body: JSON.stringify({ failed_at: new Date().toISOString(), error_message: "Recipient is suppressed." })
      });
      return jsonResponse({ ok: true, status: "suppressed", deliveryId: delivery.id }, 200, null);
    }

    if (category !== "security" && await hasOptedOut(recipientEmail, category)) {
      await supabaseFetch(`gpe_email_deliveries?id=eq.${encodeURIComponent(String(delivery.id))}`, {
        method: "PATCH",
        body: JSON.stringify({ failed_at: new Date().toISOString(), error_message: "Recipient opted out." })
      });
      return jsonResponse({ ok: true, status: "opted_out", deliveryId: delivery.id }, 200, null);
    }

    const from = Deno.env.get("GPE_EMAIL_FROM");
    const replyTo = Deno.env.get("GPE_EMAIL_REPLY_TO");
    if (!from || !replyTo) {
      await supabaseFetch(`gpe_email_deliveries?id=eq.${encodeURIComponent(String(delivery.id))}`, {
        method: "PATCH",
        body: JSON.stringify({ failed_at: new Date().toISOString(), error_message: "Lifecycle email sender identity is not configured." })
      });
      return jsonResponse({ ok: false, status: "configuration_error", deliveryId: delivery.id }, 503, null);
    }

    const result = await sendTransactionalEmail({
      to: recipientEmail,
      from,
      replyTo,
      subject,
      html,
      text,
      idempotencyKey
    });

    await supabaseFetch(`gpe_email_deliveries?id=eq.${encodeURIComponent(String(delivery.id))}`, {
      method: "PATCH",
      body: JSON.stringify({
        provider: result.provider,
        provider_message_id: result.providerMessageId || null,
        sent_at: result.status === "sent" ? new Date().toISOString() : null,
        failed_at: result.status === "failed" ? new Date().toISOString() : null,
        error_message: result.errorSummary || null,
        retry_count: result.status === "sent" ? Number(delivery.retry_count || 0) : Number(delivery.retry_count || 0) + 1
      })
    });

    return jsonResponse({ ok: true, status: result.status, deliveryId: delivery.id, providerMessageId: result.providerMessageId || null }, 200, null);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("gpe-lifecycle-email-send", safeError(error));
    return jsonResponse({
      message: error instanceof ValidationError ? error.message : "Lifecycle email could not be sent."
    }, error instanceof ValidationError ? 400 : 500, null);
  }
});
