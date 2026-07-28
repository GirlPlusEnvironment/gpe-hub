# GPE Unified Action Flow Audit

Status: partial implementation pass completed on July 28, 2026. This document covers the two local folders:

- `/Users/Cassandre/gpe/gpe-hub`
- `/Users/Cassandre/gpe/gpe-mirror`

## Current Inventory

| Page or flow | Provider | Current fields | Neon submission | Hub identity | Action logging | Status |
|---|---|---|---|---|---|---|
| Become a Member | Neon/custom | Canonical membership questions added: eligibility, age range, race/ethnicity, gender identity, Office Hours, interests, communication, email/SMS/terms consent | `gpe-membership-enroll` | queues Hub invitation only after confirmed membership create | `constituent_leads` + `lead_actions` | Implemented, but real membership creation is blocked until Neon membership level/term secrets are configured |
| Camp GPE registration | Neon/custom | Camp fields plus canonical membership questions when membership checkbox is selected | `camp-gpe-submit` | queues Hub invitation only after confirmed membership create | `constituent_leads` + `lead_actions` | Implemented, but real membership creation is blocked until Neon membership level/term secrets are configured |
| Camp GPE challenge submission | Hub/custom | Challenge proof fields; member-only authenticated submit | `camp-gpe-challenge-submit` | requires Hub auth and active membership | existing challenge submission + reviewed point ledger | Existing protected flow |
| Mobile climate survey | Neon/custom survey | Survey already includes age, race/ethnicity, gender | `neon-climate-survey` writes survey audit and Neon activity | resolves membership and queues invitation where appropriate | `constituent_leads` + `lead_actions` | Backend implemented; production route returns `200` |
| GPE Grad Highlight | Neon/custom | Highlight fields plus shared inline canonical membership continuation for nonmembers | `gpe-grad-highlight-submit` | optional membership queues Hub invitation only after confirmed membership create | `constituent_leads` + `lead_actions` | Route now returns `200`; submission and lead are durable, but real membership creation is blocked until Neon membership level/term secrets are configured |
| Events | Neon/custom handoff | Event registration fields plus shared inline membership continuation where used | `neon-event-register` | optional membership queues Hub invitation only after confirmed membership create | `constituent_leads` + `lead_actions` | Backend implemented; optional membership failure now returns partial failure instead of a success-looking response; individual event config still needs route-level QA |
| Extreme Weather Action | Action Network | Action Network widget plus Camp completion claim | Action Network-owned; Camp completion endpoint exists | Hub challenge claim requires Hub auth | registry row seeded; full petition webhook/lead logging still pending | Partial |
| High Energy Bills Action | Action Network | Action Network widget | Action Network-owned | Not connected | Not yet connected to lead/action logging | Incomplete |
| Coal Slush Fund Action | Action Network | Action Network widget | Action Network-owned | Not connected | Not yet connected to lead/action logging | Incomplete |
| Donate | Neon/custom intake | Donation intent only; no membership prompt by design | `gpe-donation-intake` | no Hub identity mutation | form submission only | Existing payment-boundary flow |
| Contact | Neon/custom contact | Contact fields; membership lookup only for context | `gpe-contact-submit` | no member access mutation | form submission only | Existing communication flow |

## Implemented In This Pass

- Added `supabase/functions/_shared/membership-schema.ts` as the canonical membership schema.
- Added age range, race/ethnicity, gender identity, Office Hours interest, climate interests, communication preferences, eligibility affirmation, email consent, SMS consent, and terms/privacy consent to the main membership form.
- Added the same canonical questions to the shared inline membership helper used by membership-capable embedded flows.
- Added canonical membership questions to Camp GPE registration when the membership checkbox is selected.
- Server-side validation now rejects membership creation attempts that do not include the canonical required fields.
- Added `gpe_form_registry`, `constituent_leads`, and `lead_actions`.
- Added lead/action columns to `gpe_form_submissions`.
- Seeded registry rows for Mobile Climate Survey, Grad Highlight, Camp GPE registration, and Extreme Weather Action.
- Wired `gpe-membership-enroll`, `camp-gpe-submit`, `gpe-grad-highlight-submit`, `neon-event-register`, and `neon-climate-survey` into lead/action recording.
- Marked public form functions as `verify_jwt = false` in `supabase/config.toml` and redeployed the affected functions.
- Removed false membership success from the public submit paths. Membership-capable functions now require confirmed Neon membership creation before returning a membership success state.
- Added partial-failure responses for flows where the primary action is saved but Neon membership creation fails or is not configured.
- Updated Neon activity payloads to use the v2 API shape with `activityDates`, `clientAccount`, and `status` ID pairs instead of the older flat payload.
- Standardized legacy Take Action subpage back links in the source website repo to `https://www.girlplusenvironment.org/take-action` with `target="_top"`.
- Updated `neon-event-register` so optional membership creation failures return `502 partialSuccess` with `membership_outcome = membership_creation_failed` instead of a normal success-looking event response.
- Added an admin-only `admin-crm-configuration` Edge Function and Admin Diagnostics CRM configuration panel. It validates Neon API connectivity and reports missing CRM secrets without exposing secret values.
- Updated the shared website membership helper so lookup failures and ambiguous matches still show the full optional membership continuation, including age range, race/ethnicity, and Office Hours interest.
- Updated Grad Highlight submit handling so server `partialSuccess` responses show the server warning instead of generic submitted copy.

## Production Verification

- `gpe_form_registry`, `constituent_leads`, and `lead_actions` exist in production.
- Seeded registry rows exist for `camp-gpe`, `extreme-weather-action`, `gpe-grad-highlight`, and `mobile-climate-adaptation-survey`.
- `gpe_form_submissions` has `lead_id`, `action_slug`, `action_type`, `membership_choice`, and `points_status`.
- Public invalid POST to `gpe-membership-enroll` now reaches function validation and returns `400` with `Eligibility affirmation is required`, not `401`.
- Public invalid POST to `gpe-grad-highlight-submit` with an incomplete membership request returns `400` with `Eligibility affirmation is required`.
- Public invalid POST to `neon-event-register` reaches function validation/event lookup and returns `400`, not JWT failure.
- `neon-event-register` was redeployed after the partial-failure membership response fix.
- `admin-crm-configuration` is deployed with `verify_jwt = true`; unauthenticated requests return `401`.
- `https://www.girlplusenvironment.org/gpe-grad-highlight` returns `200`.
- `https://www.girlplusenvironment.org/mobile-climate-adaptation-survey` returns `200`.
- Controlled `gpe-membership-enroll` POST with a full canonical membership request saves `gpe_form_submissions` as `partial_failure` with `membership_outcome = membership_creation_failed` when `DEFAULT_MEMBERSHIP_LEVEL_ID` / `DEFAULT_MEMBERSHIP_TERM_ID` are missing. The response includes a submission ID and no longer reports success before Neon confirms membership creation.
- Controlled `gpe-grad-highlight-submit` POST with a full canonical membership continuation saves the highlight submission, creates a restricted lead, records a lead action, and returns `502 partialSuccess` when membership creation cannot be confirmed.
- Production row check for the Grad Highlight test email showed:
  - `gpe_form_submissions.submission_status = partial_failure`
  - `gpe_form_submissions.neon_sync_status = failed`
  - `gpe_form_submissions.membership_outcome = membership_creation_failed`
  - `constituent_leads.account_state = lead`
  - `constituent_leads.membership_state = pending`
  - `constituent_leads.hub_access = restricted`
  - `lead_actions.neon_sync_status = failed`

## Known Gaps

- The exact Neon custom field IDs and option values for Office Hours, race/ethnicity, age range, gender identity, interests, and communication preferences are not present in the local repository. The new canonical values are preserved in Supabase and Neon membership request/activity payloads, but exact Neon custom-field writes need dashboard/API confirmation before claiming automation parity.
- `DEFAULT_MEMBERSHIP_LEVEL_ID` and `DEFAULT_MEMBERSHIP_TERM_ID` are not configured in Supabase production secrets. Until those are set to the real Neon membership level and term IDs, no flow can create a confirmed Neon membership.
- Neon activity logging now uses the current v2 payload shape, but tenant-specific activity IDs are still missing. Configure `NEON_ACTIVITY_TIMEZONE_ID` and either `NEON_ACTIVITY_STATUS_ID` or the more specific `NEON_ACTIVITY_COMPLETED_STATUS_ID`; membership request fallback activity also needs `NEON_ACTIVITY_OPEN_STATUS_ID` or `NEON_ACTIVITY_STATUS_ID`.
- Office Hours field persistence still needs exact Neon custom field and option IDs. The admin CRM panel reports this as blocked until `NEON_OFFICE_HOURS_FIELD_ID` and `NEON_OFFICE_HOURS_OPTION_ID` are configured.
- Production Wix embeds still need to be republished from the updated mirror files. Local HTML changes do not automatically update Wix.
- Some archived mirror exports, such as `old-events.html`, still contain Wix-generated relative menu links. They are retained as reference exports and are not treated as active embed source.
- Action Network signature webhooks are not fully generalized yet. `camp-gpe-action-network-ingest` exists, but High Energy Bills and Coal Slush Fund are not wired into canonical lead/action logging or membership continuation.
- General petition points at `+5` and Camp petition dual-awards are represented in the registry seed for Extreme Weather, but automatic idempotent awarding from petition webhook completions is not complete.
- Retroactive point awarding from logged-out petition actions to later Hub identities is not complete.

## Required External Follow-Up

- Set `DEFAULT_MEMBERSHIP_LEVEL_ID` and `DEFAULT_MEMBERSHIP_TERM_ID` in Supabase production secrets.
- Set `NEON_ACTIVITY_TIMEZONE_ID` and Neon activity status secrets for completed/open activity records.
- Paste and publish updated HTML embeds for `take-action`, `become-a-member`, `camp-gpe`, `mobile-climate-adaptation-survey`, and `gpe-grad-highlight` if Wix is not directly loading the pushed GitHub source.
- Confirm exact Neon membership custom field IDs and option IDs for Office Hours and demographic fields.
- Configure Action Network webhooks for each petition and map petition IDs to registry slugs.
- Run real Neon test submissions with approved test constituents to prove account create/update, membership creation, Office Hours automation values, and Hub invitation behavior.
