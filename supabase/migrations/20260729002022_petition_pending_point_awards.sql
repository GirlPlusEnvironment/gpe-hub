create table if not exists public.gpe_pending_point_awards (
  id uuid primary key default gen_random_uuid(),
  lead_action_id uuid not null references public.lead_actions(id) on delete cascade,
  lead_id uuid references public.constituent_leads(id) on delete set null,
  email_normalized text not null,
  user_id uuid references public.profiles(id) on delete set null,
  rule_action_type text not null,
  source text not null,
  source_id uuid not null,
  points integer not null,
  status text not null default 'pending',
  campaign_slug text,
  petition_slug text,
  season_id uuid references public.gpe_seasons(id) on delete set null,
  season_member_id uuid references public.gpe_season_members(id) on delete set null,
  challenge_id uuid references public.gpe_challenges(id) on delete set null,
  camp_submission_action_id uuid references public.gpe_camp_submission_actions(id) on delete set null,
  point_transaction_id uuid references public.point_transactions(id) on delete set null,
  camp_ledger_id uuid references public.gpe_camp_points_ledger(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_pending_point_awards_points_positive check (points > 0),
  constraint gpe_pending_point_awards_status_check check (status in ('pending', 'claimed', 'duplicate', 'ineligible', 'failed')),
  constraint gpe_pending_point_awards_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists gpe_pending_point_awards_source_unique
  on public.gpe_pending_point_awards (rule_action_type, source, source_id);

create index if not exists gpe_pending_point_awards_email_status_idx
  on public.gpe_pending_point_awards (email_normalized, status, occurred_at desc);

create index if not exists gpe_pending_point_awards_user_status_idx
  on public.gpe_pending_point_awards (user_id, status, occurred_at desc)
  where user_id is not null;

create index if not exists gpe_pending_point_awards_lead_action_idx
  on public.gpe_pending_point_awards (lead_action_id, status);

drop trigger if exists update_gpe_pending_point_awards_updated_at on public.gpe_pending_point_awards;
create trigger update_gpe_pending_point_awards_updated_at
before update on public.gpe_pending_point_awards
for each row execute function public.update_updated_at_column();

alter table public.gpe_pending_point_awards enable row level security;

grant select on public.gpe_pending_point_awards to authenticated;
grant select, insert, update on public.gpe_pending_point_awards to service_role;

drop policy if exists "gpe_pending_point_awards_admin_read" on public.gpe_pending_point_awards;
create policy "gpe_pending_point_awards_admin_read"
on public.gpe_pending_point_awards
for select
to authenticated
using (public.is_admin(auth.uid()));

alter table public.lead_actions
  add column if not exists general_pending_award_id uuid references public.gpe_pending_point_awards(id) on delete set null,
  add column if not exists camp_pending_award_id uuid references public.gpe_pending_point_awards(id) on delete set null;

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
  general_rule public.hub_point_rules%rowtype;
  camp_rule public.hub_point_rules%rowtype;
  general_pending public.gpe_pending_point_awards%rowtype;
  camp_pending public.gpe_pending_point_awards%rowtype;
  general_tx uuid;
  camp_tx uuid;
  ledger_id uuid;
  resolved_user_id uuid := p_user_id;
  resolved_season_member_id uuid := p_season_member_id;
  resolved_cabin_id uuid := p_cabin_id;
  general_points integer := 0;
  camp_points integer := 0;
  awarded_points integer := 0;
  pending_points integer := 0;
  v_points_status public.gpe_action_points_status := 'pending_identity';
  v_email text;
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

  v_email := lower(coalesce(lead_row.email_normalized, ''));

  if resolved_user_id is null then
    resolved_user_id := action_row.user_id;
  end if;

  if resolved_user_id is null and v_email <> '' then
    select p.id into resolved_user_id
    from public.profiles p
    where lower(coalesce(p.email, '')) = v_email
       or (lead_row.neon_account_id is not null and p.neon_account_id = lead_row.neon_account_id)
    order by case
      when lead_row.neon_account_id is not null and p.neon_account_id = lead_row.neon_account_id then 1
      else 2
    end
    limit 1;
  end if;

  if resolved_season_member_id is null then
    resolved_season_member_id := action_row.season_member_id;
  end if;

  if resolved_user_id is not null and p_season_id is not null and resolved_season_member_id is null then
    select sm.id into resolved_season_member_id
    from public.gpe_season_members sm
    where sm.season_id = p_season_id
      and (
        sm.user_id = resolved_user_id
        or (lead_row.neon_account_id is not null and sm.neon_account_id = lead_row.neon_account_id)
        or lower(coalesce(sm.contact_email, '')) = v_email
      )
    order by case when sm.user_id = resolved_user_id then 1 else 2 end
    limit 1;
  end if;

  if resolved_user_id is not null and resolved_season_member_id is not null then
    update public.gpe_season_members
    set user_id = coalesce(user_id, resolved_user_id),
        neon_account_id = coalesce(neon_account_id, lead_row.neon_account_id),
        contact_email = coalesce(contact_email, v_email),
        updated_at = now()
    where id = resolved_season_member_id;
  end if;

  select * into general_rule
  from public.hub_point_rules
  where action_type = 'petition_signature'
    and active
    and (effective_start is null or effective_start <= coalesce(p_occurred_at, now()))
    and (effective_end is null or effective_end >= coalesce(p_occurred_at, now()))
  limit 1;

  if found and general_rule.point_value > 0 then
    general_points := general_rule.point_value;

    select id into general_tx
    from public.point_transactions
    where source = 'action_network_petition'
      and source_id = p_lead_action_id
      and points_earned > 0
    limit 1;

    insert into public.gpe_pending_point_awards (
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
      point_transaction_id,
      metadata,
      occurred_at,
      claimed_at
    )
    values (
      p_lead_action_id,
      action_row.lead_id,
      v_email,
      resolved_user_id,
      general_rule.action_type,
      'action_network_petition',
      p_lead_action_id,
      general_points,
      case when general_tx is null then 'pending' else 'claimed' end,
      p_campaign_slug,
      p_petition_slug,
      general_tx,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'reason', general_rule.display_name,
        'rule_action_type', general_rule.action_type,
        'rule_used', general_rule.action_type,
        'campaign_slug', p_campaign_slug,
        'petition_slug', p_petition_slug,
        'lead_action_id', p_lead_action_id,
        'duplicate_policy', coalesce(general_rule.duplicate_policy, general_rule.duplicate_strategy)
      ),
      coalesce(p_occurred_at, now()),
      case when general_tx is null then null else now() end
    )
    on conflict (rule_action_type, source, source_id) do update set
      lead_id = coalesce(public.gpe_pending_point_awards.lead_id, excluded.lead_id),
      email_normalized = coalesce(nullif(public.gpe_pending_point_awards.email_normalized, ''), excluded.email_normalized),
      user_id = coalesce(public.gpe_pending_point_awards.user_id, excluded.user_id),
      points = excluded.points,
      campaign_slug = coalesce(public.gpe_pending_point_awards.campaign_slug, excluded.campaign_slug),
      petition_slug = coalesce(public.gpe_pending_point_awards.petition_slug, excluded.petition_slug),
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
    returning * into general_pending;

    if resolved_user_id is not null and general_pending.point_transaction_id is null then
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
        general_points,
        'action_network_petition',
        p_lead_action_id,
        general_pending.metadata || jsonb_build_object('pending_award_id', general_pending.id),
        general_rule.action_type,
        case when general_rule.counts_for_season then coalesce(general_rule.season_override_id, general_rule.season_override, p_season_id) else null end,
        case when general_rule.counts_for_season then p_challenge_id else null end,
        case when general_rule.counts_for_season then resolved_season_member_id else null end,
        case when general_rule.counts_for_cabin then resolved_cabin_id else null end,
        general_rule.counts_for_ongoing,
        general_rule.counts_for_season,
        general_rule.counts_for_cabin and resolved_cabin_id is not null,
        'approved',
        coalesce(p_occurred_at, now()),
        coalesce(p_occurred_at, now())
      )
      returning id into general_tx;

      update public.gpe_pending_point_awards
      set status = 'claimed',
          user_id = resolved_user_id,
          point_transaction_id = general_tx,
          claimed_at = now()
      where id = general_pending.id
      returning * into general_pending;

      if general_rule.counts_for_ongoing then
        update public.profiles
        set points = greatest(0, points + general_points),
            updated_at = now()
        where id = resolved_user_id;
      end if;
    end if;
  end if;

  if p_challenge_id is not null and p_submission_action_id is not null then
    select * into camp_rule
    from public.hub_point_rules
    where action_type = 'camp_petition_challenge'
      and active
      and (effective_start is null or effective_start <= coalesce(p_occurred_at, now()))
      and (effective_end is null or effective_end >= coalesce(p_occurred_at, now()))
    limit 1;

    if found and camp_rule.point_value > 0 then
      camp_points := camp_rule.point_value;

      select id into camp_tx
      from public.point_transactions
      where source = 'camp_petition_challenge'
        and source_id = p_submission_action_id
        and points_earned > 0
      limit 1;

      if resolved_cabin_id is null and resolved_season_member_id is not null then
        select cabin_id into resolved_cabin_id
        from public.gpe_season_members
        where id = resolved_season_member_id;
      end if;

      insert into public.gpe_pending_point_awards (
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
        p_lead_action_id,
        action_row.lead_id,
        v_email,
        resolved_user_id,
        camp_rule.action_type,
        'camp_petition_challenge',
        p_submission_action_id,
        camp_points,
        case when camp_tx is null then 'pending' else 'claimed' end,
        p_campaign_slug,
        p_petition_slug,
        p_season_id,
        resolved_season_member_id,
        p_challenge_id,
        p_submission_action_id,
        camp_tx,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'reason', camp_rule.display_name,
          'rule_action_type', camp_rule.action_type,
          'rule_used', camp_rule.action_type,
          'campaign_slug', p_campaign_slug,
          'petition_slug', p_petition_slug,
          'lead_action_id', p_lead_action_id,
          'submission_action_id', p_submission_action_id,
          'challenge_id', p_challenge_id,
          'duplicate_policy', coalesce(camp_rule.duplicate_policy, camp_rule.duplicate_strategy)
        ),
        coalesce(p_occurred_at, now()),
        case when camp_tx is null then null else now() end
      )
      on conflict (rule_action_type, source, source_id) do update set
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
      returning * into camp_pending;

      if resolved_user_id is not null
         and resolved_season_member_id is not null
         and p_season_id is not null
         and camp_pending.point_transaction_id is null then
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
          camp_points,
          'camp_petition_challenge',
          p_submission_action_id,
          camp_pending.metadata || jsonb_build_object('pending_award_id', camp_pending.id),
          camp_rule.action_type,
          coalesce(camp_rule.season_override_id, camp_rule.season_override, p_season_id),
          p_challenge_id,
          resolved_season_member_id,
          case when camp_rule.counts_for_cabin and resolved_cabin_id is not null then resolved_cabin_id else null end,
          camp_rule.counts_for_ongoing,
          camp_rule.counts_for_season,
          camp_rule.counts_for_cabin and resolved_cabin_id is not null,
          'approved',
          coalesce(p_occurred_at, now()),
          coalesce(p_occurred_at, now())
        )
        returning id into camp_tx;

        if camp_rule.counts_for_ongoing then
          update public.profiles
          set points = greatest(0, points + camp_points),
              updated_at = now()
          where id = resolved_user_id;
        end if;

        select id into ledger_id
        from public.gpe_camp_points_ledger
        where submission_action_id = p_submission_action_id
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
            (select submission_id from public.gpe_camp_submission_actions where id = p_submission_action_id),
            p_submission_action_id,
            p_challenge_id,
            camp_points,
            camp_rule.display_name,
            'award',
            'challenge_award',
            'action_network_petition',
            camp_rule.counts_for_ongoing,
            camp_rule.counts_for_season,
            camp_rule.counts_for_cabin and resolved_cabin_id is not null,
            resolved_cabin_id,
            'approved',
            coalesce(p_occurred_at, now()),
            camp_pending.metadata || jsonb_build_object(
              'point_transaction_id', camp_tx,
              'pending_award_id', camp_pending.id
            )
          )
          returning id into ledger_id;
        end if;

        update public.gpe_pending_point_awards
        set status = 'claimed',
            user_id = resolved_user_id,
            season_member_id = resolved_season_member_id,
            point_transaction_id = camp_tx,
            camp_ledger_id = ledger_id,
            claimed_at = now()
        where id = camp_pending.id
        returning * into camp_pending;

        update public.gpe_camp_submission_actions
        set
          review_status = 'approved',
          approved_points = camp_points,
          reviewed_at = coalesce(reviewed_at, now()),
          reviewer_notes = coalesce(reviewer_notes, 'Automatically approved from verified Action Network petition submission.')
        where id = p_submission_action_id;

        update public.gpe_camp_challenge_submissions
        set
          user_id = coalesce(user_id, resolved_user_id),
          season_member_id = coalesce(season_member_id, resolved_season_member_id),
          review_status = 'approved',
          member_link_status = 'linked',
          reviewed_at = coalesce(reviewed_at, now())
        where id = (select submission_id from public.gpe_camp_submission_actions where id = p_submission_action_id);
      end if;
    end if;
  end if;

  awarded_points := coalesce((select sum(points) from public.gpe_pending_point_awards where lead_action_id = p_lead_action_id and status = 'claimed'), 0);
  pending_points := coalesce((select sum(points) from public.gpe_pending_point_awards where lead_action_id = p_lead_action_id and status = 'pending'), 0);

  v_points_status := case
    when pending_points > 0 then 'pending_identity'::public.gpe_action_points_status
    when awarded_points > 0 then 'awarded'::public.gpe_action_points_status
    else 'not_applicable'::public.gpe_action_points_status
  end;

  update public.lead_actions
  set
    user_id = coalesce(user_id, resolved_user_id),
    season_member_id = coalesce(season_member_id, resolved_season_member_id),
    general_point_transaction_id = coalesce(general_point_transaction_id, general_tx, general_pending.point_transaction_id),
    camp_point_transaction_id = coalesce(camp_point_transaction_id, camp_tx, camp_pending.point_transaction_id),
    camp_ledger_id = coalesce(camp_ledger_id, ledger_id, camp_pending.camp_ledger_id),
    general_pending_award_id = coalesce(general_pending_award_id, general_pending.id),
    camp_pending_award_id = coalesce(camp_pending_award_id, camp_pending.id),
    points_status = v_points_status,
    completed_at = coalesce(completed_at, now()),
    points_result = coalesce(points_result, '{}'::jsonb) || jsonb_build_object(
      'status', v_points_status,
      'awardedPoints', awarded_points,
      'pendingPoints', pending_points,
      'general', jsonb_build_object(
        'status', case
          when general_pending.id is null then 'not_applicable'
          when general_pending.status = 'claimed' then 'awarded'
          else 'pending_identity'
        end,
        'points', coalesce(general_pending.points, 0),
        'rule', 'petition_signature',
        'pendingAwardId', general_pending.id,
        'transactionId', general_pending.point_transaction_id
      ),
      'camp', jsonb_build_object(
        'status', case
          when p_challenge_id is null then 'not_applicable'
          when camp_pending.id is null then 'not_applicable'
          when camp_pending.status = 'claimed' then 'awarded'
          else 'pending_identity'
        end,
        'points', coalesce(camp_pending.points, 0),
        'rule', 'camp_petition_challenge',
        'pendingAwardId', camp_pending.id,
        'transactionId', camp_pending.point_transaction_id,
        'ledgerId', camp_pending.camp_ledger_id,
        'challengeId', p_challenge_id
      ),
      'total', awarded_points,
      'totalPotential', awarded_points + pending_points
    ),
    pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object(
      'points', case when pending_points > 0 then 'pending' when awarded_points > 0 then 'success' else 'not_applicable' end,
      'camp', case
        when p_challenge_id is null then 'not_applicable'
        when camp_pending.id is null then 'not_applicable'
        when camp_pending.status = 'claimed' then 'success'
        else 'pending'
      end,
      'hub', case when resolved_user_id is null then 'pending' else 'success' end
    )
  where id = p_lead_action_id;

  return jsonb_build_object(
    'status', v_points_status,
    'awardedPoints', awarded_points,
    'pendingPoints', pending_points,
    'general', jsonb_build_object(
      'status', case
        when general_pending.id is null then 'not_applicable'
        when general_pending.status = 'claimed' then 'awarded'
        else 'pending_identity'
      end,
      'points', coalesce(general_pending.points, 0),
      'pendingAwardId', general_pending.id,
      'transactionId', general_pending.point_transaction_id
    ),
    'camp', jsonb_build_object(
      'status', case
        when p_challenge_id is null then 'not_applicable'
        when camp_pending.id is null then 'not_applicable'
        when camp_pending.status = 'claimed' then 'awarded'
        else 'pending_identity'
      end,
      'points', coalesce(camp_pending.points, 0),
      'pendingAwardId', camp_pending.id,
      'transactionId', camp_pending.point_transaction_id,
      'ledgerId', camp_pending.camp_ledger_id
    ),
    'total', awarded_points,
    'totalPotential', awarded_points + pending_points
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
