# GPE Email Lifecycle Audit

Updated: 2026-07-30

## Provider Rules

| Provider | Use Now | Notes |
| --- | --- | --- |
| Resend | Surveys, petitions, Grad Highlight, Camp, membership welcome, donation intake, Hub lifecycle follow-ups, public form confirmations | Form completion and membership confirmation are intentionally separate messages. |
| Supabase Auth | Password reset, secure invite token, account recovery, magic links | Secure tokens must originate from Supabase Auth and service/secret keys stay server-side. |
| Neon | Event registration/payment emails and required financial receipts where Neon is the system of record | Event email migration is deferred. Generic constituent/account creation must not trigger a GPE-branded welcome. |
| Action Network | Webhook/source event only | Action Network is not treated as the final GPE-branded confirmation provider. |

## Trigger Audit

| Trigger | Current Provider | Current Email(s) | Desired Provider | Desired Email(s) | Duplicate Risk | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Become a Member | Resend through `member-welcome`; Supabase Auth invite when Hub activation required | Member welcome, optional Hub invite | Resend + Supabase Auth | One `member-welcome`; invite only when no linked Hub profile exists | Previously Hub invite could be queued even when not required | Fixed in shared finalizer |
| Survey only | Resend | `survey-thank-you` | Resend | One survey confirmation with Become/Invite/Hub CTAs | Old template had outdated Hub copy and weak membership distinction | Fixed |
| Survey + membership | Resend | Survey confirmation plus `member-welcome`; optional Hub invite | Resend + Supabase Auth | Survey confirmation and one member welcome after Neon membership ID | Duplicate risk if a Neon membership template is enabled in dashboard | Repo fixed; dashboard audit required |
| Petition | Resend via Action Network bridge/webhook | `action-network-petition-thank-you` | Resend | One petition confirmation with next actions/resources and Hub CTAs | Action Network and Resend could both send branded confirmations if Action Network email remains enabled | Repo fixed; Action Network dashboard audit required |
| Petition + membership | Resend | Petition confirmation; membership welcome only if a membership creation path runs | Resend + Supabase Auth | Petition confirmation plus member welcome only after Neon membership creation | No membership creation currently happens in the Action Network handlers | Documented |
| Grad Highlight | Resend | `graduate-highlight-submission` | Resend | One Grad Highlight confirmation | Low | Verified code path |
| Grad Highlight + membership | Resend | Grad Highlight confirmation plus member welcome after finalizer | Resend + Supabase Auth | Form confirmation plus one membership welcome | Previously membership was created without finalization email | Fixed |
| Camp registration | Resend | `camp-gpe-submission` | Resend | One Camp confirmation | Low | Verified code path |
| Camp + membership | Resend | Camp confirmation plus member welcome after finalizer | Resend + Supabase Auth | Form confirmation plus one membership welcome | Hub invite now only when needed | Fixed |
| Donation intake | None/redirect only | No repo email before this change | Resend | One donation intake confirmation with secure payment CTA | Previously no confirmation email from repo path | Migrated |
| Volunteer | Resend template exists; no active Edge trigger found in repo | None found in current functions | Resend | One volunteer confirmation | No email risk until trigger exists | Needs trigger wiring if volunteer form endpoint is added |
| Hub invitation | Supabase Auth from `hub-invitation-request` | Secure Supabase invite email | Supabase Auth | Secure invite/activation email | Abuse risk without throttle | Rate limit added |
| Hub account activation | Resend lifecycle templates exist; Supabase Auth token owns account setup | Hub activated/welcome templates | Supabase Auth + Resend where triggered | Auth secure token plus optional lifecycle welcome | Old generated copy referenced outdated Hub positioning | Copy fixed |
| Password reset | Supabase Auth | Recovery email | Supabase Auth | Secure recovery email | Must not migrate token generation to Resend without `generateLink` flow | Unchanged |
| Events | Neon | Event registration/payment/reminder emails | Neon | Neon event emails only | Intentional Neon dependency | Unchanged |

## Migrated Or Confirmed Resend Triggers

- `neon-climate-survey`: sends `survey-thank-you` through Resend and passes the verified membership result into the template.
- `camp-gpe-action-network-ingest`: sends `action-network-petition-thank-you` through Resend.
- `action-network-completion-bridge`: sends `action-network-petition-thank-you` through Resend.
- `gpe-grad-highlight-submit`: sends `graduate-highlight-submission` through Resend.
- `camp-gpe-submit`: sends `camp-gpe-submission` through Resend.
- `gpe-membership-enroll`: sends `member-welcome` through the shared finalizer after membership creation.
- `gpe-donation-intake`: now sends `donation-confirmation` through Resend.

## Remaining Dependencies And Blockers

- Neon event emails remain the only intentionally active Neon email family in this phase.
- Neon financial receipts may still be required where Neon is the donation/payment system of record.
- The Neon dashboard should disable or avoid importing generic membership/account confirmation emails for non-event form flows to prevent duplicate messages.
- Action Network dashboard emails should be reviewed so Action Network does not send a second branded petition thank-you.
- Live production tests require deployed Edge Functions, controlled unique test emails, and Resend/Neon/Supabase Auth production access.

## Required Live Test Evidence

Record these after production deployment:

| Test | Required Evidence |
| --- | --- |
| Survey only | Submission ID, Resend `survey-thank-you` message ID, no Neon membership ID, no member welcome delivery |
| Survey + membership | Submission ID, Neon account ID, Neon membership ID, Resend survey message ID, Resend member-welcome message ID, Supabase Auth invite result only if no Hub profile exists |
| Existing member survey | Submission ID, existing Neon membership proof, Resend survey message ID, no new member-welcome delivery |
| Membership failure | Submission ID, failure status, Resend survey message ID, no member welcome, no Hub access claim |
| Action Network petition | Lead action ID, point/pending-point result, Resend petition message ID, no outdated Hub copy |
| Become a Member | Submission ID, Neon account ID, Neon membership ID, Resend member-welcome message ID, Supabase Auth invite result when required |
