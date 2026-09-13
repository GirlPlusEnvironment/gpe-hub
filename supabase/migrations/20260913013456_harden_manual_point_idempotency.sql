create or replace function public.award_scoped_hub_points(
  p_user_id uuid,
  p_points integer,
  p_source text,
  p_source_id uuid,
  p_metadata jsonb default '{}'::jsonb,
  p_action_type text default null,
  p_season_id uuid default null,
  p_challenge_id uuid default null,
  p_season_member_id uuid default null,
  p_cabin_id uuid default null,
  p_counts_for_ongoing boolean default true,
  p_counts_for_season boolean default false,
  p_counts_for_cabin boolean default false,
  p_approval_status text default 'approved',
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  transaction_id uuid;
  trusted_listing_award boolean := false;
begin
  trusted_listing_award :=
    p_source = 'listing_submission'
    and coalesce(p_action_type, '') = 'job_submission'
    and p_user_id = actor
    and coalesce(p_counts_for_ongoing, true)
    and not coalesce(p_counts_for_season, false)
    and not coalesce(p_counts_for_cabin, false)
    and exists (
      select 1
      from public.listings l
      where l.id = p_source_id
        and l.submitted_by = actor
        and l.category = 'jobs'
    );

  if actor is null or (not public.can_manage_camp(actor) and not trusted_listing_award) then
    raise exception 'Not authorized to award Hub points.';
  end if;
  if p_user_id is null then
    raise exception 'Point award requires a Hub profile.';
  end if;
  if p_points = 0 then
    return null;
  end if;
  if p_points < 0 and not public.can_manage_camp(actor) then
    raise exception 'Only admins can create negative point entries.';
  end if;
  if nullif(trim(coalesce(p_source, '')), '') is null or p_source_id is null then
    raise exception 'Point award requires an idempotent source.';
  end if;
  if p_approval_status not in ('approved', 'pending', 'rejected', 'duplicate', 'manual_review', 'reversed') then
    raise exception 'Unsupported point approval status: %', p_approval_status;
  end if;
  if coalesce(p_counts_for_season, false) and p_season_id is null then
    raise exception 'Season-scoped points require season_id.';
  end if;
  if coalesce(p_counts_for_cabin, false) and (p_season_id is null or p_cabin_id is null) then
    raise exception 'Cabin-scoped points require season_id and cabin_id.';
  end if;

  select id into transaction_id
  from public.point_transactions
  where source = p_source
    and source_id = p_source_id
  limit 1;

  if transaction_id is not null then
    return transaction_id;
  end if;

  insert into public.point_transactions (
    user_id,
    points_earned,
    source,
    source_id,
    metadata,
    action_type,
    season_id,
    challenge_id,
    season_member_id,
    cabin_id,
    counts_for_ongoing,
    counts_for_season,
    counts_for_cabin,
    approval_status,
    occurred_at,
    created_at
  )
  values (
    p_user_id,
    p_points,
    p_source,
    p_source_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('awarded_by', actor),
    coalesce(nullif(trim(p_action_type), ''), p_source),
    p_season_id,
    p_challenge_id,
    p_season_member_id,
    case when coalesce(p_counts_for_cabin, false) then p_cabin_id else null end,
    coalesce(p_counts_for_ongoing, true),
    coalesce(p_counts_for_season, false),
    coalesce(p_counts_for_cabin, false),
    p_approval_status,
    coalesce(p_occurred_at, now()),
    coalesce(p_occurred_at, now())
  )
  returning id into transaction_id;

  if coalesce(p_counts_for_ongoing, true) and p_approval_status = 'approved' then
    update public.profiles
    set points = greatest(0, points + p_points),
        updated_at = now()
    where id = p_user_id;
  end if;

  return transaction_id;
end;
$$;

revoke all on function public.award_scoped_hub_points(uuid, integer, text, uuid, jsonb, text, uuid, uuid, uuid, uuid, boolean, boolean, boolean, text, timestamptz) from public;
grant execute on function public.award_scoped_hub_points(uuid, integer, text, uuid, jsonb, text, uuid, uuid, uuid, uuid, boolean, boolean, boolean, text, timestamptz) to authenticated;

create or replace function public.admin_award_manual_points(
  p_profile_id uuid,
  p_points integer,
  p_reason text,
  p_action_type text default 'manual_admin_award',
  p_admin_note text default null,
  p_season_id uuid default null,
  p_challenge_id uuid default null,
  p_cabin_id uuid default null,
  p_occurred_at timestamptz default now(),
  p_counts_for_ongoing boolean default true,
  p_counts_for_season boolean default false,
  p_counts_for_cabin boolean default false,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  profile_row public.profiles%rowtype;
  member_row public.gpe_season_members%rowtype;
  source_uuid uuid;
  transaction_id uuid;
  ledger_id uuid;
  existing_id uuid;
  event_id uuid;
  audit_id uuid;
  effective_action_type text := coalesce(nullif(trim(p_action_type), ''), 'manual_admin_award');
  effective_key text;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to manually award points.';
  end if;
  if p_profile_id is null then
    raise exception 'A member profile is required.';
  end if;
  if p_points = 0 then
    raise exception 'Manual point award cannot be zero.';
  end if;
  if abs(p_points) > 10000 then
    raise exception 'Manual point award is too large.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Manual point award requires a reason.';
  end if;
  if p_counts_for_cabin and not p_counts_for_season then
    raise exception 'Cabin points must also count for the season.';
  end if;

  select * into profile_row from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'Profile not found.';
  end if;

  if p_season_id is not null then
    if not exists (select 1 from public.gpe_seasons where id = p_season_id) then
      raise exception 'Season not found.';
    end if;

    select * into member_row
    from public.gpe_season_members
    where season_id = p_season_id
      and user_id = p_profile_id
    order by joined_at desc
    limit 1;

    if not found and (p_counts_for_season or p_counts_for_cabin) then
      raise exception 'Selected profile is not linked to this season.';
    end if;
  elsif p_counts_for_season or p_counts_for_cabin then
    raise exception 'Season points require a season.';
  end if;

  if p_challenge_id is not null then
    if not exists (
      select 1
      from public.gpe_challenges
      where id = p_challenge_id
        and (p_season_id is null or season_id = p_season_id)
    ) then
      raise exception 'Challenge not found for selected season.';
    end if;
  end if;

  if p_counts_for_cabin then
    if coalesce(p_cabin_id, member_row.cabin_id) is null then
      raise exception 'Cabin-scoped points require a cabin.';
    end if;
    if not exists (
      select 1 from public.gpe_cabins c
      where c.id = coalesce(p_cabin_id, member_row.cabin_id)
        and c.season_id = p_season_id
    ) then
      raise exception 'Cabin not found for selected season.';
    end if;
  end if;

  effective_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'manual:' || p_profile_id || ':' || coalesce(p_season_id::text, 'ongoing') || ':' || effective_action_type || ':' || coalesce(p_reason, '') || ':' || coalesce(p_occurred_at::text, now()::text)
  );
  source_uuid := public.uuid_from_text(effective_key);

  select id into existing_id
  from public.point_transactions
  where source = 'manual_admin_award'
    and source_id = source_uuid
  limit 1;

  transaction_id := public.award_scoped_hub_points(
    p_profile_id,
    p_points,
    'manual_admin_award',
    source_uuid,
    jsonb_build_object(
      'reason', p_reason,
      'admin_note', p_admin_note,
      'idempotency_key', effective_key,
      'manual_award', true
    ),
    effective_action_type,
    p_season_id,
    p_challenge_id,
    member_row.id,
    coalesce(p_cabin_id, member_row.cabin_id),
    coalesce(p_counts_for_ongoing, true),
    coalesce(p_counts_for_season, false),
    coalesce(p_counts_for_cabin, false),
    'approved',
    coalesce(p_occurred_at, now())
  );

  insert into public.gpe_point_events (
    event_type,
    rule_action_type,
    email_normalized,
    user_id,
    source,
    source_id,
    season_id,
    season_member_id,
    challenge_id,
    metadata,
    occurred_at,
    points_status,
    point_transaction_id,
    points_result
  )
  values (
    'MANUAL_ADMIN_AWARD',
    effective_action_type,
    lower(nullif(trim(coalesce(profile_row.email, '')), '')),
    p_profile_id,
    'manual_admin_award',
    source_uuid,
    p_season_id,
    member_row.id,
    p_challenge_id,
    jsonb_build_object(
      'reason', p_reason,
      'admin_note', p_admin_note,
      'idempotency_key', effective_key,
      'awarded_by', actor
    ),
    coalesce(p_occurred_at, now()),
    'awarded',
    transaction_id,
    jsonb_build_object(
      'status', 'awarded',
      'eventType', 'MANUAL_ADMIN_AWARD',
      'rule', effective_action_type,
      'points', p_points,
      'awardedPoints', p_points,
      'transactionId', transaction_id,
      'duplicate', existing_id is not null
    )
  )
  on conflict (event_type, source, source_id) do update set
    user_id = coalesce(public.gpe_point_events.user_id, excluded.user_id),
    email_normalized = coalesce(public.gpe_point_events.email_normalized, excluded.email_normalized),
    season_id = coalesce(public.gpe_point_events.season_id, excluded.season_id),
    season_member_id = coalesce(public.gpe_point_events.season_member_id, excluded.season_member_id),
    challenge_id = coalesce(public.gpe_point_events.challenge_id, excluded.challenge_id),
    metadata = public.gpe_point_events.metadata || excluded.metadata,
    points_status = 'awarded',
    point_transaction_id = coalesce(public.gpe_point_events.point_transaction_id, excluded.point_transaction_id),
    points_result = public.gpe_point_events.points_result || excluded.points_result || jsonb_build_object('duplicate', true),
    updated_at = now()
  returning id into event_id;

  if p_season_id is not null and coalesce(p_counts_for_season, false) then
    insert into public.gpe_camp_points_ledger (
      season_id,
      season_member_id,
      user_id,
      challenge_id,
      points,
      reason,
      adjustment_type,
      entry_type,
      source,
      created_by,
      awarded_by,
      metadata,
      general_point_transaction_id,
      counts_for_ongoing,
      counts_for_season,
      counts_for_cabin,
      cabin_id_at_award,
      approval_status,
      occurred_at,
      created_at
    )
    select
      p_season_id,
      member_row.id,
      p_profile_id,
      p_challenge_id,
      p_points,
      p_reason,
      'manual',
      case when p_points >= 0 then 'manual_adjustment'::public.gpe_point_entry_type else 'penalty'::public.gpe_point_entry_type end,
      'manual_admin_award',
      actor,
      actor,
      jsonb_build_object('admin_note', p_admin_note, 'point_transaction_id', transaction_id, 'point_event_id', event_id, 'idempotency_key', effective_key),
      transaction_id,
      coalesce(p_counts_for_ongoing, true),
      true,
      coalesce(p_counts_for_cabin, false),
      case when coalesce(p_counts_for_cabin, false) then coalesce(p_cabin_id, member_row.cabin_id) else null end,
      'approved',
      coalesce(p_occurred_at, now()),
      coalesce(p_occurred_at, now())
    where not exists (
      select 1
      from public.gpe_camp_points_ledger existing
      where existing.general_point_transaction_id = transaction_id
    )
    returning id into ledger_id;
  end if;

  insert into public.admin_action_audit_log (
    admin_id,
    participant_key,
    profile_id,
    action,
    reason,
    previous_state,
    new_state,
    metadata
  )
  values (
    actor,
    'profile:' || p_profile_id::text,
    p_profile_id,
    case when p_points > 0 then 'manual_point_award' else 'manual_point_adjustment' end,
    p_reason,
    '{}'::jsonb,
    jsonb_build_object(
      'points', p_points,
      'pointTransactionId', transaction_id,
      'pointEventId', event_id,
      'campLedgerId', ledger_id,
      'actionType', effective_action_type
    ),
    jsonb_build_object(
      'source', 'admin_award_manual_points',
      'adminNote', p_admin_note,
      'idempotencyKey', effective_key,
      'duplicate', existing_id is not null
    )
  )
  on conflict do nothing
  returning id into audit_id;

  return jsonb_build_object(
    'point_transaction_id', transaction_id,
    'point_event_id', event_id,
    'camp_ledger_id', ledger_id,
    'audit_log_id', audit_id,
    'duplicate', existing_id is not null,
    'idempotency_key', effective_key,
    'points', p_points,
    'counts_for_ongoing', coalesce(p_counts_for_ongoing, true),
    'counts_for_season', coalesce(p_counts_for_season, false),
    'counts_for_cabin', coalesce(p_counts_for_cabin, false)
  );
end;
$$;

revoke all on function public.admin_award_manual_points(uuid, integer, text, text, text, uuid, uuid, uuid, timestamptz, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.admin_award_manual_points(uuid, integer, text, text, text, uuid, uuid, uuid, timestamptz, boolean, boolean, boolean, text) to authenticated;
