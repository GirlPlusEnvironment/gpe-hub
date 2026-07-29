# Email Inventory

Last audited: 2026-07-29

Status meanings:

- Production: send path is wired in this repo or owned externally.
- Draft template: template files exist but need trigger, token, or review work.
- Missing trigger: template exists, but no confirmed backend caller was found.
- External unknown: provider owns the email, but active dashboard state cannot be verified from this repo.

## Supabase Auth

| Email | Trigger | Sender | Current template | Dynamic fields | Status |
| --- | --- | --- | --- | --- | --- |
| Confirm signup | `supabase.auth.signUp` | Supabase Auth | Dashboard/default or remote Auth config | `{{ .ConfirmationURL }}`, `{{ .Email }}` | Production, do not overwrite |
| Resend signup confirmation | `supabase.auth.resend({ type: "signup" })` | Supabase Auth | Same as confirm signup | `{{ .ConfirmationURL }}`, `{{ .Email }}` | Production, do not overwrite |
| Invite user | `/auth/v1/invite` in `hub-account-activation` | Supabase Auth | `supabase/templates/invite.html` | `{{ .ConfirmationURL }}` | Production, do not overwrite |
| Password reset | `supabase.auth.resetPasswordForEmail` and `/auth/v1/recover` | Supabase Auth | `supabase/templates/recovery.html` | `{{ .ConfirmationURL }}` | Production, do not overwrite |
| Magic link | Supabase Auth OTP flow if enabled | Supabase Auth | Dashboard/default | `{{ .ConfirmationURL }}` or token fields | Not found as active app flow |
| OTP | Supabase Auth OTP flow if enabled | Supabase Auth | Dashboard/default | `{{ .Token }}`, `{{ .Email }}` | Not found as active app flow |
| Change email | Supabase email-change flow | Supabase Auth | Dashboard/default | `{{ .ConfirmationURL }}`, `{{ .Email }}` | No active app trigger found |
| Reauthentication | Supabase reauth flow | Supabase Auth | Dashboard/default | `{{ .Token }}` | No active app trigger found |

## Resend Lifecycle Templates

| Email | Trigger | Sender | Current template | Dynamic fields | Status |
| --- | --- | --- | --- | --- | --- |
| Public action follow-up | Eligible public action by nonmember | Resend via `gpe-lifecycle-email-send` | `emails/resend/public-action-follow-up.html` | `firstName`, `actionName`, `takeActionUrl`, `communityResourcesUrl`, `joinHubUrl`, `inviteUrl` | Draft template, missing trigger |
| Member welcome | Neon confirms active membership | Resend via `gpe-lifecycle-email-send` | `emails/resend/member-welcome.html` | `firstName`, `hubUrl`, `invitePageUrl`, `membershipId`, `membershipTermId` | Wired for Become a Member; other membership creation paths need trigger review |
| Existing member Hub invite | Active Neon member lacks Hub account | Resend or Supabase Auth invite flow | `emails/resend/existing-member-hub-invite.html` | `firstName`, `email`, `hubInviteUrl` | Draft template, current actual invite uses Supabase Auth |
| Hub user nonmember | Hub account exists, Neon membership inactive | Resend via `gpe-lifecycle-email-send` | `emails/resend/hub-user-nonmember.html` | `firstName`, `membershipUrl`, `membershipHelpUrl` | Draft template, missing trigger |
| Hub activated | First Hub activation | Resend via `gpe-lifecycle-email-send` | `emails/resend/hub-activated.html` | `firstName`, `hubUrl` | Draft template, missing trigger |
| Pending points | Verified action earns unclaimed points | Resend via `gpe-lifecycle-email-send` | `emails/resend/pending-points.html` | `points`, `actionName`, `claimUrl`, `recipientEmail`, `pendingAwardId` | Draft template, missing trigger |
| Points earned | Significant point event | Resend via `gpe-lifecycle-email-send` | `emails/resend/points-earned.html` | `points`, `actionName`, `totalPoints`, `pointsUrl`, `nextActionUrl`, `pointEventId` | Draft template, missing trigger |
| Challenge completed | Challenge approved or auto-verified | Resend via `gpe-lifecycle-email-send` | `emails/resend/challenge-completed.html` | `challengeTitle`, `points`, `totalPoints`, `nextChallengeUrl`, `cabinRank`, `personalRank`, `submissionId` | Draft template, missing trigger |
| Friend invitation | Signed-in member invites someone | Resend via `gpe-lifecycle-email-send` | `emails/resend/invite-friend.html` | `inviterName`, `personalNote`, `inviteLandingUrl`, `invitationId` | Draft template, needs URL and trigger |
| Invited friend joined | Invite recipient joins | Resend via `gpe-lifecycle-email-send` | `emails/resend/invited-friend-joined.html` | `friendFirstName`, `inviterFirstName`, `hubUrl`, `invitationId`, `joinedUserId` | Draft template, missing trigger |
| Post-event Hub follow-up | Neon event attendance synced | Resend via `gpe-lifecycle-email-send` | `emails/resend/post-event-follow-up.html` | `eventName`, `firstName`, `discussionUrl`, `points`, `eventId`, `attendeeId` | Draft template, needs Neon mapping and trigger |
| Action Network petition thank you | Action Network bridge completion | Resend via `gpe-lifecycle-email-send` | `emails/resend/action-network-petition-thank-you.html` | `firstName`, `petitionName`, `campaignName`, `awardedPoints`, `pendingPoints`, `hubUrl` | Wired |
| Grad Highlight submission | Grad Highlight saved | Resend via `gpe-lifecycle-email-send` | `emails/resend/graduate-highlight-submission.html` | `firstName`, `hubUrl`, `communityResourcesUrl` | Wired |
| Survey thank you | Climate survey submitted | Resend via `gpe-lifecycle-email-send` | `emails/resend/survey-thank-you.html` | `firstName`, `surveyName`, `communityResourcesUrl`, `hubUrl` | Wired |
| Camp GPE submission | Camp registration submitted | Resend via `gpe-lifecycle-email-send` | `emails/resend/camp-gpe-submission.html` | `firstName`, `submissionName`, `campUrl` | Wired |

## Other Resend Email

| Email | Trigger | Sender | Current template | Dynamic fields | Status |
| --- | --- | --- | --- | --- | --- |
| Contact staff notification | Website contact form submitted | Resend through `_shared/email.ts` | Built in `gpe-contact-submit` | contact fields, source page, submission ID, sync status | Production code path |

## Neon CRM Templates

| Email | Trigger | Sender | Current template | Dynamic fields | Status |
| --- | --- | --- | --- | --- | --- |
| Account confirmation | Neon account form confirmation | Neon CRM | `emails/neon/account/account-confirmation.html` | `[[NEON_ACCOUNT_CONFIRMATION_BLOCK]]` and copied Neon tokens | Draft shell, external unknown |
| Membership registration | Membership purchased or created | Neon CRM | `emails/neon/membership/membership-registration.html` | first name, membership details, account URL | Draft shell, needs tokens |
| Membership registration pay later | Membership registration awaiting payment | Neon CRM | `emails/neon/membership/membership-registration-pay-later.html` | payment details, payment URL | Draft shell, needs tokens |
| Membership renewal | Membership renewed | Neon CRM | `emails/neon/membership/membership-renewal.html` | membership details, account URL | Draft shell, needs tokens |
| Membership renewal pay later | Renewal awaiting payment | Neon CRM | `emails/neon/membership/membership-renewal-pay-later.html` | payment details, payment URL | Draft shell, needs tokens |
| Membership due | Renewal due | Neon CRM | `emails/neon/membership/membership-due.html` | renewal date, amount, renewal URL | Draft shell, needs tokens |
| Membership overdue | Renewal overdue | Neon CRM | `emails/neon/membership/membership-overdue.html` | overdue balance, due date, renewal URL | Draft shell, needs tokens |
| Membership auto-renewal enabled | Auto-renewal enabled | Neon CRM | `emails/neon/membership/membership-auto-renewal-enabled.html` | recurring schedule, account URL | Draft shell, needs tokens |
| Membership auto-renewal notice | Upcoming auto-renewal | Neon CRM | `emails/neon/membership/membership-auto-renewal-notice.html` | recurring schedule, account URL | Draft shell, needs tokens |
| Membership auto-renewal error | Auto-renewal failure | Neon CRM | `emails/neon/membership/membership-auto-renewal-error.html` | payment details, update payment URL | Draft shell, needs tokens |
| Event registration | Event registration confirmed | Neon CRM | `emails/neon/events/event-registration.html` | event name, event details, registration URL | Draft shell, needs tokens |
| Event registration pay later | Event registration awaiting payment | Neon CRM | `emails/neon/events/event-registration-pay-later.html` | event details, payment URL | Draft shell, needs tokens |
| Event reminder | Event reminder schedule | Neon CRM | `emails/neon/events/event-reminder.html` | event name, event details, event link | Draft shell, needs tokens |
| Waitlist confirmation | Event waitlist join | Neon CRM | `emails/neon/events/waitlist-confirmation.html` | event name, waitlist details | Draft shell, needs tokens |
| Notify me | Event notify-me request | Neon CRM | `emails/neon/events/notify-me.html` | event name, notify details | Draft shell, needs tokens |
| Attendee confirmation | Attendance confirmation | Neon CRM | `emails/neon/events/attendee-confirmation.html` | event name, attendance details | Draft shell, needs tokens |
| Attendee reminder | Attendee reminder | Neon CRM | `emails/neon/events/attendee-reminder.html` | event name, event details, event link | Draft shell, needs tokens |
| Event refund release | Event refund processed | Neon CRM | `emails/neon/events/refund-release.html` | refund details | Draft shell, needs tokens and legal review |
| Event exchange | Event registration exchange | Neon CRM | `emails/neon/events/exchange.html` | exchange details, registration URL | Draft shell, needs tokens |
| Donation appreciation | Donation receipt | Neon CRM | `emails/neon/donations/donation-appreciation.html` | receipt block, transaction ID | Draft shell, needs receipt review |
| Donation appreciation pay later | Donation pledge/payment pending | Neon CRM | `emails/neon/donations/donation-appreciation-pay-later.html` | receipt block, payment URL | Draft shell, needs tokens |
| Donation anniversary | Donation anniversary | Neon CRM | `emails/neon/donations/donation-anniversary.html` | anniversary details | Draft shell, needs tokens |
| Tribute acknowledgement | Tribute gift acknowledgement | Neon CRM | `emails/neon/donations/tribute-acknowledgement.html` | tribute details | Draft shell, needs tokens |
| Soft credit acknowledgement | Soft credit gift notice | Neon CRM | `emails/neon/donations/soft-credit-acknowledgement.html` | soft credit details | Draft shell, needs tokens |
| Matched donation acknowledgement | Gift matched | Neon CRM | `emails/neon/donations/matched-donation-acknowledgement.html` | matched donation details | Draft shell, needs tokens |
| Recurring created | Recurring donation schedule created | Neon CRM | `emails/neon/donations/recurring-created.html` | recurring schedule | Draft shell, needs tokens |
| Recurring updated | Recurring donation schedule updated | Neon CRM | `emails/neon/donations/recurring-updated.html` | recurring schedule | Draft shell, needs tokens |
| Recurring paused | Recurring donation schedule paused | Neon CRM | `emails/neon/donations/recurring-paused.html` | recurring schedule | Draft shell, needs tokens |
| Recurring cancelled | Recurring donation schedule cancelled | Neon CRM | `emails/neon/donations/recurring-cancelled.html` | recurring schedule | Draft shell, needs tokens |
| Recurring notice | Upcoming recurring donation | Neon CRM | `emails/neon/donations/recurring-notice.html` | recurring schedule | Draft shell, needs tokens |
| Recurring error | Recurring donation failed | Neon CRM | `emails/neon/donations/recurring-error.html` | recurring schedule, update payment URL | Draft shell, needs tokens |
| Pledge invoice | Pledge invoice | Neon CRM | `emails/neon/donations/pledge-invoice.html` | pledge details, payment URL | Draft shell, needs tokens |
| Pledge overdue | Pledge overdue | Neon CRM | `emails/neon/donations/pledge-overdue.html` | pledge details, payment URL | Draft shell, needs tokens |
| Purchase complete | Store purchase complete | Neon CRM | `emails/neon/purchases/purchase-complete.html` | purchase receipt | Draft shell, needs receipt review |
| Purchase refund | Store refund | Neon CRM | `emails/neon/purchases/refund.html` | refund details | Draft shell, needs legal review |
| Purchase exchange | Store exchange | Neon CRM | `emails/neon/purchases/exchange.html` | exchange details | Draft shell, needs tokens |
| Volunteer submitted | Volunteer form received | Neon CRM | `emails/neon/volunteers/volunteer-submitted.html` | volunteer form details | Draft shell, needs tokens |
