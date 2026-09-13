# Admin Hub Members Workspace

Prepared locally only. Do not apply this migration or deploy the Edge Function until Supabase access is restored and the reviewer is ready to release it.

## Purpose

`/admin/hub-members` is a first-class staff workspace for cross-checking people represented across:

- Supabase Auth users
- Hub `profiles`
- Neon membership cache in `membership_access`
- Hub invitations
- public form lead/action records
- Camp season-member records
- canonical point transactions

Team Review remains focused on reviewing content/actions/rewards. Hub Members is the people directory, identity reconciliation surface, status overview, action history, and manual point adjustment surface.

## Prepared Local Files

- `src/pages/AdminHubMembers.tsx`
  - Admin-only directory page with table, mobile cards, filters, pagination, detail dialog, Neon refresh action, and manual award dialog.
- `src/App.tsx`
  - Adds `/admin/hub-members` behind `AdminRoute`.
- `src/components/Header.tsx`
  - Adds admin-only Hub Members navigation.
- `src/pages/AdminDashboard.tsx`
  - Adds Hub Members link.
- `src/lib/camp.ts`
  - Adds participant directory/detail/refresh/audit helpers and richer roster types.
- `supabase/migrations/20260913004631_admin_hub_members_roster.sql`
  - Adds `hub_participant_directory`, `admin_action_audit_log`, admin refresh/list/detail/audit RPCs, and `membership_access.neon_membership_id`.
- `supabase/functions/admin-hub-participants-neon-sync/index.ts`
  - Admin-only server-side Neon status refresh and read-only bulk-page scaffold.
- `supabase/config.toml`
  - Registers `admin-hub-participants-neon-sync`.
- `scripts/test-hub-participant-reconciliation.mjs`
  - Local normalization/reconciliation/idempotency smoke tests.

## Authority Model

The directory is an admin reconciliation index, not a new source of truth.

- Hub identity: `auth.users` and `profiles`
- Neon account and membership status: Neon API, cached in `membership_access`
- Camp enrollment: `gpe_season_members`
- points and point history: `point_transactions` and existing point RPCs
- public actions: `lead_actions`, `constituent_leads`, and linked form/review records
- admin mutations: existing point RPCs plus `admin_action_audit_log`

## Security Notes

- The route is protected by `AdminRoute`.
- New RPCs independently verify `public.is_admin(auth.uid())`.
- Directory table has RLS and is admin-readable only.
- The Neon sync function verifies the caller’s JWT, checks admin status server-side, and uses existing `NEON_ORG_ID` / `NEON_API_KEY` secrets only inside the Edge Function.
- The browser never receives Neon API credentials.
- Manual point awards continue to use `admin_award_manual_points`; the UI does not mutate point totals directly.

## Deployment Steps Later

1. Review the migration SQL against production schema.
2. Apply the migration with Supabase tooling.
3. Deploy `admin-hub-participants-neon-sync`.
4. Confirm required secrets already exist: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEON_ORG_ID`, `NEON_API_KEY`.
5. Run `select public.admin_refresh_hub_participant_directory();` as an admin/service context.
6. Smoke test `/admin/hub-members` with an admin account.

## Live Verification Still Needed

- Verify whether Neon `/accounts?page=&pageSize=` is the correct bulk enumeration endpoint and whether pagination metadata matches the current API.
- Verify membership ID field names in live Neon membership payloads.
- Confirm whether historical standalone membership submissions can backfill `membership_access.neon_membership_id`.
- Confirm ambiguous email cases in production are marked `needs_reconciliation` rather than auto-linked.
- Confirm Edge Function CORS origins include the deployed Hub admin domain.

## Review Findings

- Point deductions are supported only through the canonical manual point RPC if negative point amounts are allowed by the existing server-side rules. The UI labels the action as Award Points but accepts non-zero signed values; it does not directly edit totals.
- Bulk Neon-only surfacing is prepared through a cache/sync architecture. It intentionally avoids per-row Neon calls from the table.
- The directory refresh performs set-based local reads and writes; detail history is loaded only when a participant is opened.
