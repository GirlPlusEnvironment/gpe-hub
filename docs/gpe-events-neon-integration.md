# GPE Events + Neon CRM Integration

## Public Page

- Canonical page: `https://www.girlplusenvironment.org/events`
- Source file: `gpe/gpe-mirror/events.html`
- Legacy reference kept: `gpe/gpe-mirror/old-events.html`

The new page preserves the supplied scrapbook/brutalist event design and replaces Wix Events runtime behavior with custom JavaScript that calls Supabase Edge Functions.

## Data Ownership

Neon CRM remains authoritative for:

- event records
- ticket options
- capacity
- registration status
- attendee records
- payment and transaction history
- member pricing or discounts

Supabase stores:

- public event display cache
- event registration intents
- Hub user and Neon account linkage
- registration reconciliation state
- participation claims for Impact Points
- safe sync logs
- notification outbox events

## Edge Functions

### `neon-events-public`

Frontend endpoint for event display.

Flow:

1. Receives `POST` only.
2. Enforces CORS via `ALLOWED_FORM_ORIGINS`.
3. Attempts to load legacy event data from Neon API v2 using `NEON_EVENTS_LIST_PATH` or `/events`.
4. Upserts public display fields into `gpe_event_cache`.
5. Returns only safe public event fields from `gpe_public_events`.
6. If Neon is unavailable, returns cached events with `syncStatus = cache_fallback`.

### `neon-event-register`

Frontend endpoint for starting registration.

Flow:

1. Receives `POST` only.
2. Enforces CORS and JSON content type.
3. Rejects payment-card-looking payloads.
4. Validates first name, last name, email, consent, and safe optional fields.
5. Performs shared membership lookup via `resolveMembership`.
6. Saves an idempotent `gpe_event_registration_intents` record first.
7. Checks `/events/{id}/eventRegistrations` for an existing Neon registration when a Neon account is matched.
8. If already registered, creates a participation claim.
9. Otherwise returns the configured Neon registration URL for the visitor to complete registration in Neon.

This function does not collect payment details and does not claim the event registration is complete unless Neon already has a matching registration.

## Neon API Endpoints Used

Current Neon API v2 docs list legacy event support only. Relevant endpoints:

- `GET /events`
- `POST /events/search`
- `GET /events/{id}`
- `GET /events/{id}/eventRegistrations`
- `GET /events/{id}/tickets`
- `POST /eventRegistrations`
- `POST /eventRegistrations/{registrationId}/payments`

The current implementation uses:

- `GET /events` by default, configurable with `NEON_EVENTS_LIST_PATH`
- `GET /events/{id}/eventRegistrations` for duplicate/linked-registration checks

It intentionally does not call event registration payment endpoints from the public page.

## Required Secrets / Environment Variables

- `NEON_API_KEY`: required by server-side Neon calls.
- `NEON_ORG_ID`: required by server-side Neon calls.
- `NEON_API_VERSION`: optional, defaults to `2.11`.
- `NEON_BASE_URL`: optional, defaults to `https://api.neoncrm.com/v2`.
- `NEON_EVENTS_LIST_PATH`: optional, defaults to `/events`.
- `NEON_EVENT_REGISTRATION_URL_TEMPLATE`: required before public event registration can open. Supports `{eventId}` and `{slug}`.
- `NEON_EVENT_CALENDAR_URL`: optional fallback calendar link.
- `NEON_EVENT_CALENDAR_URL_TEMPLATE`: optional event-specific calendar link. Supports `{eventId}` and `{slug}`.
- `NEON_CONSTITUENT_PORTAL_URL`: optional portal link shown on detail views.
- `GPE_EVENT_PAGE_URL_TEMPLATE`: optional public event detail URL template.
- `DEFAULT_EVENT_IMPACT_POINTS`: optional display/claim value.
- `EVENT_POINTS_REQUIRE_ATTENDANCE`: optional, defaults to `true`.
- `EVENT_POINTS_AUTO_AWARD`: optional, defaults to `false`.
- `ALLOWED_FORM_ORIGINS`: required CORS allowlist.
- `SUPABASE_URL`: required.
- `SUPABASE_SERVICE_ROLE_KEY`: required by Edge Functions only.

Do not place Neon or Supabase service-role secrets in public HTML, Wix embeds, or Vite public variables.

## Frontend Configuration

`events.html` expects the existing public config shape:

```html
<script>
window.GPE_FORM_CONFIG = {
  functionBaseUrl: "https://PROJECT.functions.supabase.co",
  functions: {
    "neon-events-public": "https://PROJECT.functions.supabase.co/neon-events-public",
    "neon-event-register": "https://PROJECT.functions.supabase.co/neon-event-register",
    "neon-membership-check": "https://PROJECT.functions.supabase.co/neon-membership-check"
  }
};
</script>
```

If the config is missing, the page shows an accessible error and does not leave fake RSVP behavior active.

## Impact Points Boundary

Registration intent is not attendance. Impact Points should be awarded only after:

- Neon registration is confirmed, and
- attendance/participation is confirmed, or
- Team GPE manually approves the claim.

The migration creates `gpe_event_participation_claims` as the reconciliation layer. Future admin UI can approve claims into `point_transactions` or a future ledger-backed Impact Points model.

## Deployment Order

Do not deploy during development review. When ready:

1. Apply existing form/Camp migrations in timestamp order.
2. Apply `20260720_gpe_events_neon_sync.sql`.
3. Set required secrets.
4. Deploy `neon-membership-check` if not already deployed.
5. Deploy `neon-events-public`.
6. Deploy `neon-event-register`.
7. Configure `window.GPE_FORM_CONFIG` for the Wix embed.
8. Smoke test event loading, registration intent save, Neon handoff, cache fallback, and duplicate registration matching.
