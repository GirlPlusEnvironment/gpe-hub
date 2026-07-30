# Hub-Native Point Awards Audit

Date: 2026-07-30

Scope: Hub-native actions that appear to earn points or feed the moderation/reward system. This audit separates verified backend point events from UI-only point language.

## Summary

Hub-native listing submissions for resources, jobs, funding opportunities, and community events were only creating `listings` rows with `pending_review`. They did not create a form submission, lead action, point event, pending award, or approval-time ledger transaction.

This update adds a shared Hub listing submission path:

Hub listing form -> `hub-listing-submit` Edge Function -> `gpe_form_submissions` -> `lead_actions` -> listing review metadata -> admin approval via `hub-listing-review` -> `service_record_point_event(...)` -> `gpe_point_events` -> `point_transactions` -> `profiles.points` -> leaderboard queries.

Content points are not awarded at submission time. The UI now says the submission is under review and shows the suggested point amount only as conditional language.

## Point Rules Added

| Rule Key | Event Type | Points | Review Required | Notes |
| --- | --- | ---: | --- | --- |
| `resource_approved` | `RESOURCE_APPROVED` | 20 | Yes | Awarded after Team GPE approves a resource. |
| `job_approved` | `JOB_APPROVED` | 20 | Yes | Awarded after Team GPE approves a job listing. |
| `opportunity_approved` | `OPPORTUNITY_APPROVED` | 20 | Yes | Awarded after Team GPE approves a funding opportunity. |
| `event_submitted` | `EVENT_SUBMITTED` | 15 | Yes | Awarded after Team GPE approves a community event. |
| `member_invited` | `MEMBER_INVITED` | 5 | No | Rule added; invite flow still needs to call the point service after authenticated invite send. |
| `profile_completed` | `PROFILE_COMPLETED` | 15 | No | Rule added; profile save flow still needs a completion detector/idempotency source. |
| `community_post_created` | `COMMUNITY_POST_CREATED` | 0 | Yes | Placeholder disabled pending rule decision. |
| `comment_created` | `COMMENT_CREATED` | 0 | Yes | Placeholder disabled pending rule decision. |

The migration also adds `requires_review` to `gpe_action_points_status`.

## Hub Action Audit

| Hub Action | Frontend Route | Backend Function | Event Type | Points | Review Required | Idempotent | Leaderboard Updated | Status |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| Resource submission | `/submit/resource` | `hub-listing-submit`, `hub-listing-review` | `RESOURCE_APPROVED` | 20 | Yes | Yes, via form submission id/listing id | Yes after approval | Deployed; needs live member/admin test |
| Job upload | `/submit/job` | `hub-listing-submit`, `hub-listing-review` | `JOB_APPROVED` | 20 | Yes | Yes, via form submission id/listing id | Yes after approval | Deployed; needs live member/admin test |
| Funding opportunity submission | `/submit/funding` | `hub-listing-submit`, `hub-listing-review` | `OPPORTUNITY_APPROVED` | 20 | Yes | Yes, via form submission id/listing id | Yes after approval | Deployed; needs live member/admin test |
| Event submission | `/submit/event` | `hub-listing-submit`, `hub-listing-review` | `EVENT_SUBMITTED` | 15 | Yes | Yes, via form submission id/listing id | Yes after approval | Deployed; needs live member/admin test |
| Camp challenge submission | `/camp-gpe/challenges/:slug/submit` | `camp-gpe-challenge-submit` | Camp challenge actions | Challenge value | Challenge config dependent | Existing duplicate checks | Yes after approved ledger | Working |
| Embedded Camp submission | `/camp-gpe/challenges/:slug` | `camp-gpe-challenge-submit` in modal iframe | Camp challenge actions | Challenge value | Challenge config dependent | Existing duplicate checks | Refreshes page data after modal success | Working in repo |
| Petition completion | external/Action Network bridge | `action-network-completion-bridge`, `camp-gpe-action-network-ingest` | `PETITION_SUBMITTED`, camp petition event | Rule driven | No for mapped petition; Camp may require challenge context | Yes, source/signature based | Yes when linked; pending award when identity missing | Working |
| Grad Highlight submission | external form path | `gpe-grad-highlight-submit` | `grad_highlight_submission` | 50 | No point review; moderation separate | Yes, form submission based | Yes when linked | Working |
| Invite a member | `/invite` | `hub-invitation-request` | `MEMBER_INVITED` | 5 | No | Yes, via invitation id | Yes after point service award | Deployed; needs live invite test |
| Profile completion | `/profile` | direct profile update | `PROFILE_COMPLETED` | 15 | No | Needs completion source id/version | Not yet | Missing |
| Community post | `/community` | direct post insert + legacy `award_hub_action_points` attempt | `COMMUNITY_POST_CREATED` | TBD | Needs rule decision | Partially, post id | Legacy path disabled by rules | Needs rule decision |
| Comment/reply | `/community`, `/post/:id` | direct comment insert + legacy `award_hub_action_points` attempt | `COMMENT_CREATED` | TBD | Needs rule decision | Partially, comment id | Legacy path disabled by rules | Needs rule decision |
| Story submission | Grad Highlight path or future Hub story flow | `gpe-grad-highlight-submit` for Grad Highlight | `STORY_SUBMITTED` / `STORY_APPROVED` | TBD | Depends on story surface | Existing external form idempotency | Existing Grad path only | Partially working |
| Mentor/resource recommendation | Resource submission route | `hub-listing-submit`, `hub-listing-review` | `RESOURCE_APPROVED` | 20 | Yes | Yes | Yes after approval | Covered when submitted as resource |
| Opportunity upload | Funding route | `hub-listing-submit`, `hub-listing-review` | `OPPORTUNITY_APPROVED` | 20 | Yes | Yes | Yes after approval | Covered |
| First login/onboarding completion | Login/onboarding/profile flow | None found | none | TBD | No | No | No | Missing |
| Listing favorite | Listing detail/favorites | legacy `award_hub_action_points` | `listing_favorite` | 0/disabled | No | Favorite id | No | Disabled intentionally |

## Resource and Job Trace

Before:

form submit -> direct `listings` insert -> `status = pending_review` -> toast says under review.

After:

form submit -> `hub-listing-submit` -> `gpe_form_submissions` with stable idempotency key -> `listings` row with `hub_action_review` metadata -> `lead_actions` with `points_status = requires_review` -> admin approval -> `hub-listing-review` -> active membership check -> `service_record_point_event(...)` -> point event/ledger/profile total.

If the submitter does not have an active membership at approval time, the review stores `pending_membership` and does not call the point service, because `service_record_point_event(...)` awards immediately when a Hub `profile_id` is present.

## Validation Checklist

Repository validation run:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with 3 existing React hook dependency warnings in Camp pages |
| `npm run build` | Passed |
| Production points migration | Applied and repaired as `20260730162652` |
| `hub-listing-submit` endpoint | Deployed and returns auth-gated response |
| `hub-listing-review` endpoint | Deployed and returns auth-gated response |

Live production tests were not run in this pass. They require an authenticated test member profile, an admin reviewer account, and a cleanup/reversal plan for test point transactions.

## Controlled Test Plan

| Test | Required Records |
| --- | --- |
| Resource submission | listing id, form submission id, lead action id, points before/after |
| Resource approval | review metadata, point event id, point transaction id, leaderboard before/after |
| Job upload | listing id, form submission id, lead action id, points before/after |
| Job approval | review metadata, point event id, point transaction id, leaderboard before/after |
| Embedded Camp submission | challenge submission id, action id, review status, leaderboard refresh |
| Invite a member | invite id, point event id after invite flow is wired |
| Profile completion | profile id/version, point event id after completion detector is wired |
| Duplicate replay | same idempotency key/source id returns duplicate/no extra transaction |

## Remaining Work

Deploy sequence:

1. Deploy the Hub build that calls the new functions.
2. Run controlled tests with a dedicated member profile and admin reviewer.
3. Add a profile-completion detector.
4. Decide whether community posts/comments should award points, require moderation, or remain disabled.

Supabase note: because Supabase changed defaults around new public tables and Data API exposure, verify explicit grants/RLS any time a new table is introduced. This change does not create new tables, but the same deployment checklist should still be used for future point-review tables.
