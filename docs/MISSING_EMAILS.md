# Missing Emails And Gaps

Last audited: 2026-07-29

## Templates Exist But Triggers Are Missing Or Unconfirmed

| Email | Current asset | Missing piece | Priority |
| --- | --- | --- | --- |
| Public action follow-up | `emails/resend/public-action-follow-up.html` | Trigger after verified public action for nonmembers | High |
| Member welcome | `emails/resend/member-welcome.html` | Trigger after Neon active membership confirmation | High |
| Existing member Hub invite follow-up | `emails/resend/existing-member-hub-invite.html` | Decide whether this remains a Resend informational follow-up or Supabase Auth secure invite only | High |
| Hub user nonmember | `emails/resend/hub-user-nonmember.html` | Cooldown-backed membership check trigger | Medium |
| Hub activated | `emails/resend/hub-activated.html` | First activation trigger | High |
| Pending points | `emails/resend/pending-points.html` | Trigger from pending award creation | High |
| Points earned | `emails/resend/points-earned.html` | Trigger from significant point event policy | High |
| Challenge completed | `emails/resend/challenge-completed.html` | Trigger from challenge completion | High |
| Friend invitation | `emails/resend/invite-friend.html` | Invite route, rate limit, URL, trigger | Medium |
| Invited friend joined | `emails/resend/invited-friend-joined.html` | Referral tracking and join trigger | Medium |
| Post-event Hub follow-up | `emails/resend/post-event-follow-up.html` | Attendance sync trigger and event link mapping | Medium |

## Missing From Resend Catalog

| Email | Recommended owner | Trigger | Notes |
| --- | --- | --- | --- |
| Donor Hub follow-up | Resend | Neon donation synced and donor is eligible for Hub journey | Keep Neon receipt separate. |
| Donation attribution for existing member | Resend or in-app only | Donation linked to Hub member | Optional, do not replace Neon receipt. |
| Survey follow-up | Resend | Public survey accepted | Could reuse public action follow-up or become survey-specific later. |
| Grad Highlight received | Resend | Grad Highlight saved | Current UX reports success, but no user confirmation email sender was found. |
| Membership creation failed follow-up | Resend or admin-only | Form saved but membership creation failed | Useful for recovery, but avoid confusing users if retry is automatic. |
| Admin failure alert | Resend or internal notification | Neon sync, Hub invite, points, or email failure | Operational alert, separate from public lifecycle email. |
| Badge earned | Resend | Badge awarded | Not in current Resend catalog. |
| Leaderboard milestone | Resend | Ranking or threshold reached | Not in current Resend catalog. |
| Hub digest | Resend | Scheduled digest | No scheduler or template found. |
| Newsletter | Resend or campaign tool | Marketing campaign | No template or trigger found. Must honor preferences. |
| Job board alerts | Resend | New jobs or saved-search match | No template or trigger found. |
| Inactive member reminder | Resend | Inactivity cooldown | No template or trigger found. |
| Lapsed member winback | Resend or Neon depending on renewal record | Membership lapse plus Hub lifecycle | Neon owns renewal notices. Resend may own Hub-specific winback only. |

## Infrastructure Gaps

| Gap | Impact | Fix before activation |
| --- | --- | --- |
| Sender-domain verification not confirmed through available CLI access | Resend may reject `support@gpecommunityhub.org` if the domain is not verified | Confirm `gpecommunityhub.org` in the Resend dashboard before live activation. |
| No outbox drain worker found | `gpe_notification_outbox` rows may not become emails | Build worker or call the lifecycle sender directly from source functions. |
| No outbox drain worker found | `gpe_notification_outbox` rows may not become emails | Build worker or remove outbox dependency for immediate sends. |
| Neon token placeholders | Neon templates are not publishable | Replace placeholders with exact Neon merge tokens. |
