# Email Architecture Audit

Last audited: 2026-07-29

This document maps the current Girl Plus Environment email architecture. It is an audit artifact only. It does not activate new automations and does not replace Supabase Auth templates.

## Current Systems

| System | Current role | Evidence | Notes |
| --- | --- | --- | --- |
| Neon CRM | CRM-owned transactional emails for memberships, events, donations, purchases, volunteer records, and account form confirmations | `emails/neon/**`, `emails/neon/MAPPING.md` | Generated Neon HTML shells exist, but all active/schedule values are unknown until checked in Neon. Merge tokens are placeholders and must be replaced from current Neon templates before publishing. |
| Supabase Auth | Security and account access emails | `supabase/config.toml`, `supabase/templates/invite.html`, `supabase/templates/recovery.html`, `src/contexts/AuthContext.tsx`, `supabase/functions/hub-account-activation/index.ts` | Only invite and recovery templates are file-backed in this repo. Confirm signup, magic link, OTP, change email, and reauthentication appear to remain dashboard/default-managed. Do not overwrite these templates. |
| Supabase Edge Functions plus Resend | Hub lifecycle and transactional emails outside Neon/Auth | `supabase/functions/_shared/email.ts`, `supabase/functions/gpe-lifecycle-email-send/index.ts`, `emails/resend/**`, `emails/plain-text/**` | The central sender and template artifacts exist. Most lifecycle triggers are not wired yet. |
| Website static forms | Form submission and membership lookup clients | `/Users/Cassandre/gpe/girlplusenvironment.org`, `/Users/Cassandre/gpe/gpe-mirror` | Static pages call Edge Functions and Action Network widgets. They should not call Resend directly. |
| Action Network | Petition widget and provider-side action confirmation | Action Network widget URLs in website pages, `action-network-completion-bridge`, `camp-gpe-action-network-ingest` | Petition completion and points now route through backend functions. Any Action Network-owned emails are external to this repo. |

## Active Send Paths Found

| Path | Provider | Trigger | Current status |
| --- | --- | --- | --- |
| `supabase.auth.signUp` | Supabase Auth | Hub signup | Wired in `src/contexts/AuthContext.tsx`. Uses Supabase confirmation email. Template not generated in this phase. |
| `supabase.auth.resend({ type: "signup" })` | Supabase Auth | Resend confirmation email | Wired in `src/contexts/AuthContext.tsx`. |
| `supabase.auth.resetPasswordForEmail` | Supabase Auth | User password reset | Wired in `src/contexts/AuthContext.tsx`. |
| `/auth/v1/invite` | Supabase Auth | Active Neon member needs Hub account | Wired in `supabase/functions/hub-account-activation/index.ts`. |
| `/auth/v1/recover` | Supabase Auth | Active Neon member already has Auth user | Wired in `supabase/functions/hub-account-activation/index.ts`. |
| `sendTransactionalEmail` | Resend | Contact staff notification | Wired in `supabase/functions/gpe-contact-submit/index.ts`. |
| `gpe-lifecycle-email-send` | Resend | Hub lifecycle emails | Function exists, tracks delivery, and has an allowlist. Upstream triggers are mostly missing. |
| Neon template engine | Neon CRM | Neon record events | Template shells exist under `emails/neon/**`. Repo cannot verify active Neon dashboard state. |

## Database Support

`supabase/migrations/20260729153754_hub_lifecycle_email_tracking.sql` adds or extends:

- `gpe_email_deliveries`
- `gpe_email_preferences`
- `gpe_email_suppressions`
- lifecycle columns on `gpe_notification_outbox`

The delivery table supports template keys, versions, recipients, source IDs, idempotency keys, provider message IDs, timestamps, failures, and retry counts.

## Secret Configuration Audit

`supabase secrets list` on 2026-07-29 showed these email-relevant names:

| Secret | Deployed? | Required by | Notes |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | Yes | `_shared/email.ts` | Required for Resend sends. |
| `GPE_EMAIL_PROVIDER` | Yes | `_shared/email.ts` | Expected value is `resend`. |
| `GPE_EMAIL_FROM` | Yes | `gpe-lifecycle-email-send` | Set to the Community Hub sender. |
| `GPE_EMAIL_REPLY_TO` | Yes | `gpe-lifecycle-email-send` | Set to the support reply-to address. |
| `GPE_EMAIL_SERVICE_SECRET` | Yes | `gpe-lifecycle-email-send` | Generated as an internal random secret on 2026-07-29. Do not print or document the value. |
| `GPE_TRANSACTIONAL_EMAIL_FROM` | No | `gpe-contact-submit` | Contact function falls back to website sender. |
| `GPE_CONTACT_NOTIFICATION_TO` | No | `gpe-contact-submit` | Contact function falls back to `hello@girlplusenvironment.org`. |
| `HUB_INVITATION_FUNCTION_URL` | Yes | `queueHubInvitation` | Used for Hub invitation handoff. |
| `HUB_INVITATION_SECRET` | Yes | `queueHubInvitation` | Generated as a separate internal random secret on 2026-07-29. Do not print or document the value. |

## Main Architecture Gaps

1. Resend lifecycle templates are generated but not consistently triggered.
2. `gpe-lifecycle-email-send` now has the required internal secret, sender, and reply-to names configured.
3. Hub invitation flow still relies on Supabase Auth invite/recovery, not the branded Resend `existing-member-hub-invite` template.
4. Neon templates use placeholder merge markers. They are not ready to publish until exact Neon tokens are copied from the Neon editor.
5. `gpe_notification_outbox` exists but there is no worker found that drains it into `gpe-lifecycle-email-send`.
6. Petition, point, badge, challenge, pending-points, and post-event email triggers need explicit wiring after this audit is reviewed.
