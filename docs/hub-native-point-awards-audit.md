# Hub-Native Point Awards Audit

Date: 2026-07-30
Updated: 2026-08-04

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

## Production Incident Trace: Hub Job Submit 400

Date: 2026-08-04

Root cause: production `hub-listing-submit` reached the correct Edge Function, but inserting a pending Job listing fired the legacy `listings_award_job_points` insert trigger. That trigger attempted the obsolete `job_submission` point award before moderation review and raised PostgreSQL `P0001` with message `Not authorized to award Hub points.` The frontend was using `supabase.functions.invoke`, so the UI collapsed the detailed function response into the generic message `Edge Function returned a non-2xx status code`.

Captured failing production response before code changes:

| Field | Value |
| --- | --- |
| Function | `hub-listing-submit` |
| QA member profile/user | `ab01bc42-d251-4b61-8a3a-3ddb508eb200`, `gpe-smoke+hub-listing-20260804@girlplusenvironment.org` |
| HTTP status | `400` |
| Supabase request id | `019fcd7b-81b1-7c79-aa38-92f37ccb1998` |
| PostgreSQL code | `P0001` |
| PostgreSQL message | `Not authorized to award Hub points.` |
| PostgreSQL details | `null` |
| PostgreSQL hint | `null` |

Fixes applied:

| Area | Change |
| --- | --- |
| Database | Dropped `listings_award_job_points`; disabled legacy `job_submission` rule whose metadata source was `listing_insert_trigger`; recorded migration `20260804155451_disable_legacy_listing_insert_points_trigger.sql`. |
| Edge Function | `hub-listing-submit` now writes `moderation_status = pending_review`; `hub-listing-review` writes `moderation_status = published` or `rejected`. |
| Frontend | Hub function calls now use `fetch` with the authenticated session so non-2xx JSON response bodies, codes, details, and hints are preserved in the visible error message. |
| Listing queries | Explore/category/favorites listing queries now require `status = published`, so pending review rows do not appear in Explore. |
| Submit payloads | Job, Resource, and Funding forms send blank optional strings as `null` rather than omitted/undefined values. |

Production verification:

| Check | Result |
| --- | --- |
| Job submit after DB fix | `200`; listing `2a7ea2a0-d7fa-4edd-ba2b-e44fbb789f54`; submission `f827965a-392b-4c74-a89b-a6f1cbda1164`; lead action `a4c5bf4b-87d8-4d75-8a9b-9897ae9ce4fd`. |
| Resource submit shared function | `200`; listing `b7580f2d-7560-4be6-9083-a4541a232ded`; submission `97aac2a2-dad9-40a9-bb53-6676b9ae3299`; lead action `7534bf2a-5188-4901-86ad-d9d016e2d548`. |
| Funding submit shared function | `200`; listing `4f07821a-cd28-4cd3-a2e4-1fd8df255099`; submission `74939334-07a0-44f9-88c6-a05d1c76836e`; lead action `d6723bf4-e5e6-41bb-a7a8-647637466c76`. |
| Duplicate submit retry | Same idempotency keys returned `duplicate: true` with the same listing IDs for Job, Resource, and Funding. |
| Fresh deployed-function Job submit | `200`; listing `0420b1db-6118-4a3a-8b88-143e3ad6d74a`; submission `b18d4d9c-5c96-4968-899a-9532627ac096`; lead action `a43d9b7f-c41f-47a1-80a8-9ef7f507c002`; `status = pending_review`; `moderation_status = pending_review`; point events before approval: `0`. |
| Approval through `hub-listing-review` | Admin `851e2061-fa88-47e4-a346-80e3ef31c475`; `200`; point event `94ad42ea-ec93-4cfe-86f6-f4309a0cfca8`; point transaction `49d37842-e4b9-44bb-a2a2-fbe0e1e1b3a1`; awarded `20` points with rule `job_approved`. |
| Approval retry | `200`; returned the same point event `94ad42ea-ec93-4cfe-86f6-f4309a0cfca8` and transaction `49d37842-e4b9-44bb-a2a2-fbe0e1e1b3a1`; no duplicate points. |
| Route check | `/submit/` must be rechecked after the GitHub Pages frontend deploy completes. |

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
