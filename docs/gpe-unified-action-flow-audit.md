# GPE Unified Action Flow Audit

Status: partial implementation pass completed on July 28, 2026. This document covers the two local folders:

- `/Users/Cassandre/gpe/gpe-hub`
- `/Users/Cassandre/gpe/gpe-mirror`

## Current Inventory

| Page or flow | Provider | Current fields | Neon submission | Hub identity | Action logging | Status |
|---|---|---|---|---|---|---|
| Become a Member | Neon/custom | Canonical membership questions added: eligibility, age range, race/ethnicity, gender identity, Office Hours, interests, communication, email/SMS/terms consent | `gpe-membership-enroll` | queues Hub invitation after membership create | `constituent_leads` + `lead_actions` | Implemented locally; Wix embed must be republished |
| Camp GPE registration | Neon/custom | Camp fields plus canonical membership questions when membership checkbox is selected | `camp-gpe-submit` | queues Hub invitation for accepted membership | `constituent_leads` + `lead_actions` | Implemented locally; Wix embed must be republished |
| Camp GPE challenge submission | Hub/custom | Challenge proof fields; member-only authenticated submit | `camp-gpe-challenge-submit` | requires Hub auth and active membership | existing challenge submission + reviewed point ledger | Existing protected flow |
| Mobile climate survey | Neon/custom survey | Survey already includes age, race/ethnicity, gender | `neon-climate-survey` writes survey audit and Neon activity | resolves membership and queues invitation where appropriate | `constituent_leads` + `lead_actions` | Backend implemented; production route returns `200` |
| GPE Grad Highlight | Neon/custom | Highlight fields plus shared inline canonical membership continuation for nonmembers | `gpe-grad-highlight-submit` | optional membership queues Hub invitation | `constituent_leads` + `lead_actions` | Backend/local embed implemented; production Wix route returns `404` |
| Events | Neon/custom handoff | Event registration fields plus shared inline membership continuation where used | `neon-event-register` | optional membership queues Hub invitation | `constituent_leads` + `lead_actions` | Backend implemented; individual event config still needs route-level QA |
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

## Production Verification

- `gpe_form_registry`, `constituent_leads`, and `lead_actions` exist in production.
- Seeded registry rows exist for `camp-gpe`, `extreme-weather-action`, `gpe-grad-highlight`, and `mobile-climate-adaptation-survey`.
- `gpe_form_submissions` has `lead_id`, `action_slug`, `action_type`, `membership_choice`, and `points_status`.
- Public invalid POST to `gpe-membership-enroll` now reaches function validation and returns `400` with `Eligibility affirmation is required`, not `401`.
- Public invalid POST to `gpe-grad-highlight-submit` with an incomplete membership request returns `400` with `Eligibility affirmation is required`.
- Public invalid POST to `neon-event-register` reaches function validation/event lookup and returns `400`, not JWT failure.

## Known Gaps

- The exact Neon custom field IDs and option values for Office Hours, race/ethnicity, age range, gender identity, interests, and communication preferences are not present in the local repository. The new canonical values are preserved in Supabase and Neon membership request/activity payloads, but exact Neon custom-field writes need dashboard/API confirmation before claiming automation parity.
- `https://www.girlplusenvironment.org/gpe-grad-highlight` returns `404`; the local mirror exists but the Wix page is not published or routed.
- Production Wix embeds still need to be republished from the updated mirror files. Local HTML changes do not automatically update Wix.
- Action Network signature webhooks are not fully generalized yet. `camp-gpe-action-network-ingest` exists, but High Energy Bills and Coal Slush Fund are not wired into canonical lead/action logging or membership continuation.
- General petition points at `+5` and Camp petition dual-awards are represented in the registry seed for Extreme Weather, but automatic idempotent awarding from petition webhook completions is not complete.
- Retroactive point awarding from logged-out petition actions to later Hub identities is not complete.

## Required External Follow-Up

- Publish or redirect the Wix `/gpe-grad-highlight` route.
- Paste and publish updated HTML embeds for `take-action`, `become-a-member`, `camp-gpe`, and `gpe-grad-highlight`.
- Confirm exact Neon membership custom field IDs and option IDs for Office Hours and demographic fields.
- Configure Action Network webhooks for each petition and map petition IDs to registry slugs.
- Run real Neon test submissions with approved test constituents to prove account create/update, membership creation, Office Hours automation values, and Hub invitation behavior.
