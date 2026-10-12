# GPE Sitewide Form Integration Audit — 2026-10-12

## Executive finding

Neon CRM API v2.12 does not expose a native Form Builder submission endpoint. The public Neon forms submit through private browser routes (`/nx/portal/*-form`) with browser state and reCAPTCHA. Those routes are not supported server-to-server APIs.

Consequently, the only verified way to populate an existing Neon's form submission history is to use the published Neon form itself (hosted link, supported full-size embed, or supported pop-up). Creating an Account, Membership, Donation, Event Registration, Survey Activity, or ordinary Activity through API v2 does not prove that a native form-submission row exists.

Status terms in this report:

- **Confirmed**: established from repository code, production database metadata, deployed-function metadata, captured hosted-form HTML, or a public HTTP check.
- **Inferred**: strongly implied by code/configuration but not verified in the destination UI.
- **Unverified**: requires a Neon or Wix administrator session, or a controlled production submission.

## Confirmed Neon-hosted forms

All seven URLs returned HTTP 200 on 2026-10-12.

| Form | ID | Type | Hosted URL | Browser submit route |
|---|---:|---|---|---|
| Donation | 4 | Donation | `https://girlplusenvironment.app.neoncrm.com/forms/donate` | `/nx/portal/donation-form` |
| Membership | 5 | Membership | `https://girlplusenvironment.app.neoncrm.com/forms/membership` | `/nx/portal/membership-form` |
| GPE Grad Highlight | 11 | Account | `https://girlplusenvironment.app.neoncrm.com/forms/gpe-grad-highlight` | `/nx/portal/account-form` |
| Contact Us | 12 | Account | `https://girlplusenvironment.app.neoncrm.com/forms/contact-us` | `/nx/portal/account-form` |
| Camp GPE | 14 | Account | `https://girlplusenvironment.app.neoncrm.com/forms/camp-gpe-1` | `/nx/portal/account-form` |
| Camp GPE Challenge Submissions | 15 | Account | `https://girlplusenvironment.app.neoncrm.com/forms/camp-gpe-challenge-submissions` | `/nx/portal/account-form` |
| Mobile Climate Adaptation Plan Survey | 47 | Survey | `https://girlplusenvironment.app.neoncrm.com/forms/mobile-climate-adaptation-plan-survey` | `/nx/portal/survey-form` |

The browser routes above are evidence of how Neon's own pages operate, not approved integration endpoints.

## Complete integration inventory

| Form/action | Frontend location | Supabase function | Neon form / designated record | Primary destination | Native submission | Neon Activity | Supabase record | Email notification | Recommended fix | Wix update |
|---|---|---|---|---|---|---|---|---|---|---|
| Contact Us | Wix `/contact`; `gpe-mirror/contact.html` | `gpe-contact-submit` | Contact Us, ID 12, `/forms/contact-us` (confirmed) | Native Contact Us dashboard | **Missing (confirmed)** | 13 successful Activity writes recorded; 1 account-match skip (confirmed) | `gpe_form_submissions`, `gpe_form_sync_logs`; 14 rows (confirmed) | Resend staff notification; 2 successful and 12 historical failed log entries (confirmed; configuration repaired) | Replace custom submit control with Neon's generated embed. Add supported reconciliation after Neon-originated submission; do not call private route. | **Yes; republish required** |
| Membership enrollment / renewal | Wix `/become-a-member`; `gpe-mirror/become-a-member.html`; Hub login membership branch in `src/pages/Login.tsx` | `gpe-membership-enroll` | Membership, ID 5, `/forms/membership` (confirmed) | Neon membership record and native form history when form 5 is used | **Missing for custom enrollments (confirmed by architecture; UI verification pending)** | No general enrollment Activity; membership API object is created (confirmed code) | `gpe_form_submissions`; 169 rows: 162 succeeded, 4 failed, 3 not attempted (confirmed) | Membership/Hub lifecycle email path configured (confirmed code); delivery-by-row not fully audited | Use form 5 embed/hosted form when native history is mandatory. Keep API lookup for Hub authorization. Reconcile membership webhook to Supabase; do not duplicate membership creation. | **Yes** for Wix; Hub flow decision requires approval |
| Donation intent and payment | Wix `/donate`; `gpe-mirror/donate.html` | `gpe-donation-intake` | Donation, ID 4, `/forms/donate` (confirmed) | Neon-hosted payment/donation record | **Expected only after hosted payment; dashboard test unverified** | Not appropriate before payment | `gpe_form_submissions`; 5 intent rows, all `skipped` for Neon sync (confirmed) | Resend donation follow-up configured; 5 historical failed logs (confirmed) | Preserve hosted payment handoff. Add donation webhook reconciliation to mark intent paid only when safely correlatable. Never equate intent with donation. | Existing handoff should remain; review/publish only if embed replaces redirect |
| Camp GPE registration | Wix `/camp-gpe`; `gpe-mirror/camp-gpe.html` | `camp-gpe-submit` | Camp GPE, ID 14, `/forms/camp-gpe-1` (confirmed) | Native Camp form dashboard plus Camp season registration | **Missing for custom registrations (confirmed architecture)** | 6 success, 3 failure Activity logs; 1 older combined failure (confirmed) | `gpe_form_submissions` (11 rows), `gpe_form_registrations`, season tables | Camp lifecycle confirmation configured (confirmed code); aggregate delivery unverified | Use official form 14 embed for native history, then reconcile account changes into Camp tables; otherwise formally designate Supabase Camp Admin as primary and retire native-dashboard requirement. Requires workflow approval. | **Yes** |
| Camp GPE challenge submission | Wix `/camp-gpe` and Hub Camp pages; `gpe-mirror/camp-gpe.html`, `src/pages/CampChallenges.tsx`, `src/pages/CampChallengeSubmit.tsx` | `camp-gpe-challenge-submit` | Camp Challenge, ID 15, `/forms/camp-gpe-challenge-submissions` (confirmed) | Camp review/admin workflow; native dashboard requested if form 15 remains operational | **Missing for custom submissions (confirmed architecture)** | 6 success, 2 failure logs; other rows skipped/not attempted (confirmed) | `gpe_form_submissions` (19), `gpe_camp_challenge_submissions`, actions/member tables | No dedicated submitter notification identified (confirmed code review) | Decide one primary system. Native requirement needs form 15 embed and a supported reconciliation design; Hub-native review favors Supabase primary and retiring form 15. Approval required. | **Yes** for Wix; Hub code change if native path chosen |
| GPE Grad Highlight | Wix `/gpe-grad-highlight`; `gpe-mirror/gpe-grad-highlight.html` | `gpe-grad-highlight-submit` | GPE Grad Highlight, ID 11, `/forms/gpe-grad-highlight` (confirmed) | Native Grad Highlight dashboard | **Missing for custom submissions (confirmed architecture)** | 9 success and 18 failed Activity log attempts (confirmed) | `gpe_form_submissions`; 25 rows: 16 succeeded, 8 failed, 1 not attempted (confirmed) | Confirmation and membership lifecycle paths configured; delivery aggregate unverified | Replace submit path with official form 11 embed; define photo-upload handling in Neon form. Reconcile via supported account webhook only if a reliable source marker exists. | **Yes** |
| Mobile Climate Adaptation Plan Survey | Wix survey page; `gpe-mirror/mobile-climate-adaptation-survey.html` | `neon-climate-survey` | Survey, ID 47, `/forms/mobile-climate-adaptation-plan-survey` (confirmed) | Native survey responses/dashboard | **Missing for custom submissions (confirmed architecture)** | 7 rows have Activity IDs; 7 remain pending (confirmed) | `neon_climate_survey_submissions`, `neon_climate_survey_retries`; 14 total | Survey lifecycle email configured (confirmed code); delivery aggregate unverified | Native survey requirement needs hosted survey 47. Neon documentation found for full embeds covers Account/Donation/Membership/Volunteer, not Survey; use hosted link unless Neon Support confirms a supported Survey embed. | **Yes** |
| Event registration | Wix `/events`; `gpe-mirror/events.html` | `neon-event-register` | Event-specific Neon registration URL / Event Registration object, not one fixed form (confirmed code) | Neon Event Registration | Not applicable as a single Form Builder dashboard | No Activity in intake function | `gpe_event_registration_intents`, `gpe_event_sync_logs`; currently 0 intents (confirmed) | Internal event notification RPC exists; email delivery unverified | Preserve redirect to event-specific Neon URL. Reconcile supported Event Registration webhooks/API. Do not treat intent as registration. | No for architecture; Wix publish only for ordinary page changes |
| Action Network petitions / advocacy | Wix campaign pages: `high-energy-bills-action.html`, `extreme-weather-action.html`, `coal-slush-fund-action.html`; Action Network widgets | `camp-gpe-action-network-ingest`, `action-network-completion-bridge`, `petition-action-status` | Action Network signature; Neon Activity is secondary; no Neon form identified (confirmed) | Action Network + GPE review/points | Not applicable | 80 successful and 3 failed petition Activity attempts across processing/retries (confirmed) | `gpe_form_submissions` 34 unique rows; `lead_actions` and petition/points tables | 82 successful Resend confirmation attempts across webhook/retry processing (confirmed) | Keep Action Network primary. Improve idempotent retry/alerting for failed Neon activities and identity links. | No current structural update |
| Hub job submission | Hub `/submit/job`; `src/pages/JobSubmissionForm.tsx` | `hub-listing-submit` | No Neon form identified (confirmed repository search) | Hub moderation | Not applicable | Not created (confirmed) | `gpe_form_submissions` 7; `listings`; `lead_actions` | None identified | Supabase remains primary; optional Activity only after approval if staff need CRM visibility. | No |
| Hub event listing submission | Hub event submission page; `src/pages/EventSubmissionForm.tsx` | `hub-listing-submit` | No Neon form; this is a listing, not event registration | Hub moderation | Not applicable | Not created | `gpe_form_submissions` 2; `listings`; `lead_actions` | None identified | Keep Supabase primary. Do not confuse with Neon Event Registration. | No |
| Hub funding submission | Hub funding submission page; `src/pages/FundingSubmissionForm.tsx` | `hub-listing-submit` | No Neon form identified | Hub moderation | Not applicable | Not created | `gpe_form_submissions` 1; `listings`; `lead_actions` | None identified | Keep Supabase primary; optional post-approval Activity only. | No |
| Hub resource submission | Hub resource submission page; `src/pages/ResourceSubmissionForm.tsx` | `hub-listing-submit` | No Neon form identified | Hub moderation | Not applicable | Not created | `gpe_form_submissions` 3; `listings`; `lead_actions` | None identified | Keep Supabase primary; optional post-approval Activity only. | No |
| Newsletter signup | No active standalone submission form or endpoint found (confirmed repository search) | None | No Neon form identified | Unassigned | Unsupported / absent | Absent | Absent | `newsletter` lifecycle template exists, but no signup trigger found | Product/configuration decision required before implementation. | Unverified |
| Volunteer / mentorship applications | Benefits/content references exist, but no active standalone application form or intake endpoint found (confirmed repository search) | None | No corresponding hosted form captured | Unassigned | Unsupported / absent | Absent | Absent | Volunteer-interest template exists without identified public trigger | Inventory Neon admin for unpublished forms, then choose Neon hosted Volunteer form or Supabase primary. | Unverified |
| Hub authentication, profile edits, posts, comments, invites | Member Hub React pages/components | Supabase Auth/Data API or Hub functions | No Neon form intended | Supabase/Hub | Not applicable | Not applicable except explicit sync jobs | Auth/profile/content tables | Various lifecycle emails | Exclude from CRM form dashboard acceptance; these are application operations. | No |

## Production evidence summary

- Contact: 14 stored rows; 13 marked Neon succeeded, 1 skipped. The requested historical cohort is the first 12 rows through the 2026-10-12 17:09 UTC website submission. All 12 logged `contact_activity`; none logged a native form submission.
- Membership: 169 stored rows; 162 succeeded, 4 failed, 3 not attempted.
- Camp registration: 11 rows; 7 succeeded, 3 failed, 1 not attempted.
- Camp challenges: 19 rows; 8 succeeded, 10 skipped, 1 not attempted.
- Grad Highlight: 25 rows; 16 succeeded, 8 failed, 1 not attempted.
- Donation intake: 5 rows; all correctly avoid claiming a completed Neon payment.
- Petitions: 34 unique rows; 32 succeeded and 2 failed at the row status level.
- Climate survey: 14 rows in its specialized table; 7 synced with retained Activity IDs and 7 pending.
- Event registration intents: no production rows at audit time.
- Hub listings: 13 total across jobs, events, funding, and resources; all intentionally have no Neon sync attempt.

## Root cause

The custom-form architecture stores Neon form IDs as metadata but writes API objects—usually Activities, Memberships, Accounts, or Event Registration intents. Neon does not interpret metadata such as `formId: 12` as a submission to that form. The implementation and status model therefore conflate “a Neon API write succeeded” with “the required native form received a submission.”

The mismatch affects forms 5, 11, 12, 14, 15, and 47. Donation form 4 already hands users to Neon for the authoritative payment step, although its completion reconciliation is incomplete.

## Supported target architecture

For actions that must appear in an existing native dashboard:

1. Render the actual published Neon form using Neon's generated embed, or navigate to its hosted URL.
2. Let Neon create the native submission and its authoritative CRM object.
3. Receive supported object webhooks where available (Account, Donation, Event Registration, Membership, Activity, Order, or Pledge Payment), or run a scheduled API reconciliation.
4. Upsert a Supabase audit record using a stable Neon object ID and a source marker when available.
5. Create the secondary Activity idempotently only after the native/authoritative object is verified.
6. Alert staff if reconciliation does not complete within an agreed SLA.

Limitations:

- Neon does not document a Form Submission webhook.
- Account create/update webhooks alone may not identify which account form was submitted, especially for existing constituents.
- Therefore Contact, Camp account forms, and Grad Highlight need an approved correlation marker or confirmation from Neon Support before Supabase can truthfully track native-submission completion.
- Survey full-size embedding was not included in Neon's documented supported embed types; use its hosted URL pending Neon confirmation.

## Reliability schema recommendation

Do not overload `neon_sync_status`. Introduce destination-specific fields only after the chosen browser/reconciliation workflow is approved:

- `native_form_required`
- `neon_form_id`
- `native_submission_status`
- `native_submission_id`
- `native_submission_verified_at`
- `native_submission_last_attempt_at`
- `native_submission_retry_count`
- `native_submission_error`
- `neon_account_id`
- `neon_activity_status`
- `neon_activity_id`
- `neon_activity_last_attempt_at`
- `neon_activity_retry_count`
- existing notification provider/status/message ID fields

A response may say `accepted` when Supabase intake succeeds, but must not say `completed` until every required destination is verified. Each destination needs its own idempotency key and retry boundary.

## Historical Contact Us recovery

The 12-row cohort is recoverable as data but not safely importable into native history through a documented API. Automated replay through the public form would alter submission dates, invoke reCAPTCHA, risk duplicate communications, and may change account data.

Safe plan:

1. Export the 12 Supabase records into a restricted staff reconciliation file with submission UUID, original timestamp, contact fields, account ID where known, and Activity state.
2. Ask Neon Support whether they can import those records into form 12 while preserving timestamps and suppressing emails.
3. If Neon cannot, retain Supabase as the authoritative historical audit and provide staff a filtered reconciliation view/export; do not falsify native submissions.
4. Do not replay until Neon explicitly confirms duplicate matching, timestamps, and notification suppression.

## Required Wix and Neon administration

Wix pages requiring a submit-path change if native dashboards remain mandatory:

- Contact Us: `/contact`
- Become a Member: `/become-a-member`
- Camp GPE registration and challenge sections: `/camp-gpe`
- GPE Grad Highlight: `/gpe-grad-highlight`
- Mobile Climate Adaptation Survey page

Donation already transfers to Neon and Events already transfer to event-specific Neon registration URLs.

For each embeddable form, a Neon administrator must open **Forms & Pages → Forms → [form] → Edit → Sharing → Embed**, enable the embed, add all production/editor Wix origins, and copy the complete generated script. Neon explicitly instructs Wix customers to use that generated script and include the editor plus both `filesusr.com` origins. The generated script cannot be reconstructed safely from API credentials.

Every Wix HTML replacement must be pasted into the corresponding Wix Embed HTML element and the Wix site republished. A Git push does not publish Wix embeds.

## Deployment decision

No production workflow, schema, Wix page, or Edge Function was changed in this audit. That is intentional: the first required repair depends on Neon-generated embed code and a native-dashboard verification session, while several other forms require a staff workflow decision. Calling the private `/nx/portal/*-form` routes or bulk replaying submissions would be speculative and unsafe.

## Prioritized next actions

1. **Contact Us:** enable/copy the official form 12 embed and provide a Neon dashboard verification session. Replace only the Contact Wix form, publish, and run one labeled test.
2. Ask Neon Support how embedded Account-form submissions can be correlated to downstream automation and whether historical form-submission imports are available.
3. Configure supported Neon v2 webhooks to a new authenticated Supabase receiver for Membership, Donation, and Event Registration objects; use explicit source/correlation IDs.
4. Decide whether Membership, Camp, Grad Highlight, and Survey must retain their native dashboards. If yes, migrate each frontend to hosted/embed flow one at a time and verify the dashboard before retiring its custom mutation.
5. Add destination-specific statuses, retry counters, retained IDs, and an administrator failure queue after the workflow decision.
6. Repair existing failed/pending secondary syncs (Grad Highlight, Camp, Survey, Petition) with idempotency after primary-destination semantics are corrected.
7. Add immediate alerting for required-primary failures and a daily unresolved-sync digest.
8. Inventory unpublished Neon Volunteer/Mentorship/Newsletter forms in the Neon admin UI; none were discoverable from repository or public hosted captures.

