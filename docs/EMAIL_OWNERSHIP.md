# Email Ownership Audit

Last audited: 2026-07-29

## Ownership Rules

| Provider | Should own | Should not own |
| --- | --- | --- |
| Neon CRM | Emails directly generated from Neon CRM records, including membership transactions, renewals, donation receipts, recurring donation notices, event registrations, waitlists, refunds, purchases, and volunteer confirmations | Hub lifecycle, Hub points, Hub badges, Hub onboarding, password resets |
| Supabase Auth | Required account security flows, including signup confirmation, invite, magic link, OTP, reset password, email change, and reauthentication | Marketing, newsletters, points, challenges, donor journeys, event follow-up content |
| Resend via Edge Functions | Hub lifecycle emails, public action follow-up, Hub onboarding, pending points, points earned, challenge completion, friend referrals, post-event Hub follow-up, digests, reminders, and nonmember membership notices | Financial receipts, Neon event payment notices, required Auth links |
| Action Network | Provider-native petition confirmation and advocacy emails configured in Action Network | Hub points, Hub membership status, Hub account activation |

## Current Ownership Findings

| Email area | Current owner | Recommended owner | Finding |
| --- | --- | --- | --- |
| Hub signup confirmation | Supabase Auth | Supabase Auth | Correct. Leave untouched. |
| Hub password reset | Supabase Auth | Supabase Auth | Correct. Leave untouched. |
| Existing Neon member Hub access | Supabase Auth through `hub-account-activation` | Supabase Auth for secure link, Resend optional follow-up only | Current secure-link owner is correct. The Resend `existing-member-hub-invite` template should not replace the Auth invite unless it carries or links to a secure Auth-generated URL. |
| Membership transaction confirmation | Neon CRM | Neon CRM | Correct. Generated Neon shell still needs exact Neon tokens. |
| Member welcome follow-up | Not confirmed | Resend | Template exists. Needs trigger after Neon membership confirmation and idempotency by membership term. |
| Donation receipts | Neon CRM | Neon CRM | Correct. Do not move receipts to Resend. |
| Donor lifecycle follow-up | Not implemented | Resend | Missing from current Resend catalog. Add only after receipt ownership stays in Neon. |
| Event registration/reminder/payment/refund | Neon CRM | Neon CRM | Correct. Generated Neon shells need token mapping. |
| Post-event Hub follow-up | Not confirmed | Resend | Template exists. Needs attendance-sync trigger and Neon mapping. |
| Petition provider confirmation | Action Network | Action Network | Correct when configured externally. Hub should separately display and optionally email point status. |
| Petition public action follow-up | Not confirmed | Resend | Template exists. Needs verified action trigger and opt-out rule. |
| Pending points | Not confirmed | Resend | Template exists. Needs trigger when `gpe_pending_point_awards` row is created. |
| Points earned | Not confirmed | Resend | Template exists. Needs point-event policy to avoid emailing every tiny action. |
| Challenge completed | Not confirmed | Resend | Template exists. Needs challenge completion trigger. |
| Contact staff notification | Resend | Resend | Correct as operational staff email. |
| Newsletter | Not found in repo | Resend or email campaign tool | Not implemented in repo. |

## Ownership Risks

1. Duplicate welcomes are possible if Neon sends a membership confirmation and Resend sends a member welcome without clear trigger boundaries.
2. Supabase Auth invite/recovery emails must remain the source of secure account links unless a future Resend implementation uses server-generated Auth links safely.
3. Neon templates cannot be safely published from repo placeholders. The live Neon editor is the source of truth for merge tags.
4. Resend lifecycle sends require preference and suppression handling. `gpe-lifecycle-email-send` already has those checks, but caller events need categories and idempotency keys.

