# Form Golden Path Launch Checklist

Date: 2026-07-30

## Purpose

The Climate Action Survey exposed frontend/backend drift: a public page could render success while the deployed backend never received the membership payload. This checklist tracks every production form that can create records, send lifecycle email, sync Neon, or award points.

Production-ready means the live page, Edge Function, Neon result, Resend result, Hub sync, and points behavior all match the user's actual action.

## Critical Golden Paths

| Form | Live page updated | Edge Function | Neon record | Membership | Resend email | Hub sync | Points | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Become a Member | Repo updated; Wix publish still needs live browser proof | `gpe-membership-enroll` v29 | Constituent + membership | Shared finalizer | `member-welcome` through Resend | New and existing active-member invite paths covered | N/A | Critical, needs live end-to-end test |
| Climate Action Survey | Repo updated; Wix publish still unresolved | `neon-climate-survey` v43 | Constituent + Neon activity, not native hosted survey response | Shared finalizer when requested | `survey-thank-you`; `member-welcome` only after membership | Finalizer + invite queue | Survey point event path called | Critical, needs Wix publish + live test |
| Action Network Petition | Repo pages load current helper where present | `action-network-completion-bridge` v9; `camp-gpe-action-network-ingest` v28 | Constituent + petition activity | No inline membership on bridge currently | `action-network-petition-thank-you` | Links profile by email/Neon ID | Petition point finalizer | Needs live Action Network test |
| Camp GPE Registration | Repo updated; Wix publish needs proof | `camp-gpe-submit` v32 | Constituent + Camp activity | Shared finalizer when requested | Camp confirmation; member welcome only after membership | Finalizer + invite queue | Registration points N/A | Needs live Camp registration test |
| Grad Highlight | Repo updated; deployment package already existed | `gpe-grad-highlight-submit` v28 | Constituent + highlight activity | Shared finalizer when requested | Grad confirmation; member welcome only after membership | Finalizer + invite queue | Grad point event path called | Needs live Grad test |
| Event Registration | Repo updated; Wix publish needs proof | `neon-event-register` v27 | Event intent; Neon event handoff remains Neon-owned | Shared finalizer when requested | Event emails remain Neon-owned | Finalizer + invite queue for inline membership | Awards only after verified registration | Needs live event handoff test |

## Membership-Capable Function Audit

| Workflow | Frontend membership helper | Backend finalizer | Email behavior | Current risk |
| --- | --- | --- | --- | --- |
| Become a Member | `membershipEnrollment` mode on `become-a-member.html` | Yes, `createAndFinalizeMembership` | Resend `member-welcome` only after membership confirmation | Live Wix page must be browser-tested after publish |
| Climate Survey | `inlineMembership` mode on survey page | Yes | Survey confirmation always; member welcome only after confirmed membership | Live page did not expose fixed script in HTML fetch |
| Camp GPE | `campRegistration` mode except challenge passive lookup | Yes | Camp confirmation; member welcome only when membership created | Needs controlled production test |
| Grad Highlight | `inlineMembership` mode | Yes | Grad confirmation; member welcome only when membership created | Needs controlled production test |
| Events | `inlineMembership` mode | Yes | Neon remains event-email owner; membership welcome only when membership created | Need ensure event UX does not imply completed registration before Neon handoff |
| Donation | No membership helper in current repo page | N/A | Donation confirmation only | Not membership-capable currently |
| Contact | Passive lookup only | N/A | Neon activity; no lifecycle confirmation currently in audited snippet | Not membership-capable currently |
| Petition bridge | Public action pages load helper, but bridge sends `membershipRequest: null` | N/A for membership | Petition confirmation only | Inline membership is not wired for bridge submissions |

## Become a Member Fix Applied

Problem:

If Neon already had an active member whose Hub profile was not linked, `gpe-membership-enroll` returned `alreadyMember` before queueing Hub activation.

Fix:

- Existing active members with `active_member_needs_hub_invite` now call `queueHubInvitation`.
- The function returns:
  - `membershipCreationStatus: "already_active"`
  - `membershipEmailQueued: false`
  - `hubInviteQueued`
  - `hubInviteStatus`
- The form success copy distinguishes:
  - existing active Hub user
  - existing active member with Hub invite queued
  - newly confirmed member with member-welcome email queued

Files:

- `supabase/functions/gpe-membership-enroll/index.ts`
- `../girlplusenvironment.org/become-a-member.html`
- `../gpe-mirror/become-a-member.html`

## Production Function Versions After Alignment

| Function | Version | SHA |
| --- | ---: | --- |
| `gpe-membership-enroll` | 29 | `82917658a8449cc15b518a443a9bee99c550c1b802c5421baab2a2b78c0ec8c7` |
| `neon-climate-survey` | 43 | `f8d24cde42cbfdb34f265c3bdde5f7ccf757a795cd9e80d6aae6fba0978f6592` |
| `camp-gpe-submit` | 32 | `7be2c373f5be1a98001bc19a861c91b8c97745db9af8beb01c8edead4061fd61` |
| `gpe-grad-highlight-submit` | 28 | `0977fcb5d281d63828377f20aedff2194d981eccf536876083243381dc68c300` |
| `neon-event-register` | 27 | `3431bfe956206753d3cfb4921214255adf78bd267ed95aaf6b04eef3665c72b7` |
| `action-network-completion-bridge` | 9 | `5639fc6547232e4fad715ded985d36b68415b8b161233557ee6d201a45973a6b` |
| `camp-gpe-action-network-ingest` | 28 | `df6065f612ca54a3a47fb29c3ea0d7ee71e57c769f8befa010993a74aebd485c` |

## Required Live Tests Before Launch

Use unique controlled test emails and record IDs from Supabase, Neon, Resend, and Hub.

| Test | Expected result | Status |
| --- | --- | --- |
| Become a Member: new email | Neon constituent, Neon membership, demographic profile activity, member welcome, Hub invite/account activation if needed | Not run |
| Become a Member: existing active member without Hub profile | No duplicate membership, Hub invite queued/sent, no member welcome resend | Not run |
| Become a Member: existing linked Hub member | No duplicate membership, no Hub invite needed, correct success copy | Not run |
| Climate Survey only | Supabase survey, Neon activity, survey confirmation only, Become/Invite/Hub CTAs | Not run |
| Climate Survey + membership | Supabase survey, Neon activity, Neon membership, survey confirmation, member welcome, Hub invite if needed | Not run |
| Action Network petition | Neon activity, lead action, point finalizer, Resend petition confirmation, member/nonmember CTA branch | Not run |
| Camp registration + membership | Camp registration, Neon activity, Neon membership, Camp confirmation, member welcome, Hub invite | Not run |
| Grad Highlight + membership | Highlight record, Neon activity, Neon membership, Grad confirmation, member welcome, point event | Not run |
| Event registration + membership | Event intent, Neon handoff, Neon membership if requested, member welcome, event emails left to Neon | Not run |

## Launch Blockers

- Publish and browser-verify every external Wix/static embed after repository updates. Fetching the Wix HTML is not enough because the relevant form code may be inside Wix serialized/embed assets.
- Confirm Neon custom field IDs for demographic fields if those fields must be first-class Neon custom fields rather than captured in membership profile activities.
- Run live tests and record IDs. Do not mark a path complete based only on `queued: true` or a frontend success message.
