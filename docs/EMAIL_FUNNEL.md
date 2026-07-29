# Email Funnel Audit

Last audited: 2026-07-29

This document maps the intended communication journey and identifies which provider should own each message.

## Visitor To Advocacy

Visitor
-> Action Network petition
-> Action Network provider confirmation, if configured externally
-> Supabase records verified action
-> Resend public action follow-up for nonmembers
-> Resend points earned or pending points, when points are significant enough to notify
-> Hub signup or membership path

Current status: petition recording and points infrastructure exist. Public action follow-up and pending-points emails have templates but no confirmed trigger wiring.

## Visitor To Membership

Visitor
-> Become a Member form
-> Supabase Edge Function creates or matches Neon constituent
-> Neon membership created
-> Neon membership registration email
-> Supabase Auth Hub invite or recovery email
-> Resend member welcome follow-up
-> Pending points claimed
-> Resend hub activated email after first Hub activation

Current status: membership creation and Hub invitation handoff exist. Neon membership templates are draft shells needing Neon tokens. Resend member welcome and hub activated templates exist but triggers are not confirmed.

## Hub Authentication

Hub visitor
-> signup
-> Supabase Auth confirmation email
-> login
-> password reset when requested
-> Supabase Auth recovery email
-> password update

Current status: signup, resend confirmation, recovery, and update password are wired through Supabase Auth. Do not redesign these in this phase.

## Events

Visitor
-> Neon event listing or GPE event registration handoff
-> Neon event registration confirmation
-> Neon event reminders
-> Neon waitlist, payment, refund, exchange emails
-> Attendance synced
-> Supabase point event for `EVENT_ATTENDED`
-> Resend post-event Hub follow-up

Current status: `neon-event-register` records registration intent and emits a notification outbox row. It also calls point event logic for `EVENT_REGISTERED` when registered. Post-event follow-up template exists but needs Neon attendance mapping and trigger wiring.

## Donations

Donor
-> donation form or Neon checkout
-> Neon donation receipt or pay-later notice
-> Neon recurring donation notices
-> Neon pledge invoice, overdue, refund, tribute, soft credit, or matched gift emails
-> optional Resend donor lifecycle follow-up later

Current status: donation intake Edge Function exists, but Neon remains the correct owner for receipts and financial messages. No donor lifecycle Resend template is currently in the generated Resend catalog.

## Camp GPE

Participant
-> Camp registration
-> optional membership creation
-> Hub invitation when eligible
-> challenge submission
-> deterministic point award or review
-> leaderboard update
-> Resend challenge completed or points earned, when notification policy allows

Current status: Camp registration, challenge submission, ledger, and leaderboard code exist. Challenge-completed and points-earned templates exist, but email triggers are not confirmed.

## Grad Highlight And Survey

Submitter
-> public form submission
-> Neon constituent or survey sync
-> optional membership creation
-> Hub invite when eligible
-> point event if configured
-> Resend public action follow-up, pending points, points earned, or member welcome based on outcome

Current status: Grad Highlight and climate survey Edge Functions exist. Their membership and Hub handoff logic exists. Resend follow-up triggers are not confirmed.

## Volunteer

Volunteer
-> Neon volunteer form
-> Neon volunteer form confirmation
-> staff review
-> optional Resend lifecycle follow-up only when Hub-specific

Current status: Neon template shell exists for volunteer form submitted. Repo cannot verify active Neon dashboard state.

## Store Purchase

Buyer
-> Neon purchase
-> Neon purchase confirmation, refund, or exchange
-> optional Resend lifecycle follow-up only when Hub-specific

Current status: Neon template shells exist. Repo cannot verify active Neon dashboard state.

## Job Board And Resources

Member
-> submits or saves job/resource/funding
-> in-app confirmation
-> optional future Resend digest or admin moderation email

Current status: no repo email sender found for job/resource/funding submissions.

## Long-Term Membership

Active member
-> Hub activated
-> Camp or points notifications
-> newsletters or announcements
-> renewal due
-> renewal overdue
-> renewed
-> lapsed or winback

Current status: renewal-related emails belong to Neon. Newsletter, digest, inactive-member, and winback emails are not implemented in this repo.

