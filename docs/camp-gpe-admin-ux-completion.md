# Camp GPE Admin UX Completion Sprint

## Release Gate

Camp GPE is administratively complete when staff can manage challenge publishing, schedule dates, moderation, points, and global season settings without editing Supabase directly.

## Verified Frontend Screenshots

Screenshots were captured from the local admin UI on July 27, 2026 using sanitized Playwright admin stubs. The captures do not include real member emails, tokens, API keys, private URLs, or full production identifiers.

- [Admin Hub](screenshots/camp-admin/01-admin-hub.png)
- [Challenge Management](screenshots/camp-admin/02-challenge-management.png)
- [Challenge editor, Overview](screenshots/camp-admin/03-challenge-editor-overview.png)
- [Challenge editor, Content](screenshots/camp-admin/04-challenge-editor-content.png)
- [Challenge editor, Schedule](screenshots/camp-admin/05-challenge-editor-schedule.png)
- [Challenge editor, Rewards](screenshots/camp-admin/06-challenge-editor-rewards.png)
- [Challenge editor, Submission](screenshots/camp-admin/07-challenge-editor-submission.png)
- [Challenge editor, Resources](screenshots/camp-admin/08-challenge-editor-resources.png)
- [Challenge editor, Notifications](screenshots/camp-admin/09-challenge-editor-notifications.png)
- [Challenge editor, History](screenshots/camp-admin/09b-challenge-editor-history.png)
- [Schedule Timeline](screenshots/camp-admin/10-schedule-timeline.png)
- [Schedule Calendar](screenshots/camp-admin/11-schedule-calendar.png)
- [Schedule List](screenshots/camp-admin/12-schedule-list.png)
- [Submission Review](screenshots/camp-admin/13-submission-review.png)
- [Moderation queues](screenshots/camp-admin/14-moderation-queues.png)
- [Global Camp Settings](screenshots/camp-admin/17-global-camp-settings.png)
- [Backend verification summary](screenshots/camp-admin/20-backend-verification.png)

## Backend Verification

Remote Supabase verification on July 27, 2026 confirmed:

- `20260727234500_camp_admin_moderation_audit` is marked applied in migration history.
- `public.moderation_audit_log` exists.
- `public.camp_admin_moderation_action` exists.
- `authenticated` has `SELECT` and `INSERT` grants on `public.moderation_audit_log`; RLS limits access to admins.
- Moderation state columns exist on `posts`, `post_comments`, and `listings`.
- `profiles.moderation_status` and `profiles.moderation_metadata` exist for warning and suspension persistence.

## Completion Notes

- Challenge lifecycle actions persist through the shared challenge API.
- Publishing or replacing a live challenge pauses other active challenges first.
- Paused and archived challenges are hidden from member-facing challenge/listing/post surfaces as applicable.
- Duplicate challenge creates a draft copy with a new slug and does not copy submissions, points, or analytics.
- Schedule Timeline, Calendar, and List now have distinct utility, including status, current/upcoming badges, conflicts, gaps, sorting, filtering, direct lifecycle actions, and persisted date editing.
- Moderation queues show real post, comment, listing, and report content with persisted hide, restore, remove, resolve, dismiss, warn, suspend, and profile actions where supported.
- Every moderation action records moderator, action, target type, target ID, reason, previous state, new state, and timestamp.
- Global Camp Settings validates title, date order, URLs, featured challenge, visibility, active-season date consistency, hero image, and banner URL length.
- Global Camp Settings supports Save Draft, Preview, Publish Changes, and browser unsaved-change warnings.
- Cabin persistence remains intentionally outside this sprint and should stay tracked as its own backend project.

## Verification Commands

- `npm run typecheck`
- `npm run build`
- `npm run test:e2e` - 50 passed, 1 skipped
- Supabase schema/RPC/grant verification queries passed after the migration was applied.
