# Email Variables Audit

Last audited: 2026-07-29

## Supabase Auth Variables

Supabase Auth templates must stay owned by Supabase Auth. Do not replace them during lifecycle email work.

| Template | Variables observed or expected | Notes |
| --- | --- | --- |
| Confirm signup | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}` | Triggered by `supabase.auth.signUp` and resend confirmation. Template source not file-backed except dashboard/default. |
| Invite user | `{{ .ConfirmationURL }}` | File-backed in `supabase/templates/invite.html`. Triggered by `/auth/v1/invite`. |
| Reset password | `{{ .ConfirmationURL }}` | File-backed in `supabase/templates/recovery.html`. Triggered by `resetPasswordForEmail` and `/auth/v1/recover`. |
| Magic link | `{{ .ConfirmationURL }}` or OTP token variables | No active app flow found. |
| OTP | `{{ .Token }}`, `{{ .Email }}` | No active app flow found. |
| Change email | `{{ .ConfirmationURL }}`, `{{ .Email }}` | No active app flow found. |
| Reauthentication | `{{ .Token }}` | No active app flow found. |

## Resend Lifecycle Variables

Source: `emails/shared/resend-templates.mjs`.

| Template key | Required variables | Idempotency key |
| --- | --- | --- |
| `public-action-follow-up` | `firstName`, `actionName`, `takeActionUrl`, `communityResourcesUrl`, `joinHubUrl`, `inviteUrl` | `public-action-follow-up:{source_type}:{source_id}` |
| `member-welcome` | `firstName`, `hubUrl`, `invitePageUrl`, `membershipId`, `membershipTermId` | `member-welcome:{membership_term_id}` |
| `existing-member-hub-invite` | `firstName`, `email`, `hubInviteUrl` | `existing-member-hub-invite:{neon_account_id}:{recipient_email}` |
| `hub-user-nonmember` | `firstName`, `membershipUrl`, `membershipHelpUrl` | `hub-user-nonmember:{user_id}:{cooldown_window}` |
| `hub-activated` | `firstName`, `hubUrl` | `hub-activated:{user_id}` |
| `pending-points` | `points`, `actionName`, `claimUrl`, `recipientEmail`, `pendingAwardId` | `pending-points:{pending_award_id}` |
| `points-earned` | `points`, `actionName`, `totalPoints`, `pointsUrl`, `nextActionUrl`, `pointEventId` | `points-earned:{point_event_id}` |
| `challenge-completed` | `challengeTitle`, `points`, `totalPoints`, `nextChallengeUrl`, `cabinRank`, `personalRank`, `submissionId` | `challenge-completed:{submission_id}` |
| `invite-friend` | `inviterName`, `personalNote`, `inviteLandingUrl`, `invitationId` | `invite-friend:{invitation_id}` |
| `invited-friend-joined` | `friendFirstName`, `inviterFirstName`, `hubUrl`, `invitationId`, `joinedUserId` | `invited-friend-joined:{invitation_id}:{joined_user_id}` |
| `post-event-follow-up` | `eventName`, `firstName`, `discussionUrl`, `points`, `eventId`, `attendeeId` | `post-event-follow-up:{event_id}:{attendee_id}` |

## Central URL Variables

Source: `emails/shared/email-tokens.mjs`.

| Variable | Current value |
| --- | --- |
| `takeActionUrl` | `https://www.girlplusenvironment.org/take-action` |
| `communityResourcesUrl` | `https://www.girlplusenvironment.org/resources` |
| `hubUrl` | `https://members.girlplusenvironment.org` |
| `membershipUrl` | `https://www.girlplusenvironment.org/become-a-member` |
| `invitePageUrl` | `TBD_INVITE_PAGE_URL` |
| `membershipHelpUrl` | `TBD_MEMBERSHIP_HELP_URL` |
| `pointsUrl` | `https://members.girlplusenvironment.org/leaderboard` |
| `supportUrl` | `TBD_SUPPORT_URL` |
| `preferencesUrl` | `TBD_EMAIL_PREFERENCES_URL` |
| `websiteUrl` | `https://www.girlplusenvironment.org` |

## Neon Variables

Neon templates intentionally use bracket placeholders. These are not real merge tags.

Common placeholder groups:

- Account: `[[NEON_FIRST_NAME_TOKEN]]`, `[[NEON_ACCOUNT_CONFIRMATION_BLOCK]]`
- Membership: `[[NEON_MEMBERSHIP_DETAILS_BLOCK]]`, `[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]`, `[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]`, `[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]`
- Events: `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_EVENT_DETAILS_BLOCK]]`, `[[NEON_EVENT_REGISTRATION_URL_TOKEN]]`, `[[NEON_EVENT_PAYMENT_URL_TOKEN]]`, `[[NEON_EVENT_LINK_TOKEN]]`
- Donation and finance: `[[NEON_RECEIPT_BLOCK]]`, `[[NEON_TRANSACTION_ID_TOKEN]]`, `[[NEON_DONATION_PAYMENT_URL_TOKEN]]`, `[[NEON_RECURRING_SCHEDULE_BLOCK]]`, `[[NEON_PAYMENT_UPDATE_URL_TOKEN]]`, `[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]`
- Volunteers: `[[NEON_VOLUNTEER_FORM_DETAILS_BLOCK]]`

Before any Neon publish, paste each current Neon email into review, copy its exact merge tags, then replace placeholders one template at a time.

## TypeScript Interface Recommendation

The repo has `emails/shared/email-types.mjs`, but no compiled TypeScript interface layer for callers was found. A future implementation should add a typed map like this before wiring triggers:

```ts
export type LifecycleTemplatePayloads = {
  "public-action-follow-up": {
    firstName: string;
    actionName: string;
    takeActionUrl: string;
    communityResourcesUrl: string;
    joinHubUrl: string;
    inviteUrl: string;
  };
  "pending-points": {
    points: string;
    actionName: string;
    claimUrl: string;
    recipientEmail: string;
    pendingAwardId: string;
  };
};
```

