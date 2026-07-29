# Resend Implementation Plan

Last audited: 2026-07-29

This plan should not be executed until the audit documents are reviewed.

## Current Foundation

Already present:

- `emails/resend/*.html`
- `emails/plain-text/*.txt`
- `emails/shared/resend-templates.mjs`
- `emails/shared/email-layout.mjs`
- `emails/shared/email-tokens.mjs`
- `supabase/functions/_shared/email.ts`
- `supabase/functions/gpe-lifecycle-email-send/index.ts`
- `gpe_email_deliveries`
- `gpe_email_preferences`
- `gpe_email_suppressions`

## Configuration Before Activation

Add or verify deployed Supabase secrets:

| Secret | Status from audit | Required action |
| --- | --- | --- |
| `RESEND_API_KEY` | Present | Keep. |
| `GPE_EMAIL_PROVIDER` | Present | Confirm value is `resend`. |
| `GPE_EMAIL_FROM` | Present | Keep `Girl Plus Environment Community Hub <support@gpecommunityhub.org>`. |
| `GPE_EMAIL_REPLY_TO` | Present | Keep `support@gpecommunityhub.org`. |
| `GPE_EMAIL_SERVICE_SECRET` | Present | Generated and set on 2026-07-29. Do not print or document the value. |

## Implementation Phases

### Phase 1: Central Render Service

Create a server-only render layer that:

- selects a known template key
- validates required variables
- escapes user-provided text
- renders HTML and plain text
- applies centralized URLs
- passes `templateVersion`, `category`, `sourceType`, `sourceId`, and `idempotencyKey`
- calls `gpe-lifecycle-email-send`

Recommended location:

- `supabase/functions/_shared/lifecycle-email.ts`
- or `lib/email/send.ts` if the app uses a server runtime later

Do not call Resend from browser code.

Partially complete: `gpe-lifecycle-email-send` is the centralized delivery boundary, and `emails/shared/resend-template-types.ts` now documents typed template payloads for callers. A source-event render/call helper is still needed before broad trigger activation.

### Phase 2: Outbox Worker

Decide whether lifecycle email sends are immediate function calls or outbox-driven.

Preferred pattern:

1. Source function writes a normalized lifecycle event or notification row.
2. A server-only worker renders and sends through `gpe-lifecycle-email-send`.
3. Delivery state is recorded in `gpe_email_deliveries`.

Current gap: `gpe_notification_outbox` is written by event registration, but no draining worker was found.

### Phase 3: Wire High-Value Triggers

Wire in this order:

1. `pending-points` after a pending award is created.
2. `points-earned` after a significant point event is claimed or awarded.
3. `challenge-completed` after deterministic or approved challenge completion.
4. `member-welcome` after a Neon membership is confirmed.
5. `hub-activated` after first Hub login or profile activation.
6. `public-action-follow-up` after verified nonmember public action.
7. `post-event-follow-up` after Neon attendance sync.

### Phase 4: Preferences And Suppression

Every caller should pass a category:

| Email | Suggested category |
| --- | --- |
| Public action follow-up | `advocacy_followup` |
| Member welcome | `membership_lifecycle` |
| Hub user nonmember | `membership_lifecycle` |
| Pending points | `points` |
| Points earned | `points` |
| Challenge completed | `camp` |
| Friend invitation | `referral` |
| Friend joined | `referral` |
| Post-event follow-up | `event_followup` |

Security emails remain Supabase Auth-owned and should not use unsubscribe links.

### Phase 5: Testing

Add tests for:

- unknown template rejection
- missing variable rejection in the render layer
- HTML escaping of user fields
- plain-text output
- preference opt-out
- suppression
- idempotency replay
- Resend 429 retry-pending behavior
- Resend 4xx failed behavior
- no browser access to `RESEND_API_KEY`

## Activation Guardrails

- Do not activate every lifecycle automation at once.
- Add one trigger at a time.
- Use test recipients first.
- Confirm a `gpe_email_deliveries` row for each send.
- Confirm provider message ID on success.
- Confirm no duplicate delivery on repeated source events.
- Confirm preference/suppression rules before sending nonessential lifecycle email.
