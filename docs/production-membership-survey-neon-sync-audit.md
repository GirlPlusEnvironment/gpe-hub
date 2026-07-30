# Production Membership + Survey + Neon Synchronization Audit

Date: 2026-07-30

## Summary

Production testing showed the mobile Climate Action Survey was reporting frontend success while the backend source of truth did not show a Neon survey activity or Neon membership.

Concrete causes and launch blockers found:

- The production website copy at `../girlplusenvironment.org/mobile-climate-adaptation-survey.html` was not sending `membershipRequest` in the survey payload, so `neon-climate-survey` treated inline membership as not requested.
- `neon-climate-survey` used a local Neon activity payload that did not match the shared working Neon activity helper.
- The Climate Action Survey integration writes a Neon Activity record, not a native hosted Neon Survey Response. Staff should verify the controlled test under the constituent Activity timeline unless/until a supported native survey response write endpoint is confirmed.
- Neon custom demographic field IDs/options remain unconfirmed, so structured demographic mapping is currently preserved through Membership profile/fallback Activities instead of direct custom-field writes.

## Code Changes

### Static Survey Frontend

Updated:

- `../girlplusenvironment.org/mobile-climate-adaptation-survey.html`

Changes:

- Loads the newer membership helper bundle: `gpe-form-membership.js?v=20260729a`.
- Initializes the membership helper in `inlineMembership` mode.
- Adds `membershipRequest` to the survey POST body.
- Backfills membership name, email, phone, city, state, and zip from survey answers.
- Branches the success view from backend-confirmed fields:
  - `membershipCreationStatus`
  - `neonMembershipId`
  - `membershipEmailQueued`
  - `hubInviteQueued`
  - `membershipOutcome`

### Survey Edge Function

Updated:

- `supabase/functions/neon-climate-survey/index.ts`

Changes:

- Reuses `createAndFinalizeMembership` for inline survey membership creation.
- Normalizes the inline membership request through the shared membership schema.
- Returns explicit membership lifecycle statuses instead of a generic success state.
- Stores membership status fields on `neon_climate_survey_submissions`.
- Sends the survey confirmation through the updated Resend lifecycle renderer.
- Uses the shared `createActivity` helper for the Neon survey activity record.
- Adds a pre-membership fallback Activity for inline membership data so demographics and survey-context membership data are attached to the constituent even if membership creation or custom-field mapping fails later.
- Returns and stores `neonWriteTarget: activity_fallback_not_native_survey_response` so frontend/admin verification does not confuse this with native Neon hosted survey insertion.

### Shared Neon API Diagnostics

Updated:

- `supabase/functions/_shared/neon-membership.ts`

Changes:

- Every Neon API call through `neonFetch` now logs `neon-api-write`.
- Each diagnostic includes:
  - operation
  - endpoint
  - HTTP method
  - duration
  - HTTP status
  - success/failure flag
  - redacted request body
  - redacted response body
  - created IDs when present
- Diagnostics safely handle non-JSON Neon responses.
- Logs redact contact fields, names, addresses, ZIP/postal values, locations, demographic fields, survey answers, membership profile payloads, and Activity note bodies.

### Resend Lifecycle Copy

Updated:

- `supabase/functions/_shared/lifecycle-email.ts`
- `emails/shared/resend-templates.mjs`
- Generated `emails/resend`, `emails/plain-text`, and `emails/previews` artifacts

Changes:

- Survey confirmation copy now uses a direct thank-you structure.
- Survey email includes the intended continue-your-impact CTA set in the runtime renderer.
- Member welcome copy now clearly says membership is confirmed and links to the Hub.

## Production Deployment

Applied production schema:

- `20260729201000_neon_climate_survey_membership_status`

Deployed Edge Functions:

| Function | Version | SHA |
| --- | ---: | --- |
| `neon-climate-survey` | 45 | `26221dbe0df1591c426ab9756d1f7a0e64b04ea8d16d529590ad270a80ebf3de` |
| `gpe-membership-enroll` | 29 | `82917658a8449cc15b518a443a9bee99c550c1b802c54292af394e9129d1d9d6da` |
| `action-network-completion-bridge` | 11 | `27d2a4f373064a9a033a055a4145b249abe3c57099d797bbf4d1055141144a92` |

Deployment blocked by Supabase API `409 deployment already exists`:

| Function | Repository Status | Production Status |
| --- | --- | --- |
| `gpe-grad-highlight-submit` | Updated to track independent `formSubmissionStatus`, `formRecordId`, and failed Activity writes | Still active as version 28 / SHA `0977fcb5d281d63828377f20aedff2194d981eccf536876083243381dc68c300` |
| `camp-gpe-submit` | Updated to restore partial-failure behavior when the Camp Activity write fails | Still active as version 32 / SHA `7be2c373f5be1a98001bc19a861c91b8c97745db9af8beb01c8edead4061fd61` |
| `camp-gpe-action-network-ingest` | Updated to log webhook stages and stop treating constituent lookup as petition Activity success | Still active as version 28 / SHA `df6065f612ca54a3a47fb29c3ea0d7ee71e57c769f8befa010993a74aebd485c` |

These were retried with normal deploy and/or `--use-api`; Supabase either returned `unexpected deploy status 409: {"message":"deployment already exists"}` or reported success without advancing the active version. They remain launch blockers until Supabase accepts a new deployment or the stale deployment conflict is cleared.

Verified still active:

- `gpe-lifecycle-email-send` version 11
- `hub-account-activation` version 13

Note: `member-welcome` is a lifecycle template key, not a standalone Supabase function.

## Neon Survey Record Status

The current implementation does not create a native Neon hosted survey response object. It records survey answers in Supabase and creates a Neon activity titled `Mobile Climate Adaptation Plan Survey Response` attached to the constituent.

Local documentation already noted that no supported Neon API endpoint for hosted survey-response insertion had been confirmed. Neon API v2 documentation should be manually confirmed before promising native hosted survey visibility.

Launch verification rule: every submitted survey answer must exist either in the Supabase survey row and the Neon Activity note, or in a confirmed native Neon survey response after that endpoint is implemented. A submission where the frontend accepts answers but no Neon Activity or native survey response exists remains a launch blocker.

## Membership Field Mapping

Collected membership fields flow through the shared canonical membership request:

| Frontend Field | Current Neon Destination | Status |
| --- | --- | --- |
| First Name | Individual primary contact first name | Working |
| Last Name | Individual primary contact last name | Working |
| Email | Individual primary contact email | Working |
| Phone | Individual primary contact phone | Working |
| City | Individual primary contact city | Working |
| State | Individual primary contact state | Working |
| ZIP Code | Individual primary contact ZIP | Working |
| Age Range | Membership profile activity / configured custom field env | Needs Neon custom field confirmation |
| Race/Ethnicity | Membership profile activity / configured custom field env | Needs Neon custom field confirmation |
| Gender Identity | Membership profile activity / configured custom field env | Needs Neon custom field confirmation |
| Climate Interests | Membership profile activity / configured custom field env | Needs Neon custom field confirmation |
| Communication Preferences | Membership profile activity / configured custom field env | Needs Neon custom field confirmation |
| Email/SMS Consent | Membership profile activity / configured custom field env | Needs Neon custom field confirmation |
| Terms/Eligibility | Internal audit only | Intentionally not mapped |

The mapper currently records demographic data and a mapping report as a Neon activity. It does not yet patch Neon account custom fields directly.

For inline survey membership requests, `neon-climate-survey` now writes an additional `GPE Membership Data Fallback` Activity before attempting membership creation. This is intentional temporary data-loss protection: if membership creation, Hub finalization, or future custom-field mapping exits early, the constituent still has the collected membership profile payload attached in Neon.

## Remaining Production Gap

The backend fix is deployed, but the live Wix page at:

- `https://www.girlplusenvironment.org/mobile-climate-adaptation-survey`

does not expose the fixed static survey script in the fetched HTML. Repository copies contain the fixed script, but Wix is serving the page through its serialized page model/embedded content.

The updated static survey embed must still be published in Wix or whatever pipeline owns that page before users will send `membershipRequest` from production.

## Verification Performed

- `npm run typecheck`: passed
- `npm run lint`: passed with three existing Camp hook dependency warnings
- `npm run emails:generate`: passed
- Production migration applied and repaired in migration history
- `neon-climate-survey` deployed and verified active as version 45
- `gpe-membership-enroll` deployed and verified active as version 29
- `action-network-completion-bridge` deployed and verified active as version 11
- `gpe-grad-highlight-submit`, `camp-gpe-submit`, and `camp-gpe-action-network-ingest` are fixed in the repository but not deployed because Supabase returned persistent 409 conflicts or reported success without advancing the active version.
- Public survey URL returns `HTTP 200`

The Supabase CLI available in this environment does not expose `supabase functions logs`; use the Supabase dashboard log explorer to inspect the new `neon-api-write` entries during the next controlled production test.

## Not Completed

No controlled live form submission was run in this pass. Required final verification still needs a fresh test email after the Wix/static survey embed is published:

- Supabase survey row
- Neon constituent
- Neon survey activity
- Neon membership
- Resend survey confirmation delivery
- Resend member welcome delivery
- Hub invitation or activation result
- Confirmation page branch
