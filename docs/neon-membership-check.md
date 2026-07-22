# Neon Membership Check

## Purpose

`neon-membership-check` is the shared membership service for the GPE Hub. Hub login and registration should be the primary consumers. Survey forms and Action Network webhooks may reuse it for automation, but Hub access control should not depend on a survey submission.

## Function

- Supabase Edge Function: `neon-membership-check`
- Shared resolver module: `supabase/functions/_shared/neon-membership.ts`
- Primary consumer: GPE Hub login/signup flow
- Secondary consumers: `neon-climate-survey`, future surveys, Action Network webhooks

## Request

```json
{
  "email": "member@example.com",
  "firstName": "Optional",
  "lastName": "Optional"
}
```

`email` is required. `firstName` and `lastName` are only used to resolve ambiguity when more than one Neon account has the same email. The resolver never matches by name alone.

## Response

```json
{
  "matched": true,
  "isActiveMember": true,
  "neonAccountId": "12345",
  "membershipStatus": "Active",
  "membershipLevel": "Member",
  "hubAccess": "allowed",
  "outcome": "active_member_existing_hub_user",
  "requiresManualReview": false
}
```

## Outcomes

- `active_member_existing_hub_user`: active Neon member with current `membership_access`; Hub login can proceed.
- `active_member_needs_hub_invite`: active Neon member without Hub access; Hub registration/invitation flow should create or link the user and send a secure invite.
- `inactive_or_expired_member`: Neon account exists, but no eligible active membership was found.
- `nonmember`: no Neon account/membership match by normalized email.
- `ambiguous_account`: multiple same-email Neon accounts could not be resolved by first and last name.
- `lookup_failed`: validation, Neon, or Supabase lookup failed.

`hubAccess` normalizes the action layer:

- `allowed`
- `invite_required`
- `membership_required`
- `manual_review`
- `denied`
- `unknown`

## Matching Rules

1. Use supplied Neon account ID only when an internal server-side caller provides one.
2. Match by normalized email.
3. If multiple accounts share the same email, use email plus first and last name only to resolve the ambiguity.
4. Never match by name alone.
5. If ambiguity remains, return `ambiguous_account`.

## Eligibility Rules

Eligible memberships are evaluated through:

- `ELIGIBLE_MEMBERSHIP_LEVELS`, comma-separated; empty means any level.
- `ELIGIBLE_MEMBERSHIP_STATUSES`, comma-separated; default `active,current`.

The shared resolver also treats Neon `isActive` or `primaryActiveMembership` as active when present.

## Hub Login And Registration

Hub login flow:

1. User enters email and password.
2. Supabase Auth authenticates identity.
3. Hub calls `neon-membership-check` with the Supabase session attached.
4. The Edge Function resolves the authenticated user from the `Authorization` header and uses that user ID as the primary Hub profile link.
5. The resolver checks Neon CRM by normalized email and evaluates actual membership records, including status and effective/expiration dates.
6. Active members are synced into `profiles` and `membership_access`, then the frontend refreshes the profile before navigating into the Hub.
7. Nonmembers, expired members, ambiguous matches, and integration errors fail closed with the appropriate membership, renewal, manual-review, or retry state.

Hub registration still preflights membership first:

1. User enters registration details.
2. Hub calls `neon-membership-check`.
3. Signup proceeds only for `active_member_needs_hub_invite`.
4. `nonmember`, `inactive_or_expired_member`, `ambiguous_account`, and `lookup_failed` show user-facing guidance.

The Hub should continue to use `membership_access` as its local authorization record. The shared function confirms Neon membership state; it should not make survey completion a requirement for Hub access.

Current Hub implementation:

- `src/lib/membership.ts` invokes `neon-membership-check` through Supabase Functions.
- `src/pages/Login.tsx` authenticates login first, checks membership with the authenticated session, refreshes profile state, then routes.
- Login continues only for an active member with `hubAccess: "allowed"`.
- Signup continues only for `active_member_needs_hub_invite`.
- `nonmember`, `inactive_or_expired_member`, `ambiguous_account`, and `lookup_failed` fail closed with user-facing guidance.

## Survey And Action Network Reuse

Future surveys and Action Network webhooks can reuse the same resolver after they save their own submission/event:

1. Save the incoming submission or webhook payload.
2. Call the shared resolver using normalized email and optional name fields.
3. If active and not already connected, queue or invoke the Hub invitation workflow.
4. If nonmember or expired, create a pending membership conversion record.
5. Never require the user to repeat the survey or form after becoming a member.

The Mobile Climate Adaptation survey now uses this shared resolver after saving the submission and syncing the Neon activity. Its membership result is a survey-side automation only, not the source of truth for Hub access.

## Required Secrets

- `NEON_API_KEY`
- `NEON_ORG_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_HUB_ORIGINS` or `ALLOWED_FORM_ORIGINS`
- `ELIGIBLE_MEMBERSHIP_LEVELS`, optional
- `ELIGIBLE_MEMBERSHIP_STATUSES`, optional
