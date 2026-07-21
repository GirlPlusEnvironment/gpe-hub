# Neon Climate Survey Integration

## Scope

This replaces the hosted Neon CRM form for the Mobile Climate Adaptation Plan Survey with a custom GPE-branded page and a server-side Supabase Edge Function.

Old Neon URLs:

- `https://girlplusenvironment.app.neoncrm.com/np/clients/girlplusenvironment/survey.jsp?surveyId=2`
- `https://girlplusenvironment.app.neoncrm.com/forms/mobile-climate-adaptation-plan-survey`

New canonical GPE URL placeholder:

- `REPLACE_WITH_CANONICAL_GPE_SURVEY_PAGE_URL`

## Files

- `gpe-mirror/mobile-climate-adaptation-survey.html`
- `gpe-hub/supabase/functions/neon-climate-survey/index.ts`
- `gpe-hub/supabase/functions/neon-membership-check/index.ts`
- `gpe-hub/supabase/functions/_shared/neon-membership.ts`
- `gpe-hub/supabase/migrations/20260717_neon_climate_survey.sql`
- `gpe-hub/docs/neon-climate-survey-integration.md`
- `gpe-hub/docs/neon-field-map.md`
- `gpe-hub/docs/neon-membership-check.md`

## Public Frontend Configuration

In `gpe-mirror/mobile-climate-adaptation-survey.html`, replace:

- `REPLACE_WITH_SUPABASE_EDGE_FUNCTION_PUBLIC_URL/neon-climate-survey`
- `REPLACE_WITH_GPE_MEMBERSHIP_URL`
- `REPLACE_WITH_GPE_HUB_LOGIN_URL`
- `REPLACE-WITH-GPE-ACTIONS-PAGE-URL`

Do not add Neon credentials to the HTML, Wix page, Vite env, or frontend JavaScript.

## Required Supabase Secrets

Set these as Supabase Edge Function secrets:

- `NEON_API_KEY`
- `NEON_ORG_ID`
- `NEON_WEBHOOK_SECRET`
- `HUB_INVITATION_SECRET`
- `ALLOWED_FORM_ORIGINS`
- `GPE_MEMBERSHIP_URL`
- `GPE_HUB_LOGIN_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional/configurable:

- `NEON_BASE_URL`, default `https://api.neoncrm.com/v2`
- `NEON_API_VERSION`, default `2.11`
- `ELIGIBLE_MEMBERSHIP_LEVELS`, comma-separated; empty means any active level
- `ELIGIBLE_MEMBERSHIP_STATUSES`, comma-separated; default `active,current`
- `HUB_INVITATION_FUNCTION_URL`, used to call the existing Hub invitation workflow
- `ALLOWED_HUB_ORIGINS`, optional for `neon-membership-check`; falls back to `ALLOWED_FORM_ORIGINS`

## Neon API Endpoints Used

The Edge Function uses Neon CRM API v2 with HTTP Basic auth, where username is `NEON_ORG_ID` and password is `NEON_API_KEY`, and sends `NEON-API-VERSION: 2.11`.

- `POST /accounts/search`
- `POST /accounts`
- `POST /activities`
- `GET /accounts/{id}/memberships`

The current Neon CRM API v2 documentation lists account, activity, membership, custom field, and custom object endpoints, but does not list a supported endpoint for creating a hosted survey response for the original public survey object. Because of that limitation, the function preserves every survey answer in Supabase and writes the full answer payload to a Neon activity on the matched or created account. If Neon later exposes a supported survey response endpoint or GPE configures a custom object, the sync layer can be extended without changing the frontend payload.

The exported Neon form maps the displayed `Age *` field to `account.address.line1.line1`. Inspection shows this is the actual hosted-form control and validation target, not an export artifact. It is treated as a legacy form-builder misconfiguration because address line 1 is not a legitimate destination for age. The custom integration stores age in `sanitized_answers` and the Neon activity payload only, and leaves Neon account address fields for actual address data: city, state/province, and zip.

## Submission Flow

1. Browser submits JSON to `neon-climate-survey`.
2. Function rejects non-`POST`/`OPTIONS`, disallowed origins, non-JSON content, oversized bodies, malformed data, invalid option IDs, and missing required answers.
3. Function stores or reuses a submission audit record by idempotency key.
4. Function matches Neon accounts in this order:
   - stored Neon account ID when supplied
   - normalized email
   - email plus first and last name only when multiple email matches exist
5. Function never matches by name alone.
6. If multiple same-email records remain ambiguous, it stores `requires_manual_review` and returns `ambiguous_account`.
7. Function creates a Neon account when no email match exists.
8. Function writes all answers to a Neon activity and keeps the full Supabase audit record.
9. Function calls the shared membership resolver from `supabase/functions/_shared/neon-membership.ts`.
10. Function uses the normalized membership result for survey-side automation only: queue a Hub invitation for eligible members or create a pending conversion for nonmembers.
11. Function returns a safe membership outcome to the frontend.

## Shared Membership Service

Hub login and registration are the primary consumers of `neon-membership-check`. The survey function now shares the same resolver instead of maintaining its own Neon lookup and membership eligibility rules.

The shared function accepts:

```json
{
  "email": "member@example.com",
  "firstName": "Optional",
  "lastName": "Optional"
}
```

It returns normalized outcomes:

- `active_member_existing_hub_user`
- `active_member_needs_hub_invite`
- `inactive_or_expired_member`
- `nonmember`
- `ambiguous_account`
- `lookup_failed`

Surveys and Action Network webhooks should save their own submission first, then optionally call the shared resolver for invitation or conversion automation. Do not make survey submission the permanent source of truth for Hub access.

## Membership Outcomes

- `active_member_existing_hub_user`: active Neon membership and current `membership_access` row linked to a Hub user.
- `active_member_needs_hub_invite`: active Neon membership, no current Hub user, invitation workflow invoked or queued.
- `nonmember`: no eligible active membership; survey remains saved and `pending_membership_conversions` is created.
- `ambiguous_account`: duplicate same-email Neon records require manual review.
- `submission_saved_neon_sync_pending`: survey was saved, but a downstream Neon or Hub step needs retry.
- `failed`: validation or unrecoverable processing failed.

## Hub Invitation Flow

For active members without Hub access:

1. Function calls `HUB_INVITATION_FUNCTION_URL` with `HUB_INVITATION_SECRET` when configured.
2. Payload includes `submissionId`, `email`, and `neonAccountId`.
3. The existing invitation workflow should create or link the Supabase user, store the Neon account ID, update `membership_access`, and send the branded secure invitation.
4. If no invitation URL is configured, the function records a pending `hub_invitations` row instead of returning a generic signup URL.

For existing Hub members:

1. Function checks `membership_access` by Neon account ID and normalized email.
2. It returns `GPE_HUB_LOGIN_URL`.

For nonmembers:

1. Function creates `pending_membership_conversions`.
2. It returns `GPE_MEMBERSHIP_URL`.
3. A future Neon membership webhook should find pending conversions by normalized email or Neon account ID and complete the Hub invitation automatically.

## Old URL Migration

Repository references found locally:

- `gpe-hub/docs/neon-climate-survey-integration.md` documents both old URLs.
- `gpe-mirror/neon-form-survey.html` contains the exported old Neon form and should remain as source/archive only.
- Historical note: the Take Action climate CTA previously pointed to `https://girlplusenvironment.app.neoncrm.com/np/clients/girlplusenvironment/survey.jsp?surveyId=2`; it has been replaced with the custom GPE survey page.

Replacement needed anywhere public navigation, buttons, or campaigns point to the old Neon URLs:

- Replace both old Neon URLs with `REPLACE_WITH_CANONICAL_GPE_SURVEY_PAGE_URL`.
- In `gpe-mirror/takeaction.html`, replace the `TAKE ACTION` button `href` with `REPLACE_WITH_CANONICAL_GPE_SURVEY_PAGE_URL`.

Neon dashboard redirect status:

- No true pre-submission redirect is confirmed from the exported HTML or local project files.
- Do not claim Neon redirects old form submissions unless confirmed in Neon settings.

Fallback:

1. Deactivate or unpublish the hosted Neon form if Neon allows it.
2. If Neon supports custom form copy after closure, display: `Survey moved. Please complete the Mobile Climate Adaptation Plan Survey at REPLACE_WITH_CANONICAL_GPE_SURVEY_PAGE_URL.`
3. Update all GPE site, email, social, and partner links to the canonical GPE URL.

## Retry And Manual Review

Tables:

- `neon_climate_survey_submissions`
- `neon_climate_survey_retries`
- `membership_access`
- `hub_invitations`
- `pending_membership_conversions`

Retry candidates:

- `status = 'neon_sync_pending'`
- `status = 'hub_invite_pending'`
- `membership_outcome = 'submission_saved_neon_sync_pending'`

Manual review candidates:

- `status = 'requires_manual_review'`
- `membership_outcome = 'ambiguous_account'`

## Neon Dashboard Steps Still Required

- Confirm API key permissions for accounts, activities, and memberships.
- Confirm whether GPE wants the activity type/status values used by the function or a custom activity type.
- Confirm whether a Neon custom object should be created for survey responses; if yes, add its API alias and map the activity write to custom object records.
- Confirm eligible membership levels and statuses for `ELIGIBLE_MEMBERSHIP_LEVELS` and `ELIGIBLE_MEMBERSHIP_STATUSES`.
- Confirm whether Neon can display a moved/closed message on the old hosted form.
- Configure membership webhook handling to process `pending_membership_conversions`.
