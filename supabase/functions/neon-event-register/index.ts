import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createMembershipServerSide, queueHubInvitation } from "../_shared/membership-request.ts";
import { logEventSync } from "../_shared/neon-events.ts";
import { resolveOrCreateAccount } from "../_shared/neon-account.ts";
import { extractRows, neonFetch, resolveMembership, safeError, supabaseFetch } from "../_shared/neon-membership.ts";
import { readJson, sanitizeText, validateFields, validateIdempotencyKey, ValidationError } from "../_shared/validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true, type: "email" as const },
  { key: "phone", label: "Phone Number", type: "tel" as const },
  { key: "accessNeeds", label: "Accessibility or participation notes", type: "textarea" as const },
  { key: "consent", label: "Event registration consent", required: true, allowed: ["yes"] }
];

function configuredUrl(templateName: string, event: Record<string, unknown>) {
  const template = Deno.env.get(templateName);
  if (!template) return "";
  return template
    .replaceAll("{eventId}", encodeURIComponent(String(event.neon_event_id || "")))
    .replaceAll("{slug}", encodeURIComponent(String(event.slug || "")));
}

async function existingIntent(idempotencyKey: string) {
  const res = await supabaseFetch(`gpe_event_registration_intents?select=*&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`);
  if (!res.ok) throw new Error("Could not check existing event registration.");
  const rows = await res.json();
  return rows[0] || null;
}

async function loadEvent(body: Record<string, unknown>) {
  const eventId = sanitizeText(body.eventId, 80);
  const neonEventId = sanitizeText(body.neonEventId, 80);
  const slug = sanitizeText(body.eventSlug, 120);
  const filters = eventId && /^[0-9a-f-]{36}$/i.test(eventId)
    ? `id=eq.${encodeURIComponent(eventId)}`
    : neonEventId
      ? `neon_event_id=eq.${encodeURIComponent(neonEventId)}`
      : `slug=eq.${encodeURIComponent(slug)}`;
  const res = await supabaseFetch(`gpe_public_events?select=*&${filters}&limit=1`);
  if (!res.ok) throw new Error("Could not load event.");
  const rows = await res.json();
  if (!rows[0]) throw new ValidationError("This event is not available for registration.");
  return rows[0] as Record<string, unknown>;
}

async function profileByEmail(email: string) {
  const res = await supabaseFetch(`profiles?select=id,email&email=eq.${encodeURIComponent(email)}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.id || null;
}

async function matchingNeonRegistration(neonAccountId: string, neonEventId: string) {
  try {
    const result = await neonFetch(`/events/${encodeURIComponent(neonEventId)}/eventRegistrations`, { method: "GET" });
    const registrations = extractRows(result);
    return registrations.find((registration) => {
      const account = (registration.account || registration.registrantAccount || {}) as Record<string, unknown>;
      return String(registration.accountId || registration.registrantAccountId || account.id || account.accountId || "") === neonAccountId;
    }) || null;
  } catch (error) {
    console.error("event-registration-lookup", safeError(error));
    return null;
  }
}

async function createIntent(args: {
  idempotencyKey: string;
  event: Record<string, unknown>;
  fields: Record<string, unknown>;
  email: string;
  membershipOutcome: string;
  neonAccountId: string | null;
  hubUserId: string | null;
  registrationStatus: string;
  registrationUrl: string;
  membershipRequest?: Record<string, unknown> | null;
  neonRegistrationId?: string | null;
}) {
  const res = await supabaseFetch("gpe_event_registration_intents", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      idempotency_key: args.idempotencyKey,
      event_id: args.event.id,
      neon_event_id: args.event.neon_event_id,
      email_normalized: args.email,
      first_name: args.fields.firstName,
      last_name: args.fields.lastName,
      phone: args.fields.phone || null,
      neon_account_id: args.neonAccountId,
      hub_user_id: args.hubUserId,
      membership_outcome: args.membershipOutcome,
      registration_status: args.registrationStatus,
      neon_registration_id: args.neonRegistrationId || null,
      registration_url: args.registrationUrl,
      submission_payload: {
        fields: args.fields,
        membershipRequest: args.membershipRequest || null,
        paymentBoundary: "Payment, tickets, capacity, and final registration status remain in Neon CRM."
      }
    })
  });
  if (!res.ok) throw new Error("Could not save event registration intent.");
  const rows = await res.json();
  return rows[0] as Record<string, unknown>;
}

async function createParticipationClaim(intent: Record<string, unknown>, event: Record<string, unknown>, email: string, neonAccountId: string | null, hubUserId: string | null) {
  const res = await supabaseFetch("gpe_event_participation_claims", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      event_id: event.id,
      registration_intent_id: intent.id,
      neon_event_id: event.neon_event_id,
      neon_registration_id: intent.neon_registration_id || null,
      email_normalized: email,
      neon_account_id: neonAccountId,
      hub_user_id: hubUserId,
      claim_status: "claimable",
      impact_points: event.impact_points || null,
      metadata: { source: "event_registration_intent" }
    })
  });
  if (!res.ok) await logEventSync({ registrationIntentId: String(intent.id), integration: "supabase", operation: "event_participation_claim", success: false, errorSummary: "Could not save participation claim." });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

    const body = await readJson(req);
    if (JSON.stringify(body).match(/card|cvv|cvc|payment\\.card/i)) throw new ValidationError("Payment card data must not be submitted to this endpoint.");
    const idempotencyKey = validateIdempotencyKey(req.headers.get("idempotency-key") || body.idempotencyKey);
    const duplicate = await existingIntent(idempotencyKey);
    if (duplicate) {
      return jsonResponse({ ok: true, duplicate: true, intentId: duplicate.id, registrationStatus: duplicate.registration_status, registrationUrl: duplicate.registration_url }, 200, origin);
    }

    const event = await loadEvent(body);
    const fields = validateFields((body.fields || {}) as Record<string, unknown>, FIELDS);
    const membershipRequest = (body.membershipRequest || null) as Record<string, unknown> | null;
    const email = String(fields.email).toLowerCase();
    let membership = await resolveMembership({ email, firstName: String(fields.firstName), lastName: String(fields.lastName) });
    const hubUserId = await profileByEmail(email);
    const registrationUrl = String(event.neon_registration_url || configuredUrl("NEON_EVENT_REGISTRATION_URL_TEMPLATE", event) || event.constituent_portal_url || "");
    if (!registrationUrl) throw new ValidationError("This event needs a configured Neon registration URL before public registration can open.");

    let status = "neon_handoff_required";
    let neonRegistrationId: string | null = null;
    if (membership.neonAccountId) {
      const existingRegistration = await matchingNeonRegistration(membership.neonAccountId, String(event.neon_event_id));
      if (existingRegistration) {
        status = "registered";
        neonRegistrationId = String((existingRegistration as Record<string, unknown>).id || (existingRegistration as Record<string, unknown>).registrationId || "");
      }
    }

    const intent = await createIntent({
      idempotencyKey,
      event,
      fields,
      email,
      membershipOutcome: membership.outcome,
      neonAccountId: membership.neonAccountId,
      hubUserId,
      registrationStatus: status,
      registrationUrl,
      membershipRequest,
      neonRegistrationId
    });

    let membershipPartialSuccess = false;
    if (
      membershipRequest?.requested === true &&
      membershipRequest?.consent === true &&
      membership.outcome !== "active_member_existing_hub_user" &&
      membership.outcome !== "active_member_needs_hub_invite"
    ) {
      try {
        const account = await resolveOrCreateAccount({
          email,
          firstName: String(fields.firstName),
          lastName: String(fields.lastName),
          phone: String(fields.phone || ""),
          allowCreate: true
        });
        if (account.status === "ambiguous" || !account.neonAccountId) {
          membershipPartialSuccess = true;
        } else {
          await createMembershipServerSide({ neonAccountId: account.neonAccountId, request: { membershipRequest, fields, source: "event_registration" } });
          await queueHubInvitation({ submissionId: String(intent.id), email, neonAccountId: account.neonAccountId }).catch(() => {
            membershipPartialSuccess = true;
            return undefined;
          });
          membership = { ...membership, outcome: "active_member_needs_hub_invite", neonAccountId: account.neonAccountId };
        }
      } catch (error) {
        membershipPartialSuccess = true;
        await logEventSync({ registrationIntentId: String(intent.id), integration: "neon", operation: "event_membership_request", success: false, errorSummary: safeError(error) });
      }
    }

    if (status === "registered") {
      await createParticipationClaim(intent, event, email, membership.neonAccountId, hubUserId);
    }
    await supabaseFetch("rpc/emit_gpe_event_notification", {
      method: "POST",
      body: JSON.stringify({
        p_event_type: status === "registered" ? "event_registration_matched" : "event_registration_intent_created",
        p_user_id: hubUserId,
        p_event_id: event.id,
        p_registration_intent_id: intent.id,
        p_payload: { neonEventId: event.neon_event_id, membershipOutcome: membership.outcome }
      })
    }).catch((error) => logEventSync({ registrationIntentId: String(intent.id), integration: "notification", operation: "event_registration_intent", success: false, errorSummary: safeError(error) }));

    return jsonResponse({
      ok: true,
      intentId: intent.id,
      registrationStatus: status,
      registrationUrl,
      membershipOutcome: membership.outcome,
      partialSuccess: membershipPartialSuccess,
      hubUserLinked: Boolean(hubUserId),
      neonAccountLinked: Boolean(membership.neonAccountId),
      message: status === "registered"
        ? "You are already registered for this Neon event. We linked it to your GPE record."
        : "Continue to Neon to complete registration. Your GPE event intent has been saved."
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("neon-event-register", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Event registration could not be started." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
