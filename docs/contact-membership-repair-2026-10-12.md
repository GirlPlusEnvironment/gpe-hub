# Contact and membership synchronization repair — 2026-10-12

## Contact Us

Production `gpe-contact-submit` version 21 returned HTTP 409 after it had already stored and notified staff about an inquiry whenever the browser supplied `identityState: ambiguous_match`, or the function's own Neon lookup was ambiguous. The browser membership preflight was therefore being treated as an account-creation gate even though membership eligibility is unrelated to contact intake.

Version 22 now:

- performs its own Neon constituent lookup regardless of browser membership state;
- reuses a uniquely matched account, whether member or nonmember;
- creates a constituent when the authoritative lookup finds no account;
- stores and notifies staff about true ambiguous matches without attaching the private message;
- returns `202 Accepted` for retained manual-review or retryable sync cases instead of 409/502;
- returns completed duplicates without creating a second Activity;
- records the Neon Activity ID in the sync log.

Production proof:

- An existing retained manual-review submission returned 202 with `ok: true`.
- A labeled request carrying `identityState: ambiguous_match` was independently matched to existing nonmember test account `4078`, created Activity `302`, stored submission `d59eef97-4e17-4a4f-a96e-97604dc3dcc4`, and sent the staff notification.

No Wix HTML change is required for this repair because the current handler accepts successful 2xx responses. Repository changes do not publish Wix.

## Native Neon Form 12

Neon API v2 has no documented server-side Form Builder submission endpoint. A custom API-created Account or Activity does not create a native Form 12 history row. The supported native-history approach is the official Form 12 embed supplied by Neon. It must be reviewed and published as a separate Wix migration; it must not run alongside the custom submission handler without a supported correlation/reconciliation design, or it will duplicate accounts, Activities, and notifications.

## Membership About-field audit

Verified production destinations:

| Membership question | Submitted key | Neon destination | Field ID | Result |
| --- | --- | --- | ---: | --- |
| Age range | `ageRange` | Account About custom field, Age Range | 112 | Raw canonical values are not retained; option IDs are required and are not exposed by the verified metadata response. Blocked. |
| Race/ethnicity | `raceEthnicity` | Account About custom field, Ethnicity/Race | 113 | Text value is retained and verified by account API read-back. |
| Race self-description | `raceEthnicityOther` | None | — | Approval/configuration required. |
| Gender identity | `genderIdentity` | Existing Membership custom field, Gender Identity | 82 | Not an Account About field; life-membership PATCH is unsupported. Approval/configuration required. |
| Gender self-description | `genderIdentityOther` | None | — | Approval/configuration required. |
| Climate interests | `climateInterests` | None | — | Approval/configuration required. |
| Communication preferences | `communicationPreferences` | None | — | Approval/configuration required. |
| Office Hours interest | `interestedInOfficeHours` | Existing Membership custom field | 85 | Not an Account About field; life-membership PATCH is unsupported. Approval/configuration required. |
| Email consent | `emailConsent` | None | — | Approval/configuration required. |
| SMS consent | `smsConsent` | None | — | Approval/configuration required. |
| Terms/privacy consent | `termsConsent` | Internal audit only | — | Intentionally not copied to Neon. |
| Eligibility affirmation | `eligibilityAffirmed` | Internal audit only | — | Intentionally not copied to Neon. |

`gpe-membership-enroll` now persists field-level proposed/verified/failed results in the Supabase submission payload. A field is not reported as mapped unless the Neon account read-back retains it.

Controlled production test:

- Submission `c576ab1a-04cf-45f5-ba30-620affa0149a`
- Neon account `4082`; membership `3033`; retained profile Activity `303`
- Field 113: verified
- Field 112: verification failed and explicitly recorded
- Membership status creation remained confirmed; the mapping repair did not mutate eligibility logic

## Historical dry-run

The original 169-submission cohort was inspected without writes. The restricted row-level reports are stored locally at:

- `/private/tmp/gpe-membership-backfill-dry-run-2026-10-12.json`
- `/private/tmp/gpe-membership-backfill-dry-run-2026-10-12.csv`

Aggregate results:

| Finding | Count |
| --- | ---: |
| Submissions | 169 |
| Linked Neon accounts | 162 |
| Questionnaire field findings | 1,373 |
| Field 113 already current | 145 |
| Field 113 blank and safe for a missing-only backfill | 17 |
| Field 112 blocked pending verified option IDs | 162 |
| Missing About-field configuration | 1,009 |
| Findings requiring account matching | 40 across 6 submissions |

No historical values were changed. The 17 safe Race/Ethnicity updates were not executed because bulk backfill requires explicit approval.
