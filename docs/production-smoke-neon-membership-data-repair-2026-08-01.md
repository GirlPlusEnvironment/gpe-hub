# Production Smoke + Neon Membership Data Repair - 2026-08-01

## Scope

This audit separates frontend behavior, Supabase persistence, Neon account creation, Neon membership creation, structured member-profile mapping, form-level Neon records, Resend, Hub provisioning, and points. A Neon constituent alone is not counted as success.

## 2026-08-01 Follow-up

Status: PARTIAL

Production Activity configuration has been set and verified. The submit functions now use explicit Neon Activity IDs instead of discovering Activity properties during every request.

Verified production values:

| Secret | Value | Readback |
| --- | --- | --- |
| `NEON_ACTIVITY_TIMEZONE_ID` | `2` | `(GMT-05:00) Central Time - Chicago` |
| `NEON_ACTIVITY_STATUS_ID` | `4` | `Completed` |
| `NEON_ACTIVITY_COMPLETED_STATUS_ID` | `4` | `Completed` |
| `NEON_ACTIVITY_OPEN_STATUS_ID` | `2` | `Not Started` |
| `NEON_ACTIVITY_SYSTEM_USER_ID` | `4722` | Current Neon system user |

Redeployed functions:

- `neon-climate-survey`
- `gpe-grad-highlight-submit`
- `camp-gpe-submit`
- `neon-event-register`
- `gpe-membership-enroll`

Direct production Activity smoke after redeploy:

| Workflow | Supabase row | Neon account | Neon Activity | Email provider ID | Result |
| --- | --- | --- | --- | --- | --- |
| Mobile Climate Survey | `012e12c8-f770-4426-a9d2-5928cb7ec027` | `3724` | `62` | `d1ccd74c-8e45-43ec-a059-20be42bc0975` | PASS for direct function path |
| Grad Highlight | `a8ba8c1e-0a2f-4161-8a9c-640a678bbd7c` | `3725` | `63` | `4e41c3b0-f0e5-4d73-9506-ed6321a8c462` | PASS for direct function path |
| Camp GPE registration | `bcbc5d3e-41fe-435a-9b40-31299156cadf` | `3726` | `64` | `b5cc427c-a644-4c3c-b7d8-241a149ec3e1` | PASS for direct function path |

The Climate 429 blocker is fixed for the Edge Function path. A full published Wix browser submission for Climate still needs a stable Playwright pass; the current direct function proof does not replace the published-form release gate.

Structured Neon membership mapping remains partial. Neon discovery found:

| Frontend field | Neon record type | Neon field ID | Format/status |
| --- | --- | --- | --- |
| Age range | Account custom field | `112` | Configured |
| Race/ethnicity | Account custom field | `113` | Configured |
| Gender identity | Membership custom field | `82` | Discovered, write disabled |
| Office Hours interest | Membership custom field | `85` | Discovered, write disabled |
| Climate interests | Account custom field | Missing | Needs Neon field/dashboard configuration |
| Communication preferences | Account custom field | Missing | Needs Neon field/dashboard configuration |
| Email consent | Account custom field | Missing | Needs Neon field/dashboard configuration |
| SMS consent | Account custom field | Missing | Needs Neon field/dashboard configuration |

Membership-record custom-field writes are feature-flagged behind `NEON_MEMBERSHIP_WRITE_MEMBERSHIP_FIELDS=true` because Neon rejected PATCHing the current life membership with `Field termDuration is not be support on life membership.` Fallback profile Activities still preserve the full normalized payload.

Focused membership mapping smoke after the guard:

| Submission | Neon account | Neon membership | Profile Activity | Mapping result | Email/Hub |
| --- | --- | --- | --- | --- | --- |
| `7f4bfdb2-ff13-40cb-8776-08757c276d4b` | `3723` | `2883` | `61` | PARTIAL: no Neon 400; missing mappings explicitly listed | Membership email sent; Hub invite sent |

Camp approval proof for the provided action is blocked by identity state:

| Field | Value |
| --- | --- |
| Camp challenge submission | `127f5ddd-f45a-498c-ab50-c82391336837` |
| Camp action | `9b170d87-df67-4c9d-be69-7c2dc9ce65d4` |
| Review status | `pending` |
| Requested points | `5` |
| Matched Hub profile | None |
| Season member | None |
| Existing point transaction | None |
| Existing Camp ledger | None |
| Link status | `pending_reconciliation` |

This submission is a valid proof that the public Camp challenge creates a pending action, but it is not a valid proof of member point approval because it is not linked to an active Hub profile or Camp season member. Do not award this as the manual approval proof. Use a dedicated QA Hub profile with an active membership and Camp season membership, then approve that existing review through the admin UI and retry approval to prove idempotency.

## Shared Membership Helper

Status: PARTIAL

- Fixed `ReferenceError: hubLogin is not defined` in both helper copies:
  - `gpe/girlplusenvironment.org/gpe-form-membership.js`
  - `gpe/gpe-mirror/gpe-form-membership.js`
- Moved Hub login, invite, activation, and password-reset URLs into stable initialization scope.
- Replaced direct async lookup `setState()` calls with defensive `safeSetState()` calls so UI render exceptions cannot leave the form stuck on `Checking your GPE membership...`.
- Synchronized both helper files and verified `node --check`.
- Pushed website helper commit: `e8b3cee70fc179d990974c813d1d3cfc2ddf94e1`.
- Purged jsDelivr and verified CDN byte-for-byte against the repository helper:
  - SHA-256: `03e3c046f708b6d0626609ae4efd05f4819dc896a4fe08595d226b190b209327`
- Live published Wix embeds still contain the copied `v=20260729a` script URL and need Wix republish to display the bumped `v=20260731a` URL. Because the URL points at `@main/gpe-form-membership.js`, the purged CDN now serves the fixed helper bytes even for the old query string.

Published-page lookup probes:

| Page | Helper loaded | Lookup result | Stuck on Checking | Console blocker | Result |
| --- | --- | --- | --- | --- | --- |
| Mobile Climate Survey | `gpe-form-membership.js?v=20260729a` in Wix embed, fixed CDN bytes after purge | `neon-membership-check` 200, `new_person` | No | No `hubLogin` error | PARTIAL |
| Become a Member | `gpe-form-membership.js?v=20260729a` in Wix embed, fixed CDN bytes after purge | `neon-membership-check` 200, `new_person` | No | No `hubLogin` error | PARTIAL |
| Grad Highlight | `gpe-form-membership.js?v=20260729a` in Wix embed, fixed CDN bytes after purge | `neon-membership-check` 200, `new_person` | No | No `hubLogin` error | PARTIAL |
| Camp GPE | `gpe-form-membership.js?v=20260729a` in Wix embed, fixed CDN bytes after purge | `neon-membership-check` 200, `new_person` | No | No `hubLogin` error | PARTIAL |

Wix `ExpandableMenu` console messages were observed but are unrelated to membership lookup.

## Deployed Edge Functions

Deployed with `supabase functions deploy ... --use-api --project-ref wisvwuysysbitxluajmv`:

- `gpe-membership-enroll`
- `gpe-grad-highlight-submit`
- `camp-gpe-submit`
- `neon-climate-survey`
- `neon-event-register`

Shared mapper changes:

- `membershipProfileMapped` is now false unless all present profile fields have structured Neon custom-field mappings and write/verify succeeds.
- Missing Neon custom-field mappings are returned in `missingMembershipMappings`.
- New membership enrollment submissions persist `membershipId` and the finalization payload in `gpe_form_submissions.submission_payload`.

## Current Production Smoke Evidence

| Workflow | Live frontend | Supabase submission | Neon account | Neon membership | Structured member fields | Neon form result | Resend | Hub invite/profile | Points | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Standalone Become a Member | Lookup probe passed; full browser submit not completed | `c1c4a1be-393c-40a0-a9fe-d0c2092d110b` | `3708` | `2879` | FAIL: `membershipProfileMapped=false`; missing field mappings listed | Membership profile activity note `46`; no separate form Activity expected for standalone membership | `member-welcome` accepted, provider `d158f1f8-5f76-4a1b-8e39-b494f632c092` | Hub profile `56cf41be-1e09-40c0-ab4a-fd38a4372506`; `hub-welcome` provider `53abca30-faad-4046-bc49-8af13183ab22`; no persistent invite row because activation path succeeded directly | Not applicable, profile points `0` | PARTIAL |
| Mobile Climate Survey without membership | Lookup probe passed; direct function smoke used for submission | Climate table row `06bdbe7d-fab3-4454-a882-3bbd97f54592` | `3712` | Not requested | Not applicable | Neon Activity `50` | `survey-thank-you` accepted, provider `7d804c45-d1fe-40ad-b67d-62892374c9e7` | Not requested | Not verified | PARTIAL |
| Grad Highlight without membership | Isolated direct function smoke used for submission | `9f71835c-bc04-4f00-a687-445a29e00ab6` | `3713` | Not requested | Not applicable | Neon Activity `51` | `graduate-highlight-submission` accepted, provider `e29482f7-325f-4fdc-adef-cc0f61b89540` | Not requested | Pending identity: point event `107ad407-d3b8-478a-b213-cb0290864305`, pending award `2ae1f161-86f0-404f-8ad8-e49dd632db58`, 50 points | PARTIAL |
| Camp GPE registration without membership | Direct function smoke used for submission | `1a17a269-c784-4e4a-a734-727a1aff41dc` | `3714` | Not requested | Not applicable | Neon Activity `52` | `camp-gpe-submission` accepted, provider `02384b89-0b6d-4675-8e0b-bce16c583ab6` | Not requested | Not applicable | PARTIAL |

The earlier `example.com` smoke attempts produced Resend 422 responses because Resend rejects recipient domains like `example.com` in this account. The controlled-domain rerun used `@girlplusenvironment.org` addresses and received provider 200 responses. The parallel direct smoke also produced one transient Grad 500 with no saved Grad row for `gpe.grad.activity.1785546637523.3bbg@example.com`; subsequent isolated and controlled-domain Grad requests succeeded.

## Live Published Wix Submission Evidence

These submissions were made through the actual published Wix iframes, with network requests captured from the browser.

| Workflow | Published page | Helper lookup | Submit endpoint | Supabase/readback | Neon account | Neon membership | Neon form/result | Resend | Points | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Standalone Become a Member | `https://www.girlplusenvironment.org/become-a-member` | `neon-membership-check` 200, `new_person`, not stuck | `gpe-membership-enroll` 200 | `ce14a860-af8a-44ea-a959-ca9bb4f7e8ed`; lead action `91dee98d-1528-4abf-99df-62ef8772947f`; Hub profile `a7cdbeda-cc5b-4ba6-937b-a8c1da20b6db` | `3715` | `2880` | Profile note Activity `53`; structured fields partial | Hub welcome `16dfe5d1-43ed-4b20-a048-d9b22dfcb28d`; member welcome `821643cf-176d-49b7-bbae-ff02256578aa` | Not applicable; Hub profile points `0` | PARTIAL |
| Grad Highlight without membership | `https://www.girlplusenvironment.org/gpe-grad-highlight` | `neon-membership-check` 200, `new_person`, not stuck | `gpe-grad-highlight-submit` 200 | `5790374d-848b-4373-8604-9c4e590796c7`; lead action `63f3142a-d5dd-4f8e-aa74-76cf39ff16b0` | `3716` | Not requested | Neon Activity `54` | `graduate-highlight-submission` `2f12cf6d-1da5-4233-921c-a349633ef666` | Pending identity: point event `92e57011-8738-4eea-ab41-9a179a08df2c`, pending award `ed67ae3c-4e86-4ce4-96d4-1365942511b7`, 50 points | PARTIAL |
| Camp GPE challenge submission | `https://www.girlplusenvironment.org/camp-gpe` | `neon-membership-check` 200, `new_person`, not stuck | `camp-gpe-challenge-submit` 200 | form submission `2a3fb458-ffda-48f1-8a6b-7c54de5b5697`; review submission `127f5ddd-f45a-498c-ab50-c82391336837`; action `9b170d87-df67-4c9d-be69-7c2dc9ce65d4` | Not created for unauthenticated nonmember challenge proof | Not requested | Not applicable for this proof-review workflow | No confirmation email observed for this workflow | Requested 5 points; review pending; no ledger row before approval | PARTIAL |

Live Camp challenge readback:

- `gpe_camp_challenge_submissions.review_status = pending`
- `gpe_camp_challenge_submissions.member_link_status = pending_reconciliation`
- `gpe_camp_submission_actions.requested_points = 5`
- `gpe_camp_points_ledger` has no row yet, which is correct until review approval.

## Neon Membership Field Mapping Report

Production now includes verified field IDs for Age Range and Race/Ethnicity on the Neon account, plus discovered membership custom fields for Gender Identity and Office Hours. Membership-record writes remain disabled because Neon rejects PATCHing custom fields on the current life-membership record shape.

| Frontend field | Neon record type | Neon field ID | Option IDs | Format | Status |
| --- | --- | --- | --- | --- | --- |
| Age range | Account custom field | `112` | Not returned by Neon metadata endpoint | Text/custom field write configured | PARTIAL |
| Race/ethnicity | Account custom field | `113` | Not returned by Neon metadata endpoint | Text/custom field write configured | PARTIAL |
| Race self-description | Account custom field | Missing | Not applicable | Text | BLOCKED |
| Gender identity | Membership custom field | `82` | Not returned by Neon metadata endpoint | Write disabled pending Neon life-membership PATCH support | BLOCKED |
| Gender self-description | Membership custom field | Missing | Not applicable | Text | BLOCKED |
| Climate interests | Account custom field | Missing | Missing | Multi-select or text fallback | BLOCKED |
| Communication preferences | Account custom field | Missing | Missing | Multi-select or text fallback | BLOCKED |
| Office Hours interest | Membership custom field | `85` | Not returned by Neon metadata endpoint | Write disabled pending Neon life-membership PATCH support | BLOCKED |
| Email consent | Account custom field | Missing | Missing | Boolean/select or text fallback | BLOCKED |
| SMS consent | Account custom field | Missing | Missing | Boolean/select or text fallback | BLOCKED |
| Terms/privacy consent | Internal audit only | Not written | Not applicable | Boolean | Intentionally ignored |
| Eligibility affirmation | Internal audit only | Not written | Not applicable | Boolean | Intentionally ignored |

Required configuration:

- Create or identify Neon account custom fields for the remaining onboarding answers.
- Set `NEON_MEMBERSHIP_FIELD_*` secrets for each structured account custom field.
- Set `NEON_MEMBERSHIP_FIELD_*_OPTIONS_JSON` secrets if Neon requires option IDs instead of text values.
- Resolve whether Gender Identity and Office Hours should move to account custom fields or whether Neon supports a different membership PATCH shape for life memberships.
- Rerun membership enrollment and read back `/accounts/{id}` to verify `individualAccount.accountCustomFields`.

Production secret-name readback on 2026-08-01 confirmed:

- Present: `NEON_API_BASE_URL`, `NEON_API_KEY`, `NEON_API_VERSION`, `NEON_ORG_ID`
- Present: `DEFAULT_MEMBERSHIP_LEVEL_ID`, `DEFAULT_MEMBERSHIP_TERM_ID`
- Present: `NEON_ACTIVITY_TIMEZONE_ID`, `NEON_ACTIVITY_STATUS_ID`, `NEON_ACTIVITY_COMPLETED_STATUS_ID`, `NEON_ACTIVITY_OPEN_STATUS_ID`, `NEON_ACTIVITY_SYSTEM_USER_ID`
- Present: `NEON_MEMBERSHIP_FIELD_AGE_RANGE`, `NEON_MEMBERSHIP_FIELD_RACE_ETHNICITY`, `NEON_MEMBERSHIP_FIELD_GENDER_IDENTITY`, `NEON_MEMBERSHIP_FIELD_OFFICE_HOURS_INTEREST`
- Missing: field IDs for climate interests, communication preferences, email consent, SMS consent, self-description fields, and all option mapping JSON secrets

The Edge Functions can reach Neon using production secrets, but the CLI can only read secret names/hashes, not values. The `admin-neon-discovery` function returns non-secret Neon metadata for admin/service-role diagnostics.

## Resend Evidence

Controlled-domain smoke emails were accepted by Resend and written to `gpe_email_deliveries`.

| Workflow | Recipient | Template | App delivery row | Resend log | Provider message ID | Provider status | Delivery status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile Climate Survey | `gpe-smoke+climate-direct-20260801-1785547011197-ui26@girlplusenvironment.org` | `survey-thank-you` | source `06bdbe7d-fab3-4454-a882-3bbd97f54592` | `3aa25feb-725e-4064-9992-7acb08a30707` | `7d804c45-d1fe-40ad-b67d-62892374c9e7` | 200 | Accepted; `delivered_at` null |
| Grad Highlight | `gpe-smoke+grad-direct-20260801-1785547011197-0uo2@girlplusenvironment.org` | `graduate-highlight-submission` | source `9f71835c-bc04-4f00-a687-445a29e00ab6` | `4835360b-3855-4546-8ecf-710629b3ddd4` | `e29482f7-325f-4fdc-adef-cc0f61b89540` | 200 | Accepted; `delivered_at` null |
| Camp GPE registration | `gpe-smoke+camp-direct-20260801-1785547011197-bmkb@girlplusenvironment.org` | `camp-gpe-submission` | source `1a17a269-c784-4e4a-a734-727a1aff41dc` | `81c60e1b-bd78-4e84-9ffa-f6cf95f857cf` | `02384b89-0b6d-4675-8e0b-bce16c583ab6` | 200 | Accepted; `delivered_at` null |

Earlier `example.com` smoke emails failed with Resend 422 validation errors. That is not a transactional-email template failure; it is an invalid test-recipient domain for this account.

## Historical Membership Backfill Dry Run

Dry-run query identified historical membership-like submissions with normalized profile data in Supabase and Neon account/membership IDs recoverable from `gpe_form_submissions` or `lead_actions.raw_payload`.

Representative candidates requiring Neon account custom-field readback:

| Submission ID | Email | Neon account | Neon membership | Status |
| --- | --- | --- | --- | --- |
| `c1c4a1be-393c-40a0-a9fe-d0c2092d110b` | `gpe.membership.invite.1785546515558.crdh@girlplusenvironment.org` | `3708` | `2879` | Candidate, blocked by missing field mappings |
| `0a19c2b0-c588-4c69-8919-afaa6d33a81b` | `gpe.membership.invite.1785545878819.23ly@girlplusenvironment.org` | `3707` | `2878` | Candidate, blocked by missing field mappings |
| `414d2f89-b111-448e-8e91-8999048bd5df` | Available in Supabase dry run | `3702` | `2877` | Candidate, needs Neon readback |
| `ee014e04-a202-4c1c-85fa-476c8f19c7c2` | Available in Supabase dry run | `3700` | `2875` | Candidate, needs Neon readback |
| `ed1bde2f-be2b-4868-8148-dfbe38f90bab` | Available in Supabase dry run | `3699` | `2874` | Candidate, needs Neon readback |
| `3af9abe4-c9b5-4e95-b995-2504f1ac3d31` | `gpe-audit+grad-member-20260730-001@girlplusenvironment.org` | `3685` | `2868` | Candidate, activity/profile mapping previously blocked |

Backfill must remain dry-run until real Neon field IDs and option IDs are configured. The backfill should update only missing structured fields by default, avoid overwriting staff-edited values, and store API responses/errors per field.

## Remaining Gates

- Republish Wix embeds so live copied HTML references `v=20260731a`.
- Run full browser submissions through the actual published Wix forms, not only direct Edge Function calls.
- Discover production Neon custom-field IDs and option IDs; configure secrets.
- Rerun membership smoke and confirm `membershipProfileMapped=true` with structured account custom fields visible in Neon staff profile panels.
- Implement/run idempotent historical backfill after the mapping table is verified.
- Verify Resend delivery webhooks or inbox receipt, not just provider acceptance.
- Complete point workflows not covered here: petitions, Camp challenge, resources, jobs, funding, community post/comment/like/favorite/message/invite.
- Confirm a valid production event exists before event-registration smoke.
