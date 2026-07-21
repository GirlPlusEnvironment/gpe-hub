# GPE Custom Form Architecture

Status: implementation prepared only. Do not deploy functions, apply migrations, publish Wix pages, or push until reviewed.

## Purpose

GPE forms should be custom-branded pages hosted at `girlplusenvironment.org`, with Neon CRM and Hub work handled server-side through Supabase Edge Functions.

Shared order of operations:

1. Public form validates browser fields and runs membership preflight after a valid email is entered.
2. Mutation Edge Function writes the original submission to `gpe_form_submissions`.
3. Function attempts Neon account matching or creation when safe.
4. Function writes the safest supported Neon representation, usually an activity.
5. Optional membership request, Camp registration, or Hub invitation work happens after the submission is preserved.
6. Integration results are logged in `gpe_form_sync_logs` without secrets or raw payload dumps.

## Shared Frontend Pieces

- React helper: `src/lib/gpe-form-membership.ts`
- Standalone HTML helper: `gpe-mirror/gpe-form-membership.js`

Visible preflight messages intentionally avoid exposing internal IDs or raw Neon match counts. `lookup_failed` never blocks the underlying form.

## Shared Backend Pieces

- `_shared/neon-membership.ts`: shared Neon membership resolver used by Hub login and forms.
- `_shared/form-submission.ts`: Supabase-first persistence and sync logging.
- `_shared/membership-request.ts`: membership request, optional membership creation, Hub invitation queue/invoke.
- `_shared/neon-account.ts`: safe account match/create wrapper.
- `_shared/neon-activity.ts`: Neon activity sync wrapper.
- `_shared/cors.ts`: explicit origin allowlist.
- `_shared/validation.ts`: JSON, idempotency, email, and field validation helpers.

## Form Functions

- `camp-gpe-submit`: Camp GPE registration and duplicate registration check.
- `camp-gpe-challenge-submit`: Camp challenge proof submission.
- `gpe-membership-enroll`: primary custom membership enrollment.
- `gpe-grad-highlight-submit`: graduate highlight submission.
- `gpe-donation-intake`: safe donation intent/contact intake only.
- `neon-climate-survey`: Mobile Climate Adaptation Plan Survey.
- `neon-membership-check`: shared membership preflight and Hub-login service.

## Persistence

Migration:

- `supabase/migrations/20260717_gpe_custom_forms.sql`

Tables:

- `gpe_form_submissions`
- `gpe_form_sync_logs`
- `gpe_form_registrations`

Every submission uses `idempotency_key`. Camp registration also has uniqueness protection on `(form_key, email_normalized)`.

## Membership

Account existence is not membership. The shared resolver:

1. Uses stored Neon account ID if supplied.
2. Searches normalized email.
3. Uses email plus first and last name only to resolve same-email ambiguity.

It never matches by name alone. Ambiguous matches block account creation and mark the submission for review.

Eligible levels and statuses are environment-configured:

- `ELIGIBLE_MEMBERSHIP_LEVELS`
- `ELIGIBLE_MEMBERSHIP_STATUSES`
- `DEFAULT_MEMBERSHIP_LEVEL_ID`
- `DEFAULT_MEMBERSHIP_TERM_ID`

The exported membership form shows `GPE Member`, term ID `1`, cost `0`, lifetime/one-time. Production IDs still need Neon dashboard confirmation before function deployment.

## Camp GPE Registration

Camp GPE enrollment is stored separately from general GPE membership:

- Local duplicate source: `gpe_form_registrations` with `form_key = camp_gpe`.
- Neon sync representation: `Camp GPE Registration` activity on the matched/created account.
- User-facing duplicate state: `already_registered`.

Membership can help with Hub access, but it is not proof of Camp enrollment.

## Donation Boundary

`gpe-donation-intake` does not collect, store, or forward raw card data. It records safe donation intent fields and returns the configured Neon CRM hosted donation/payment URL.

The intended website payment path is:

1. GPE custom donation page CTA.
2. `gpe-donation-intake` saves safe donation intent idempotently.
3. Visitor redirects to the configured Neon CRM hosted donation/payment form.
4. Neon handles constituent matching, payment, donation record creation, recurring support when configured, and receipt/acknowledgement.
5. Visitor returns to the approved GPE thank-you or next-step page when Neon return URLs are configured.

No separate website payment stack should be added for this flow. Donation completion must be based on Neon hosted-form/payment confirmation, not the intake submission.

## Future Action Network Adapter

Future webhooks can reuse this architecture:

1. Receive Action Network submission server-side.
2. Normalize email.
3. Save to `gpe_form_submissions` with an Action Network form key.
4. Invoke `resolveMembership`.
5. Queue Hub invitation or membership follow-up when appropriate.

Do not place Neon credentials in Action Network custom scripts.

## Required Secrets

- `NEON_API_KEY`
- `NEON_ORG_ID`
- `NEON_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_FORM_ORIGINS`
- `GPE_MEMBERSHIP_URL`
- `GPE_HUB_LOGIN_URL`
- `HUB_INVITATION_SECRET`
- `HUB_INVITATION_FUNCTION_URL`
- `DEFAULT_MEMBERSHIP_LEVEL_ID`
- `DEFAULT_MEMBERSHIP_TERM_ID`
- `ELIGIBLE_MEMBERSHIP_LEVELS`
- `ELIGIBLE_MEMBERSHIP_STATUSES`
- `GPE_DONATION_PAYMENT_URL` (configured Neon CRM hosted donation/payment URL)
- optional form-specific Neon activity/campaign identifiers

## Deployment Work Still Required

- Apply migrations in Supabase after review.
- Deploy new Edge Functions.
- Set Supabase secrets.
- Replace placeholder public function URLs in standalone HTML.
- Confirm Neon API permissions and membership IDs.
- Publish updated Wix HTML embeds/pages.
