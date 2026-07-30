# GPE Production Readiness Launch Gate

Date: 2026-07-30

## Scope

This pass audited the Hub footer, Invite a Member, Submit for Points, Hub-native point infrastructure, deployed Supabase functions, and the major form lifecycle paths already documented in the membership/survey audits.

Rows below are not marked complete unless the production function and repository path were verified. Live end-to-end user tests still need controlled authenticated accounts and fresh external form submissions.

## Journey Status

| Journey | Neon Sync | Membership | Resend | Hub | Points | Leaderboard | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Become a Member | Verified function deployed | Shared finalizer deployed | Member welcome via Resend | Hub invite/finalizer deployed | N/A | N/A | Needs fresh live test IDs |
| Climate Survey | Function deployed; Wix publish still needs proof | Shared finalizer when requested | Survey + member welcome branching deployed | Hub invite/finalizer deployed | Survey point path exists | N/A | Needs fresh live test IDs |
| Camp Registration | Function deployed | Shared finalizer when requested | Camp confirmation + member welcome | Hub invite/finalizer deployed | Registration points not applicable | N/A | Needs fresh live test IDs |
| Camp Challenge | Function deployed | Requires active/linked Camp member | Camp submission email path exists | Modal now opens external Camp form | Review/award path exists | Updates after approved ledger | Partially verified; needs authenticated modal test |
| Petition | Bridge functions deployed | No generic membership creation in bridge | Petition Resend template path deployed | Pending/linking path exists | Petition point service path exists | Updates when linked | Needs Action Network live test |
| Grad Highlight | Function deployed | Shared finalizer when requested | Grad confirmation + member welcome | Hub invite/finalizer deployed | Grad point event path exists | Updates when linked | Needs fresh live test IDs |
| Resource Upload | Neon N/A | Active membership checked on approval | No form-specific email verified | Submit/review functions deployed | Review-gated point event | Updates after approval | Backend deployed; needs member/admin live test |
| Job Upload | Neon N/A | Active membership checked on approval | No form-specific email verified | Submit/review functions deployed | Review-gated point event | Updates after approval | Backend deployed; needs member/admin live test |
| Invite Member | Neon membership lookup | Member/nonmember branches deployed | Supabase Auth invite | Function deployed and reachable | `MEMBER_INVITED` wired to point service | Ongoing leaderboard after award | Backend deployed; needs authenticated live invite test |
| Event Registration | Neon event path remains | Shared finalizer when requested | Event email remains Neon-owned | Hub invite/finalizer deployed | Event point path exists | Updates when awarded | Needs live event handoff test |

## UI Fixes

| Fix | Files | Status |
| --- | --- | --- |
| Hub footer copy | `src/components/Footer.tsx`, `components/Footer.tsx` | Updated to approved short copy |
| Legacy Mission Board copy | `pages/CampChallenges.tsx`, `pages/Index.tsx`, `docs/phase-5-launch-blockers-member-experience-roadmap.md` | Removed from source search |
| Submit for Points modal | `src/pages/CampChallengeDetail.tsx` | Button opens a dialog iframe pointed at `https://www.girlplusenvironment.org/camp-gpe#challenge` |
| Camp form post-submit callback | `../girlplusenvironment.org/camp-gpe.html`, `../gpe-mirror/camp-gpe.html` | Challenge form posts `gpe:camp-challenge-submitted` to the Hub after successful submit |

## Production Deployments

| Item | Production status |
| --- | --- |
| `20260730162652_hub_native_point_awards.sql` | Applied and marked applied in migration history |
| `hub-invitation-request` | Deployed, active, reachable; `401` without auth confirms gateway routing |
| `hub-listing-submit` | Deployed, active, reachable; `401` without auth confirms gateway routing |
| `hub-listing-review` | Deployed, active, reachable; `401` without auth confirms gateway routing |

## Function Versions Checked

| Function | Version | SHA |
| --- | ---: | --- |
| `neon-climate-survey` | 43 | `f8d24cde42cbfdb34f265c3bdde5f7ccf757a795cd9e80d6aae6fba0978f6592` |
| `gpe-membership-enroll` | 29 | `82917658a8449cc15b518a443a9bee99c550c1b802c5421baab2a2b78c0ec8c7` |
| `gpe-lifecycle-email-send` | 11 | `f9b9cd6c9807fe67252b30701fe8fa0ded6538b8097a3b6bc24573b75b136be5` |
| `hub-invitation-request` | 1 | `cb240be528eccc139bb1ffdcd20f6b414977434034425872b02d7b6337128608` |
| `hub-listing-submit` | 1 | `aafc830924bfb1a961400f1c0636947d5ab20fa0c54292af394e9129d1d9d6da` |
| `hub-listing-review` | 1 | `d7dd7f1a901a6964978dbf15b938e7ac07f23213a554eeb1eb5365cc2149e48e` |

## Validation

| Check | Result |
| --- | --- |
| `rg "Mission Board|mission board|Playful|playful"` across Hub source/static targets | No live/source Hub matches; old Wix archive files were excluded |
| Email/placeholder search | Production Supabase function URLs and local CORS allowlist entries remain intentionally; unrelated creator-contract Apps Script placeholder remains outside this launch scope |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with 3 existing Camp hook dependency warnings |
| `npm run build` | Passed |
| Endpoint check: invite/listing functions | All return `401` without auth, confirming deployed routing |

## Screenshot Notes

Requested screenshots could not verify the protected Hub footer/modal because unauthenticated local browser sessions redirect to `/login`.

Captured files:

- `/private/tmp/gpe-hub-root-after.png`
- `/private/tmp/gpe-hub-submit-for-points-after.png`

Both captures show the login redirect, not the protected footer/modal. A valid authenticated Hub test session is required for real before/after screenshots.

## Remaining Launch Blockers

- Run controlled live tests with IDs for Become a Member, Climate Survey, Camp registration, Camp Challenge, Petition, Grad Highlight, Resource approval, Job approval, Invite Member, and Event Registration.
- Publish updated static/Wix files for `camp-gpe.html` so the external Camp challenge iframe sends the Hub completion message in production.
- Confirm external Wix pages are serving the updated JavaScript for Become a Member, Climate Survey, Camp, Grad Highlight, and petition embeds.
- Confirm Resend message IDs, Neon constituent/membership/activity IDs, Hub profile IDs, invite IDs, point event IDs, ledger IDs, and leaderboard deltas from live tests.
