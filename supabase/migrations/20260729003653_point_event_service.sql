create table if not exists public.gpe_point_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  rule_action_type text not null,
  lead_action_id uuid references public.lead_actions(id) on delete set null,
  lead_id uuid references public.constituent_leads(id) on delete set null,
  email_normalized text,
  user_id uuid references public.profiles(id) on delete set null,
  source text not null,
  source_id uuid not null,
  points_status public.gpe_action_points_status not null default 'pending_identity',
  points_result jsonb not null default '{}'::jsonb,
  campaign_slug text,
  petition_slug text,
  season_id uuid references public.gpe_seasons(id) on delete set null,
  season_member_id uuid references public.gpe_season_members(id) on delete set null,
  challenge_id uuid references public.gpe_challenges(id) on delete set null,
  camp_submission_action_id uuid references public.gpe_camp_submission_actions(id) on delete set null,
  point_transaction_id uuid references public.point_transactions(id) on delete set null,
  pending_award_id uuid references public.gpe_pending_point_awards(id) on delete set null,
  camp_ledger_id uuid references public.gpe_camp_points_ledger(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_point_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint gpe_point_events_points_result_object check (jsonb_typeof(points_result) = 'object')
);

create unique index if not exists gpe_point_events_source_unique
  on public.gpe_point_events (event_type, source, source_id);

create index if not exists gpe_point_events_user_idx
  on public.gpe_point_events (user_id, occurred_at desc)
  where user_id is not null;

create index if not exists gpe_point_events_email_idx
  on public.gpe_point_events (email_normalized, points_status, occurred_at desc)
  where email_normalized is not null;

create index if not exists gpe_point_events_lead_action_idx
  on public.gpe_point_events (lead_action_id, event_type);

drop trigger if exists update_gpe_point_events_updated_at on public.gpe_point_events;
create trigger update_gpe_point_events_updated_at
before update on public.gpe_point_events
for each row execute function public.update_updated_at_column();

alter table public.gpe_point_events enable row level security;

grant select on public.gpe_point_events to authenticated;
grant select, insert, update on public.gpe_point_events to service_role;

drop policy if exists "gpe_point_events_admin_read" on public.gpe_point_events;
create policy "gpe_point_events_admin_read"
on public.gpe_point_events
for select
to authenticated
using (public.is_admin(auth.uid()));

alter table public.gpe_pending_point_awards
  add column if not exists point_event_id uuid references public.gpe_point_events(id) on delete set null;

create index if not exists gpe_pending_point_awards_event_idx
  on public.gpe_pending_point_awards (point_event_id)
  where point_event_id is not null;

create or replace function public.service_record_point_event(
  p_event_type text,
  p_subject_email text default null,
  p_user_id uuid default null,
  p_lead_action_id uuid default null,
  p_lead_id uuid default null,
  p_source text default null,
  p_source_id uuid default null,
  p_season_id uuid default null,
  p_season_member_id uuid default null,
  p_challenge_id uuid default null,
  p_camp_submission_action_id uuid default null,
  p_cabin_id uuid default null,
  p_campaign_slug text default null,
  p_petition_slug text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_event text := upper(nullif(trim(coalesce(p_event_type, '')), ''));
  rule_action text;
  default_source text;
  rule_row public.hub_point_rules%rowtype;
  lead_action_row public.lead_actions%rowtype;
  lead_row public.constituent_leads%rowtype;
  event_row public.gpe_point_events%rowtype;
  pending_row public.gpe_pending_point_awards%rowtype;
  transaction_id uuid;
  ledger_id uuid;
  resolved_lead_id uuid := p_lead_id;
  resolved_user_id uuid := p_user_id;
  resolved_season_member_id uuid := p_season_member_id;
  resolved_cabin_id uuid := p_cabin_id;
  resolved_email text := lower(nullif(trim(coalesce(p_subject_email, '')), ''));
  resolved_source text;
  resolved_source_id uuid := p_source_id;
  points_to_award integer := 0;
  status public.gpe_action_points_status := 'not_applicable'::public.gpe_action_points_status;
  cap_window_start timestamptz;
  cap_limit integer;
  cap_count integer;
begin
  if normalized_event is null then
    raise exception 'Point event type is required.';
  end if;

  rule_action := case normalized_event
    when 'PETITION_SUBMITTED' then 'petition_signature'
    when 'CAMP_PETITION_COMPLETED' then 'camp_petition_challenge'
    when 'CAMP_PETITION_CHALLENGE' then 'camp_petition_challenge'
    when 'EVENT_REGISTERED' then 'event_registered'
    when 'EVENT_ATTENDED' then 'event_attendance'
    when 'SURVEY_COMPLETED' then 'survey_completed'
    when 'STORY_SUBMITTED' then 'story_submission'
    when 'OFFICE_HOURS_ATTENDED' then 'office_hours_attendance'
    when 'DONATION_RECORDED' then 'donation_recorded'
    else lower(normalized_event)
  end;

  default_source := case rule_action
    when 'petition_signature' then 'action_network_petition'
    when 'camp_petition_challenge' then 'camp_petition_challenge'
    else lower(normalized_event)
  end;
  resolved_source := nullif(trim(coalesce(p_source, default_source)), '');

  if resolved_source is null or resolved_source_id is null then
    raise exception 'Point event requires an idempotent source and source_id.';
  end if;

  if p_lead_action_id is not null then
    select * into lead_action_row
    from public.lead_actions
    where id = p_lead_action_id
    for update;
    if found then
      resolved_lead_id := coalesce(resolved_lead_id, lead_action_row.lead_id);
      resolved_user_id := coalesce(resolved_user_id, lead_action_row.user_id);
      resolved_season_member_id := coalesce(resolved_season_member_id, lead_action_row.season_member_id);
    end if;
  end if;

  if resolved_lead_id is not null then
    select * into lead_row
    from public.constituent_leads
    where id = resolved_lead_id;
    if found then
      resolved_email := coalesce(resolved_email, lower(lead_row.email_normalized));
    end if;
  end if;

  if resolved_user_id is null and resolved_email is not null then
    select p.id into resolved_user_id
    from public.profiles p
    where lower(coalesce(p.email, '')) = resolved_email
       or (lead_row.neon_account_id is not null and p.neon_account_id = lead_row.neon_account_id)
    order by case
      when lead_row.neon_account_id is not null and p.neon_account_id = lead_row.neon_account_id then 1
      else 2
    end
    limit 1;
  end if;

  if resolved_user_id is not null and p_season_id is not null and resolved_season_member_id is null then
    select sm.id into resolved_season_member_id
    from public.gpe_season_members sm
    where sm.season_id = p_season_id
      and (
        sm.user_id = resolved_user_id
        or (lead_row.neon_account_id is not null and sm.neon_account_id = lead_row.neon_account_id)
        or lower(coalesce(sm.contact_email, '')) = coalesce(resolved_email, '')
      )
    order by case when sm.user_id = resolved_user_id then 1 else 2 end
    limit 1;
  end if;

  if resolved_user_id is not null and resolved_season_member_id is not null then
    update public.gpe_season_members
    set user_id = coalesce(user_id, resolved_user_id),
        neon_account_id = coalesce(neon_account_id, lead_row.neon_account_id),
        contact_email = coalesce(contact_email, resolved_email),
        updated_at = now()
    where id = resolved_season_member_id;
  end if;

  insert into public.gpe_point_events (
    event_type,
    rule_action_type,
    lead_action_id,
    lead_id,
    email_normalized,
    user_id,
    source,
    source_id,
    campaign_slug,
    petition_slug,
    season_id,
    season_member_id,
    challenge_id,
    camp_submission_action_id,
    metadata,
    occurred_at
  )
  values (
    normalized_event,
    rule_action,
    p_lead_action_id,
    resolved_lead_id,
    resolved_email,
    resolved_user_id,
    resolved_source,
    resolved_source_id,
    p_campaign_slug,
    p_petition_slug,
    p_season_id,
    resolved_season_member_id,
    p_challenge_id,
    p_camp_submission_action_id,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_occurred_at, now())
  )
  on conflict (event_type, source, source_id) do update set
    lead_action_id = coalesce(public.gpe_point_events.lead_action_id, excluded.lead_action_id),
    lead_id = coalesce(public.gpe_point_events.lead_id, excluded.lead_id),
    email_normalized = coalesce(public.gpe_point_events.email_normalized, excluded.email_normalized),
    user_id = coalesce(public.gpe_point_events.user_id, excluded.user_id),
    campaign_slug = coalesce(public.gpe_point_events.campaign_slug, excluded.campaign_slug),
    petition_slug = coalesce(public.gpe_point_events.petition_slug, excluded.petition_slug),
    season_id = coalesce(public.gpe_point_events.season_id, excluded.season_id),
    season_member_id = coalesce(public.gpe_point_events.season_member_id, excluded.season_member_id),
    challenge_id = coalesce(public.gpe_point_events.challenge_id, excluded.challenge_id),
    camp_submission_action_id = coalesce(public.gpe_point_events.camp_submission_action_id, excluded.camp_submission_action_id),
    metadata = public.gpe_point_events.metadata || excluded.metadata,
    updated_at = now()
  returning * into event_row;

  select * into rule_row
  from public.hub_point_rules
  where action_type = rule_action
    and active
    and (effective_start is null or effective_start <= coalesce(p_occurred_at, now()))
    and (effective_end is null or effective_end >= coalesce(p_occurred_at, now()))
  limit 1;

  if not found or coalesce(rule_row.point_value, 0) <= 0 then
    update public.gpe_point_events
    set points_status = 'not_applicable',
        points_result = jsonb_build_object(
          'status', 'not_applicable',
          'eventType', normalized_event,
          'rule', rule_action,
          'points', 0,
          'reason', case when rule_row.action_type is null then 'rule_not_enabled' else 'zero_points' end
        )
    where id = event_row.id
    returning * into event_row;

    return event_row.points_result || jsonb_build_object('pointEventId', event_row.id);
  end if;

  points_to_award := rule_row.point_value;

  select id into transaction_id
  from public.point_transactions
  where source = resolved_source
    and source_id = resolved_source_id
    and points_earned > 0
  limit 1;

  if transaction_id is not null then
    status := 'awarded';
  elsif resolved_user_id is not null then
    if coalesce(rule_row.duplicate_policy, rule_row.duplicate_strategy) = 'daily_cap' then
      cap_limit := coalesce(rule_row.daily_cap, rule_row.max_awards_per_user);
      if cap_limit is not null then
        cap_window_start := date_trunc('day', coalesce(p_occurred_at, now()));
        select count(*) into cap_count
        from public.point_transactions
        where user_id = resolved_user_id
          and action_type = rule_action
          and points_earned > 0
          and occurred_at >= cap_window_start
          and occurred_at < cap_window_start + interval '1 day';
        if cap_count >= cap_limit then
          status := 'duplicate';
        end if;
      end if;
    elsif coalesce(rule_row.duplicate_policy, rule_row.duplicate_strategy) in ('lifetime_cap', 'manual_review') then
      cap_limit := coalesce(rule_row.lifetime_cap, rule_row.max_awards_per_user);
      if cap_limit is not null then
        select count(*) into cap_count
        from public.point_transactions
        where user_id = resolved_user_id
          and action_type = rule_action
          and points_earned > 0;
        if cap_count >= cap_limit then
          status := 'duplicate';
        end if;
      end if;
    end if;
  end if;

  if status = 'duplicate' then
    update public.gpe_point_events
    set points_status = 'duplicate',
        points_result = jsonb_build_object(
          'status', 'duplicate',
          'eventType', normalized_event,
          'rule', rule_action,
          'points', 0,
          'reason', 'cap_or_duplicate_policy',
          'pointEventId', event_row.id
        )
    where id = event_row.id
    returning * into event_row;
    return event_row.points_result;
  end if;

  insert into public.gpe_pending_point_awards (
    point_event_id,
    lead_action_id,
    lead_id,
    email_normalized,
    user_id,
    rule_action_type,
    source,
    source_id,
    points,
    status,
    campaign_slug,
    petition_slug,
    season_id,
    season_member_id,
    challenge_id,
    camp_submission_action_id,
    point_transaction_id,
    metadata,
    occurred_at,
    claimed_at
  )
  values (
    event_row.id,
    coalesce(p_lead_action_id, event_row.lead_action_id),
    resolved_lead_id,
    coalesce(resolved_email, ''),
    resolved_user_id,
    rule_action,
    resolved_source,
    resolved_source_id,
    points_to_award,
    case when transaction_id is null then 'pending' else 'claimed' end,
    p_campaign_slug,
    p_petition_slug,
    p_season_id,
    resolved_season_member_id,
    p_challenge_id,
    p_camp_submission_action_id,
    transaction_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'event_type', normalized_event,
      'point_event_id', event_row.id,
      'reason', rule_row.display_name,
      'rule_action_type', rule_action,
      'rule_used', rule_action,
      'campaign_slug', p_campaign_slug,
      'petition_slug', p_petition_slug,
      'lead_action_id', p_lead_action_id,
      'duplicate_policy', coalesce(rule_row.duplicate_policy, rule_row.duplicate_strategy)
    ),
    coalesce(p_occurred_at, now()),
    case when transaction_id is null then null else now() end
  )
  on conflict (rule_action_type, source, source_id) do update set
    point_event_id = coalesce(public.gpe_pending_point_awards.point_event_id, excluded.point_event_id),
    lead_action_id = coalesce(public.gpe_pending_point_awards.lead_action_id, excluded.lead_action_id),
    lead_id = coalesce(public.gpe_pending_point_awards.lead_id, excluded.lead_id),
    email_normalized = coalesce(nullif(public.gpe_pending_point_awards.email_normalized, ''), excluded.email_normalized),
    user_id = coalesce(public.gpe_pending_point_awards.user_id, excluded.user_id),
    points = excluded.points,
    campaign_slug = coalesce(public.gpe_pending_point_awards.campaign_slug, excluded.campaign_slug),
    petition_slug = coalesce(public.gpe_pending_point_awards.petition_slug, excluded.petition_slug),
    season_id = coalesce(public.gpe_pending_point_awards.season_id, excluded.season_id),
    season_member_id = coalesce(public.gpe_pending_point_awards.season_member_id, excluded.season_member_id),
    challenge_id = coalesce(public.gpe_pending_point_awards.challenge_id, excluded.challenge_id),
    camp_submission_action_id = coalesce(public.gpe_pending_point_awards.camp_submission_action_id, excluded.camp_submission_action_id),
    point_transaction_id = coalesce(public.gpe_pending_point_awards.point_transaction_id, excluded.point_transaction_id),
    status = case
      when public.gpe_pending_point_awards.status = 'claimed' or excluded.point_transaction_id is not null then 'claimed'
      else public.gpe_pending_point_awards.status
    end,
    claimed_at = case
      when public.gpe_pending_point_awards.claimed_at is not null then public.gpe_pending_point_awards.claimed_at
      when excluded.point_transaction_id is not null then now()
      else null
    end,
    metadata = public.gpe_pending_point_awards.metadata || excluded.metadata,
    updated_at = now()
  returning * into pending_row;

  if resolved_user_id is not null and pending_row.point_transaction_id is null then
    if rule_action = 'camp_petition_challenge'
       and (p_season_id is null or p_challenge_id is null or resolved_season_member_id is null) then
      status := 'pending_identity';
    else
      if resolved_cabin_id is null and resolved_season_member_id is not null then
        select cabin_id into resolved_cabin_id
        from public.gpe_season_members
        where id = resolved_season_member_id;
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
        resolved_user_id,
        points_to_award,
        resolved_source,
        resolved_source_id,
        pending_row.metadata || jsonb_build_object('pending_award_id', pending_row.id, 'point_event_id', event_row.id),
        rule_action,
        case when rule_row.counts_for_season then coalesce(rule_row.season_override_id, rule_row.season_override, p_season_id) else null end,
        case when rule_row.counts_for_season then p_challenge_id else null end,
        case when rule_row.counts_for_season then resolved_season_member_id else null end,
        case when rule_row.counts_for_cabin and resolved_cabin_id is not null then resolved_cabin_id else null end,
        rule_row.counts_for_ongoing,
        rule_row.counts_for_season,
        rule_row.counts_for_cabin and resolved_cabin_id is not null,
        'approved',
        coalesce(p_occurred_at, now()),
        coalesce(p_occurred_at, now())
      )
      returning id into transaction_id;

      if rule_row.counts_for_ongoing then
        update public.profiles
        set points = greatest(0, points + points_to_award),
            updated_at = now()
        where id = resolved_user_id;
      end if;

      if rule_action = 'camp_petition_challenge' and p_camp_submission_action_id is not null and p_season_id is not null and resolved_season_member_id is not null then
        select id into ledger_id
        from public.gpe_camp_points_ledger
        where submission_action_id = p_camp_submission_action_id
          and entry_type = 'challenge_award'
          and points > 0
        limit 1;

        if ledger_id is null then
          insert into public.gpe_camp_points_ledger (
            season_id,
            season_member_id,
            user_id,
            submission_id,
            submission_action_id,
            challenge_id,
            points,
            reason,
            adjustment_type,
            entry_type,
            source,
            counts_for_ongoing,
            counts_for_season,
            counts_for_cabin,
            cabin_id_at_award,
            approval_status,
            occurred_at,
            metadata
          )
          values (
            p_season_id,
            resolved_season_member_id,
            resolved_user_id,
            (select submission_id from public.gpe_camp_submission_actions where id = p_camp_submission_action_id),
            p_camp_submission_action_id,
            p_challenge_id,
            points_to_award,
            rule_row.display_name,
            'award',
            'challenge_award',
            'action_network_petition',
            rule_row.counts_for_ongoing,
            rule_row.counts_for_season,
            rule_row.counts_for_cabin and resolved_cabin_id is not null,
            resolved_cabin_id,
            'approved',
            coalesce(p_occurred_at, now()),
            pending_row.metadata || jsonb_build_object(
              'point_transaction_id', transaction_id,
              'pending_award_id', pending_row.id,
              'point_event_id', event_row.id
            )
          )
          returning id into ledger_id;
        end if;

        update public.gpe_camp_submission_actions
        set
          review_status = 'approved',
          approved_points = points_to_award,
          reviewed_at = coalesce(reviewed_at, now()),
          reviewer_notes = coalesce(reviewer_notes, 'Automatically approved from verified point event.')
        where id = p_camp_submission_action_id;

        update public.gpe_camp_challenge_submissions
        set
          user_id = coalesce(user_id, resolved_user_id),
          season_member_id = coalesce(season_member_id, resolved_season_member_id),
          review_status = 'approved',
          member_link_status = 'linked',
          reviewed_at = coalesce(reviewed_at, now())
        where id = (select submission_id from public.gpe_camp_submission_actions where id = p_camp_submission_action_id);
      end if;

      update public.gpe_pending_point_awards
      set status = 'claimed',
          user_id = resolved_user_id,
          season_member_id = coalesce(season_member_id, resolved_season_member_id),
          point_transaction_id = transaction_id,
          camp_ledger_id = coalesce(camp_ledger_id, ledger_id),
          claimed_at = now()
      where id = pending_row.id
      returning * into pending_row;

      status := 'awarded';
    end if;
  elsif pending_row.status = 'claimed' then
    status := 'awarded';
    transaction_id := pending_row.point_transaction_id;
    ledger_id := pending_row.camp_ledger_id;
  else
    status := 'pending_identity';
  end if;

  update public.gpe_point_events
  set user_id = coalesce(user_id, resolved_user_id),
      season_member_id = coalesce(season_member_id, resolved_season_member_id),
      points_status = status,
      point_transaction_id = coalesce(point_transaction_id, pending_row.point_transaction_id, transaction_id),
      pending_award_id = coalesce(pending_award_id, pending_row.id),
      camp_ledger_id = coalesce(camp_ledger_id, pending_row.camp_ledger_id, ledger_id),
      points_result = jsonb_build_object(
        'status', status,
        'eventType', normalized_event,
        'rule', rule_action,
        'points', points_to_award,
        'awardedPoints', case when status = 'awarded' then points_to_award else 0 end,
        'pendingPoints', case when status = 'pending_identity' then points_to_award else 0 end,
        'pointEventId', event_row.id,
        'pendingAwardId', pending_row.id,
        'transactionId', coalesce(pending_row.point_transaction_id, transaction_id),
        'ledgerId', coalesce(pending_row.camp_ledger_id, ledger_id),
        'totalPotential', points_to_award
      )
  where id = event_row.id
  returning * into event_row;

  if p_lead_action_id is not null then
    update public.lead_actions
    set user_id = coalesce(user_id, resolved_user_id),
        season_member_id = coalesce(season_member_id, resolved_season_member_id),
        pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object(
          'points', case when status = 'awarded' then 'success' when status = 'pending_identity' then 'pending' else status::text end,
          'hub', case when resolved_user_id is null then 'pending' else 'success' end
        )
    where id = p_lead_action_id;
  end if;

  return event_row.points_result;
end;
$$;

revoke all on function public.service_record_point_event(text, text, uuid, uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, timestamptz) from public;
grant execute on function public.service_record_point_event(text, text, uuid, uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, timestamptz) to service_role;

create or replace function public.service_finalize_petition_points(
  p_user_id uuid,
  p_lead_action_id uuid,
  p_submission_action_id uuid default null,
  p_season_id uuid default null,
  p_season_member_id uuid default null,
  p_challenge_id uuid default null,
  p_cabin_id uuid default null,
  p_campaign_slug text default null,
  p_petition_slug text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_row public.lead_actions%rowtype;
  lead_row public.constituent_leads%rowtype;
  general_result jsonb;
  camp_result jsonb := jsonb_build_object('status', 'not_applicable', 'points', 0, 'awardedPoints', 0, 'pendingPoints', 0);
  awarded_points integer := 0;
  pending_points integer := 0;
  total_potential integer := 0;
  final_status public.gpe_action_points_status := 'not_applicable'::public.gpe_action_points_status;
begin
  if p_lead_action_id is null then
    raise exception 'Petition point finalization requires lead_action_id.';
  end if;

  select * into action_row
  from public.lead_actions
  where id = p_lead_action_id
  for update;
  if not found then
    raise exception 'Lead action not found.';
  end if;

  select * into lead_row
  from public.constituent_leads
  where id = action_row.lead_id;

  general_result := public.service_record_point_event(
    'PETITION_SUBMITTED',
    lead_row.email_normalized,
    coalesce(p_user_id, action_row.user_id),
    p_lead_action_id,
    action_row.lead_id,
    'action_network_petition',
    p_lead_action_id,
    null,
    null,
    null,
    null,
    null,
    p_campaign_slug,
    p_petition_slug,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('finalizer', 'service_finalize_petition_points'),
    p_occurred_at
  );

  if p_challenge_id is not null and p_submission_action_id is not null then
    camp_result := public.service_record_point_event(
      'CAMP_PETITION_COMPLETED',
      lead_row.email_normalized,
      coalesce(p_user_id, action_row.user_id),
      p_lead_action_id,
      action_row.lead_id,
      'camp_petition_challenge',
      p_submission_action_id,
      p_season_id,
      coalesce(p_season_member_id, action_row.season_member_id),
      p_challenge_id,
      p_submission_action_id,
      p_cabin_id,
      p_campaign_slug,
      p_petition_slug,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('finalizer', 'service_finalize_petition_points'),
      p_occurred_at
    );
  end if;

  awarded_points := coalesce((general_result->>'awardedPoints')::integer, 0)
                  + coalesce((camp_result->>'awardedPoints')::integer, 0);
  pending_points := coalesce((general_result->>'pendingPoints')::integer, 0)
                  + coalesce((camp_result->>'pendingPoints')::integer, 0);
  total_potential := coalesce((general_result->>'totalPotential')::integer, coalesce((general_result->>'points')::integer, 0))
                   + coalesce((camp_result->>'totalPotential')::integer, coalesce((camp_result->>'points')::integer, 0));

  final_status := case
    when pending_points > 0 then 'pending_identity'::public.gpe_action_points_status
    when awarded_points > 0 then 'awarded'::public.gpe_action_points_status
    else 'not_applicable'::public.gpe_action_points_status
  end;

  update public.lead_actions
  set
    user_id = coalesce(user_id, p_user_id),
    season_member_id = coalesce(season_member_id, p_season_member_id),
    general_point_transaction_id = coalesce(general_point_transaction_id, nullif(general_result->>'transactionId', '')::uuid),
    camp_point_transaction_id = coalesce(camp_point_transaction_id, nullif(camp_result->>'transactionId', '')::uuid),
    camp_ledger_id = coalesce(camp_ledger_id, nullif(camp_result->>'ledgerId', '')::uuid),
    general_pending_award_id = coalesce(general_pending_award_id, nullif(general_result->>'pendingAwardId', '')::uuid),
    camp_pending_award_id = coalesce(camp_pending_award_id, nullif(camp_result->>'pendingAwardId', '')::uuid),
    points_status = final_status,
    completed_at = coalesce(completed_at, now()),
    points_result = coalesce(points_result, '{}'::jsonb) || jsonb_build_object(
      'status', final_status,
      'awardedPoints', awarded_points,
      'pendingPoints', pending_points,
      'general', general_result,
      'camp', camp_result,
      'total', awarded_points,
      'totalPotential', total_potential
    ),
    pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object(
      'points', case when pending_points > 0 then 'pending' when awarded_points > 0 then 'success' else 'not_applicable' end,
      'camp', case
        when p_challenge_id is null then 'not_applicable'
        when coalesce(camp_result->>'status', '') = 'awarded' then 'success'
        when coalesce(camp_result->>'status', '') = 'pending_identity' then 'pending'
        else coalesce(camp_result->>'status', 'not_applicable')
      end,
      'hub', case when coalesce(p_user_id, action_row.user_id) is null then 'pending' else 'success' end
    )
  where id = p_lead_action_id;

  return jsonb_build_object(
    'status', final_status,
    'awardedPoints', awarded_points,
    'pendingPoints', pending_points,
    'general', general_result,
    'camp', camp_result,
    'total', awarded_points,
    'totalPotential', total_potential
  );
end;
$$;

revoke all on function public.service_finalize_petition_points(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, timestamptz) from public;
grant execute on function public.service_finalize_petition_points(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, timestamptz) to service_role;

create or replace function public.service_attach_petition_history_to_profile(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  action_row public.lead_actions%rowtype;
  lead_row public.constituent_leads%rowtype;
  finalized jsonb;
  attached_count integer := 0;
  awarded_total integer := 0;
  resolved_attach_season_member_id uuid;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  select * into profile_row
  from public.profiles
  where id = p_profile_id;

  if not found then
    raise exception 'Profile not found.';
  end if;

  update public.constituent_leads
  set
    hub_profile_id = p_profile_id,
    neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id),
    hub_access = 'linked'
  where lower(email_normalized) = lower(coalesce(profile_row.email, ''))
     or (profile_row.neon_account_id is not null and neon_account_id = profile_row.neon_account_id);

  for action_row in
    select la.*
    from public.lead_actions la
    join public.constituent_leads cl on cl.id = la.lead_id
    where la.provider = 'action_network'
      and la.action_type = 'petition_signature'
      and (la.user_id is null or la.points_status = 'pending_identity')
      and (
        lower(cl.email_normalized) = lower(coalesce(profile_row.email, ''))
        or (profile_row.neon_account_id is not null and cl.neon_account_id = profile_row.neon_account_id)
      )
  loop
    select * into lead_row
    from public.constituent_leads
    where id = action_row.lead_id;

    resolved_attach_season_member_id := action_row.season_member_id;

    if action_row.season_id is not null and resolved_attach_season_member_id is null then
      select sm.id into resolved_attach_season_member_id
      from public.gpe_season_members sm
      where sm.season_id = action_row.season_id
        and (
          sm.user_id = p_profile_id
          or (profile_row.neon_account_id is not null and sm.neon_account_id = profile_row.neon_account_id)
          or lower(coalesce(sm.contact_email, '')) = lower(coalesce(profile_row.email, lead_row.email_normalized, ''))
        )
      order by case when sm.user_id = p_profile_id then 1 else 2 end
      limit 1;
    end if;

    if resolved_attach_season_member_id is not null then
      update public.gpe_season_members
      set user_id = coalesce(user_id, p_profile_id),
          neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id, lead_row.neon_account_id),
          contact_email = coalesce(contact_email, profile_row.email, lead_row.email_normalized),
          updated_at = now()
      where id = resolved_attach_season_member_id;
    end if;

    update public.lead_actions
    set
      user_id = p_profile_id,
      season_member_id = coalesce(lead_actions.season_member_id, resolved_attach_season_member_id),
      hub_identity_status = 'succeeded',
      pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object('hub', 'success')
    where id = action_row.id;

    finalized := public.service_finalize_petition_points(
      p_profile_id,
      action_row.id,
      action_row.camp_submission_action_id,
      action_row.season_id,
      resolved_attach_season_member_id,
      action_row.challenge_id,
      null,
      action_row.campaign_slug,
      action_row.action_slug,
      jsonb_build_object('linked_from_history', true, 'lead_action_id', action_row.id),
      action_row.occurred_at
    );

    attached_count := attached_count + 1;
    awarded_total := awarded_total + coalesce((finalized->>'awardedPoints')::integer, 0);
  end loop;

  return jsonb_build_object('attachedActions', attached_count, 'awardedPoints', awarded_total);
end;
$$;

revoke all on function public.service_attach_petition_history_to_profile(uuid) from public;
grant execute on function public.service_attach_petition_history_to_profile(uuid) to service_role;
