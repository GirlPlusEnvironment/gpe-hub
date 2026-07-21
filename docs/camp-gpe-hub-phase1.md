# Camp GPE Hub Phase 1

This pass makes the Hub the operational home for Camp GPE while keeping the public website focused on recruitment and storytelling.

## Routes

- Public website CTA target: `https://members.girlplusenvironment.org/leaderboard`
- Hub member leaderboard: `/leaderboard`
- Team GPE Camp admin: `/admin/camp`
- Existing general admin remains: `/admin`

The existing protected-route login flow handles unauthenticated visitors and returns them to the requested Hub route.

## Roles

Roles are backend-managed in `public.user_roles`.

Valid roles:

- `member`
- `team_gpe`
- `admin`

Manual grant:

```sql
insert into public.user_roles (user_id, role, granted_by)
values ('USER_UUID', 'team_gpe', 'GRANTING_ADMIN_UUID');
```

Manual revoke:

```sql
update public.user_roles
set revoked_at = now()
where user_id = 'USER_UUID'
  and role = 'team_gpe'
  and revoked_at is null;
```

Users cannot grant roles to themselves through the browser. UI checks call `public.has_role`, `public.can_manage_camp`, and `public.is_admin`.

## Data Model

Migration:

- `supabase/migrations/20260718_camp_gpe_hub_phase1.sql`

Adds:

- `user_roles`
- `gpe_seasons`
- `gpe_cabins`
- `gpe_season_members`
- `gpe_camp_challenge_submissions`
- `gpe_camp_points_ledger`
- `gpe_camp_leaderboard` view

Seeded season:

- slug: `camp-gpe-2026`
- name: `Camp GPE Summer 2026`
- status: `active`

## Public Form Mapping

`camp-gpe-submit`:

- saves the original form submission first
- checks duplicate registration in `gpe_form_registrations`
- creates or updates `gpe_season_members`
- syncs a Neon activity secondarily
- does not award points

`camp-gpe-challenge-submit`:

- saves the original form submission first
- creates or links a season member by season/email
- creates a pending `gpe_camp_challenge_submissions` review record
- syncs a Neon activity secondarily
- does not award points automatically

## Points

Points are season-scoped ledger entries. The leaderboard totals unreversed ledger rows only.

Corrections are preserved by either adding a new correction/manual row or setting `reversed_at`, `reversed_by`, and `reversal_reason` on the original row.

## Deployment Order

Do not run these until ready for deployment.

```bash
cd /Users/Cassandre/gpe/gpe-hub
supabase status
supabase db diff --linked
supabase db push --dry-run
supabase db push
supabase functions deploy neon-membership-check
supabase functions deploy camp-gpe-submit
supabase functions deploy camp-gpe-challenge-submit
```

Required secrets for the touched functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_FORM_ORIGINS`
- `NEON_ORG_ID`
- `NEON_API_KEY`
- `ACTIVE_CAMP_SEASON_SLUG` optional, defaults to `camp-gpe-2026`
- `HUB_INVITATION_FUNCTION_URL` optional
- `HUB_INVITATION_SECRET` required only when invitation function URL is configured

## Smoke Tests

- unauthenticated `/leaderboard` routes through login and returns to leaderboard
- ordinary member cannot open `/admin/camp`
- `team_gpe` can open `/admin/camp`
- revoked `team_gpe` cannot open `/admin/camp`
- Camp registration creates one `gpe_season_members` row per season/email
- repeated Camp registration returns duplicate without creating another season member
- challenge submission creates pending review row
- awarding points creates one ledger row and changes leaderboard total
- marking rejected/needs-info changes review status without awarding points
- manual point adjustment creates an auditable ledger row
- reversed ledger rows no longer count in `gpe_camp_leaderboard`
