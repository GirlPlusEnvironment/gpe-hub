# Email Trigger Matrix

Last audited: 2026-07-29

| Event | Source | Email | Provider | Current status | Notes |
| --- | --- | --- | --- | --- | --- |
| Hub signup created | Hub frontend | Confirm signup | Supabase Auth | Wired | `supabase.auth.signUp` in `AuthContext.tsx`. Do not overwrite template. |
| Hub signup confirmation resent | Hub frontend | Confirm signup | Supabase Auth | Wired | `supabase.auth.resend({ type: "signup" })`. |
| Password reset requested | Hub frontend | Reset password | Supabase Auth | Wired | `supabase.auth.resetPasswordForEmail`. |
| Active Neon member requests Hub access, no Auth user | `hub-account-activation` | Invite user | Supabase Auth | Wired | Uses `/auth/v1/invite`. |
| Active Neon member requests Hub access, existing Auth user | `hub-account-activation` | Password recovery | Supabase Auth | Wired | Uses `/auth/v1/recover`. |
| Contact form submitted | `gpe-contact-submit` | Staff notification | Resend | Wired | Uses `_shared/email.ts`, not lifecycle template catalog. |
| Petition completed through Action Network bridge | Action Network widget plus Supabase bridge | Action Network petition thank you | Resend | Wired | `action-network-completion-bridge` queues this after completion is saved. Uses idempotency by petition slug and email. |
| Petition submitted by nonmember | Action Network webhook or future verified source | Public action follow-up | Resend | Template ready, trigger missing | Trigger after verified action. Suppress for active members and duplicates. |
| Petition verified and points pending | `action-network-completion-bridge` or `camp-gpe-action-network-ingest` | Pending points | Resend | Template ready, trigger missing | Trigger from pending point award creation. |
| Petition verified and points awarded | Point event service | Points earned | Resend | Template ready, trigger missing | Use notification policy so every tiny action is not emailed. |
| Camp petition challenge completed | Point event service | Challenge completed | Resend | Template ready, trigger missing | Should follow deterministic challenge completion. |
| Neon membership created through Become a Member | `gpe-membership-enroll` | Neon membership registration plus Resend member welcome | Neon CRM and Resend | Resend member welcome wired for Become a Member | Neon confirms CRM record. Resend member welcome uses membership ID idempotency. Other membership creation paths still need dedicated welcome trigger review. |
| Membership created but no Hub account | `queueHubInvitation` | Supabase Auth invite or existing-member Hub invite follow-up | Supabase Auth, optional Resend | Supabase Auth path wired, Resend undecided | Secure account link should remain Auth-owned unless generated server-side. |
| Existing Auth user has active Neon membership | `hub-account-activation` | Password recovery | Supabase Auth | Wired | This is currently used as secure Hub access flow. |
| Hub account first activated | Auth/profile lifecycle | Hub activated | Resend | Template ready, trigger missing | Needs reliable first-activation event. |
| Hub user found without active Neon membership | Membership lookup/reconcile | Hub user nonmember | Resend | Template ready, trigger missing | Needs cooldown and membership status rule. |
| Pending awards claimed | `service_claim_pending_point_awards_for_profile` | Points earned or pending claimed summary | Resend | Missing trigger | Could send one summary, not one email per pending row. |
| Event registration intent created | `neon-event-register` | None or operational outbox | Supabase outbox | Outbox row wired | `emit_gpe_event_notification` writes outbox, but no sender worker found. |
| Event registration confirmed | `neon-event-register` and Neon | Neon event registration | Neon CRM | Neon draft shell | Neon remains owner for registration details. |
| Event attendance synced | Future attendance sync | Post-event Hub follow-up | Resend | Template ready, trigger missing | Needs attendance source, event resource links, and optional points. |
| Event registered point event | `neon-event-register` | Points earned, optional | Resend | Point event call present, email trigger missing | `EVENT_REGISTERED` point event is called when registered. |
| Event attended point event | Future attendance sync | Points earned or post-event Hub follow-up | Resend | Missing | Should not overwrite registration point event. |
| Donation recorded | Neon or `gpe-donation-intake` | Donation receipt | Neon CRM | Neon draft shell | Resend should not own receipt. |
| Donor lifecycle follow-up | Donation sync | Donor follow-up | Resend | Missing template and trigger | Optional later. |
| Grad Highlight saved | `gpe-grad-highlight-submit` | Grad Highlight received | Resend | Wired | Queues `graduate-highlight-submission` after the submission and point event path. |
| Climate survey submitted | `neon-climate-survey` | Survey thank you | Resend | Wired | Queues `survey-thank-you` after submission, Neon sync attempt, membership lookup, and point event path. |
| Camp registration submitted | `camp-gpe-submit` | Camp GPE submission | Resend | Wired | Queues `camp-gpe-submission` after registration save and lead action recording. |
| Manual Camp challenge submitted | `camp-gpe-challenge-submit` | Challenge completed or points earned after approval | Resend | Template ready, trigger missing | Review remains for non-deterministic content. |
| Badge earned | Camp/points system | Badge earned | Resend | Missing template and trigger | Future lifecycle email. |
| Friend invitation submitted | Future invite route | Friend invitation | Resend | Template ready, route missing | Needs signed-in sender, rate limit, sanitized note, and no account existence leak. |
| Invited friend joins | Future referral tracking | Invited friend joined | Resend | Template ready, trigger missing | Needs invitation table and join linkage. |
| Newsletter campaign | Campaign system | Newsletter | Resend or campaign tool | Missing | Must honor marketing preferences. |
| Job alert | Job board | Job alert or digest | Resend | Missing | No sender found in job/resource/funding submission flows. |
