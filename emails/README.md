# Girl Plus Environment Hub Emails

This directory contains the non-Auth Resend lifecycle email catalog for the GPE Hub.

Supabase Auth templates are intentionally not generated or overwritten in this phase. The current Supabase templates for confirm signup, invite user, magic link or OTP, change email address, reset password, and reauthentication remain owned by Supabase Auth configuration.

## Ownership

Neon CRM sends event registration, event reminders, waitlist emails, event payment emails, refunds, event changes, donation receipts, recurring donation notices, membership payment receipts, and other Neon financial records.

Supabase Auth sends required account security emails.

Supabase Edge Functions plus Resend send Hub lifecycle emails after the relevant event is verified.

## Sender

`Girl Plus Environment Community Hub <support@gpecommunityhub.org>`

Reply-to is read from `GPE_EMAIL_REPLY_TO` when configured.

## Shared Copy

Use this exact Hub description when a full Hub description is needed:

`A playful mission board for environmental justice opportunities, seasonal challenges, community conversations, and member connection.`

Use this exact footer:

`We've got those good jobs, resources, funding + mentors for black + brown femmes in climate. This is our place to share and make space for each other to lead this climate and environmental justice movement.`

## Files

- `shared/email-layout.mjs`: table-based HTML renderer.
- `shared/email-tokens.mjs`: sender, footer, Hub description, and centralized URLs.
- `shared/resend-templates.mjs`: approved Resend lifecycle copy and metadata.
- `resend/*.html`: generated HTML templates.
- `plain-text/*.txt`: generated plain-text fallbacks.
- `previews/*.html`: generated local previews.

Run:

```bash
npm run emails:generate
```

## Resend Templates

| Template key | Trigger | Idempotency | Status |
| --- | --- | --- | --- |
| `public-action-follow-up` | Eligible public action by a nonmember | `public-action-follow-up:{source_type}:{source_id}` | ready, needs trigger, needs preference rule |
| `petition-thank-you` | Verified generic petition completion | `petition-thank-you:{source_type}:{source_id}` | ready, needs trigger, needs preference rule |
| `action-network-petition-thank-you` | Action Network bridge verifies petition completion | `action-network-petition-thank-you:{petition_slug}:{recipient_email}` | active through `action-network-completion-bridge` |
| `event-follow-up` | Public event follow-up | `event-follow-up:{event_id}:{recipient_email}` | ready, needs trigger, needs preference rule |
| `survey-thank-you` | Public survey submission accepted | `survey-thank-you:{submission_id}` | active through `neon-climate-survey` |
| `volunteer-interest` | Volunteer interest follow-up outside Neon confirmation | `volunteer-interest:{submission_id}` | ready, needs trigger, needs preference rule |
| `camp-gpe-submission` | Camp GPE registration or submission saved | `camp-gpe-submission:{submission_id}` | active through `camp-gpe-submit` |
| `graduate-highlight-submission` | Grad Highlight saved | `graduate-highlight-submission:{submission_id}` | active through `gpe-grad-highlight-submit` |
| `hub-welcome` | Hub account created or activated | `hub-welcome:{user_id}` | ready, needs trigger |
| `complete-your-profile` | Hub user profile incomplete | `complete-your-profile:{user_id}:{cooldown_window}` | ready, needs trigger, needs preference rule |
| `first-badge` | First badge earned | `first-badge:{user_id}:{badge_id}` | ready, needs trigger, needs preference rule |
| `member-welcome` | Neon confirms a new active membership | `member-welcome:{membership_term_id}` | active through `gpe-membership-enroll`; other membership paths need trigger review |
| `existing-member-hub-invite` | Active Neon member lacks linked Supabase Auth account | `existing-member-hub-invite:{neon_account_id}:{recipient_email}` | ready, needs trigger |
| `hub-user-nonmember` | Hub user has no active Neon membership | `hub-user-nonmember:{user_id}:{cooldown_window}` | ready, needs trigger, needs preference rule |
| `hub-activated` | User completes first Hub account activation | `hub-activated:{user_id}` | ready, needs trigger |
| `pending-points` | Verified action created pending points | `pending-points:{pending_award_id}` | ready, needs trigger, needs preference rule |
| `points-earned` | Significant verified point event | `points-earned:{point_event_id}` | ready, needs trigger, needs preference rule |
| `badge-unlocked` | Badge earned after first badge | `badge-unlocked:{user_id}:{badge_id}` | ready, needs trigger, needs preference rule |
| `challenge-completed` | Challenge is approved or automatically verified | `challenge-completed:{submission_id}` | ready, needs trigger, needs preference rule |
| `weekly-progress` | Weekly Hub progress summary | `weekly-progress:{user_id}:{week_start}` | ready, needs trigger, needs preference rule |
| `monthly-digest` | Monthly Hub digest | `monthly-digest:{recipient_email}:{month}` | ready, needs trigger, needs preference rule |
| `leaderboard-update` | Leaderboard milestone | `leaderboard-update:{user_id}:{leaderboard_window}` | ready, needs trigger, needs preference rule |
| `camp-reminder` | Camp GPE reminder | `camp-reminder:{season_id}:{recipient_email}:{reminder_key}` | ready, needs trigger, needs preference rule |
| `become-a-member` | Known contact or Hub user membership prompt | `become-a-member:{recipient_email}:{cooldown_window}` | ready, needs trigger, needs preference rule |
| `member-anniversary` | Member anniversary | `member-anniversary:{membership_id}:{anniversary_year}` | ready, needs trigger, needs preference rule |
| `renewal-reminder` | Hub-specific renewal reminder | `renewal-reminder:{membership_id}:{reminder_key}` | ready, needs trigger, needs preference rule |
| `win-back` | Lapsed member reactivation | `win-back:{recipient_email}:{campaign_id}` | ready, needs trigger, needs preference rule |
| `invite-friend` | Signed-in member submits friend invite form | `invite-friend:{invitation_id}` | ready, needs URL, needs trigger, needs preference rule |
| `invited-friend-joined` | Invited person joins | `invited-friend-joined:{invitation_id}:{joined_user_id}` | ready, needs trigger, needs preference rule |
| `post-event-follow-up` | Neon attendance is synced | `post-event-follow-up:{event_id}:{attendee_id}` | ready, needs trigger, needs Neon mapping, needs preference rule |
| `resource-released` | Resource released | `resource-released:{resource_id}:{recipient_email}` | ready, needs trigger, needs preference rule |
| `jobs-digest` | Jobs digest | `jobs-digest:{recipient_email}:{digest_window}` | ready, needs trigger, needs preference rule |
| `newsletter` | Newsletter or community announcement | `newsletter:{campaign_id}:{recipient_email}` | ready, needs trigger, needs preference rule |

## Variables

Variables are documented in `shared/resend-templates.mjs` on each template record. User-provided values must be sanitized before calling Resend. Personal invite notes must be plain text only.

## Centralized URLs

Known production URLs live in `shared/email-tokens.mjs`.

Current placeholders:

- `TBD_INVITE_PAGE_URL`
- `TBD_MEMBERSHIP_HELP_URL`
- `TBD_SUPPORT_URL`
- `TBD_EMAIL_PREFERENCES_URL`

Do not activate templates that depend on a placeholder URL.

## Delivery

The internal Edge Function is:

`supabase/functions/gpe-lifecycle-email-send`

It requires `GPE_EMAIL_SERVICE_SECRET`. It is not meant for browser calls.

Required request fields:

- `templateKey`
- `recipientEmail`
- `subject`
- `html`
- `text`
- `idempotencyKey`

Optional fields:

- `templateVersion`
- `recipientUserId`
- `neonAccountId`
- `eventType`
- `sourceType`
- `sourceId`
- `category`
- `variables`

The function writes to `gpe_email_deliveries`, checks `gpe_email_suppressions`, respects `gpe_email_preferences` for non-security categories, and sends through Resend with an idempotency header.

## Database Tracking

Migration:

`supabase/migrations/20260729153754_hub_lifecycle_email_tracking.sql`

It extends `gpe_notification_outbox` and adds:

- `gpe_email_deliveries`
- `gpe_email_preferences`
- `gpe_email_suppressions`

Tracked fields include template key, template version, recipient email, recipient user ID, Neon account ID, event type, source type, source ID, idempotency key, subject, variables, provider message ID, queued time, sent time, delivered time, bounced time, complaint time, failed time, error message, and retry count.

## Preferences

Required security emails are owned by Supabase Auth and must not be blocked by marketing preferences.

Nonessential Hub lifecycle emails must respect suppressions and relevant preferences before sending.

## Preview

Open:

`emails/previews/index.html`

Each preview includes desktop, narrow mobile, plain text, missing optional variables, long variable values, escaped HTML input, no personal note, no points, and no rank states.

## Supabase Auth Templates

Do not deploy or overwrite Supabase Auth templates from this directory in this phase.

Current Auth templates remain outside this Resend catalog. When Auth templates are updated later, deploy through Supabase Auth template configuration and test confirm signup, invite, recovery, change email, magic link, and reauthentication separately.

## Resend Deployment

For now, generated HTML and text are source-controlled artifacts. A sending workflow should load the selected template, render sanitized variables, and call `gpe-lifecycle-email-send`.

Safe test flow:

1. Use a non-production recipient you control.
2. Use a unique idempotency key.
3. Confirm a `gpe_email_deliveries` row is created.
4. Confirm Resend returns a provider message ID.
5. Confirm duplicate requests with the same idempotency key do not send twice.

Rollback:

1. Revert the template data in `shared/resend-templates.mjs`.
2. Run `npm run emails:generate`.
3. Redeploy only the affected sending function if a function embeds rendered output.
4. Leave historical `gpe_email_deliveries` rows intact.

## Do Not Activate Yet

Active lifecycle sends:

- `action-network-petition-thank-you`
- `survey-thank-you`
- `camp-gpe-submission`
- `graduate-highlight-submission`
- `member-welcome` from Become a Member only

Do not activate the remaining automations until their trigger, preference, and URL statuses are resolved:

- `public-action-follow-up`
- `hub-user-nonmember`
- `pending-points`
- `points-earned`
- `challenge-completed`
- `invite-friend`
- `invited-friend-joined`
- `post-event-follow-up`

`existing-member-hub-invite` and `hub-activated` are template-ready, but still need final trigger wiring and safe test confirmation before production activation.
