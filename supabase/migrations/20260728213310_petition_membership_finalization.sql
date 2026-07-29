alter table public.hub_point_rules
  add column if not exists season_override_id uuid references public.gpe_seasons(id) on delete set null,
  add column if not exists lifetime_cap integer,
  add column if not exists daily_cap integer,
  add column if not exists duplicate_policy text,
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hub_point_rules_lifetime_cap_check'
      and conrelid = 'public.hub_point_rules'::regclass
  ) then
    alter table public.hub_point_rules
      add constraint hub_point_rules_lifetime_cap_check
      check (lifetime_cap is null or lifetime_cap >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'hub_point_rules_daily_cap_check'
      and conrelid = 'public.hub_point_rules'::regclass
  ) then
    alter table public.hub_point_rules
      add constraint hub_point_rules_daily_cap_check
      check (daily_cap is null or daily_cap >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'hub_point_rules_duplicate_policy_check'
      and conrelid = 'public.hub_point_rules'::regclass
  ) then
    alter table public.hub_point_rules
      add constraint hub_point_rules_duplicate_policy_check
      check (duplicate_policy is null or duplicate_policy in ('source_once', 'daily_cap', 'lifetime_cap', 'manual_review', 'unlimited'));
  end if;
end;
$$;

update public.hub_point_rules
set
  season_override_id = coalesce(season_override_id, season_override),
  duplicate_policy = coalesce(duplicate_policy, duplicate_strategy),
  daily_cap = coalesce(daily_cap, case when duplicate_strategy = 'daily_cap' then max_awards_per_user else null end),
  lifetime_cap = coalesce(lifetime_cap, case when duplicate_strategy in ('source_once', 'manual_review') then max_awards_per_user else null end)
where duplicate_policy is null
   or season_override_id is null
   or daily_cap is null
   or lifetime_cap is null;

insert into public.hub_point_rules (
  action_type,
  display_name,
  point_value,
  active,
  counts_for_ongoing,
  counts_for_season,
  counts_for_cabin,
  requires_approval,
  max_awards_per_user,
  duplicate_strategy,
  season_override_id,
  lifetime_cap,
  daily_cap,
  duplicate_policy,
  notes,
  metadata
)
values
  ('petition_signature', 'General Petition Submitted', 5, true, true, false, false, false, null, 'source_once', null, null, null, 'source_once', 'Awarded after a verified Action Network petition submission.', '{"source":"action_network","category":"petitions"}'::jsonb),
  ('camp_petition_challenge', 'Camp Petition Challenge', 5, true, false, true, true, false, null, 'source_once', null, null, null, 'source_once', 'Awarded when the Action Network petition is mapped to an active Camp GPE challenge.', '{"source":"action_network","category":"camp"}'::jsonb),
  ('action_network_letter', 'Letter Submitted', 5, true, true, false, false, false, null, 'source_once', null, null, null, 'source_once', 'Editable rule for Action Network letter submissions.', '{"source":"action_network","category":"letters"}'::jsonb),
  ('event_attendance', 'Event Attendance', 10, true, true, false, false, false, null, 'source_once', null, null, null, 'source_once', 'Editable rule for event attendance.', '{"category":"events"}'::jsonb),
  ('office_hours_attendance', 'Office Hours Attendance', 5, true, true, false, false, false, null, 'source_once', null, null, null, 'source_once', 'Editable rule for office hours participation.', '{"category":"office_hours"}'::jsonb),
  ('volunteer_shift', 'Volunteer Action', 10, true, true, false, false, false, null, 'source_once', null, null, null, 'source_once', 'Editable rule for volunteer activity.', '{"category":"volunteer"}'::jsonb),
  ('story_submission', 'Story Submission', 15, true, true, false, false, false, null, 'source_once', null, null, null, 'source_once', 'Editable rule for member story submissions.', '{"category":"stories"}'::jsonb),
  ('camp_challenge_completion', 'Challenge Submission', 5, true, false, true, true, false, null, 'source_once', null, null, null, 'source_once', 'Editable rule for Camp GPE challenge completion.', '{"category":"camp"}'::jsonb),
  ('recruit_member', 'Recruit a Member', 20, true, true, false, false, false, null, 'source_once', null, null, null, 'source_once', 'Editable rule for member recruitment.', '{"category":"recruitment"}'::jsonb),
  ('community_post', 'Community Post', 5, false, true, false, false, false, 1, 'daily_cap', null, null, 1, 'daily_cap', 'Editable rule for community posts. Disabled by default to prevent farming.', '{"category":"community"}'::jsonb),
  ('creator_content', 'Creator Content', 10, true, true, false, false, false, null, 'source_once', null, null, null, 'source_once', 'Editable rule for creator content.', '{"category":"creator"}'::jsonb),
  ('mentorship_session', 'Mentorship Session', 10, true, true, false, false, false, null, 'source_once', null, null, null, 'source_once', 'Editable rule for mentorship participation.', '{"category":"mentorship"}'::jsonb)
on conflict (action_type) do update set
  display_name = excluded.display_name,
  point_value = excluded.point_value,
  active = excluded.active,
  counts_for_ongoing = excluded.counts_for_ongoing,
  counts_for_season = excluded.counts_for_season,
  counts_for_cabin = excluded.counts_for_cabin,
  requires_approval = excluded.requires_approval,
  max_awards_per_user = excluded.max_awards_per_user,
  duplicate_strategy = excluded.duplicate_strategy,
  season_override_id = coalesce(public.hub_point_rules.season_override_id, excluded.season_override_id),
  lifetime_cap = coalesce(public.hub_point_rules.lifetime_cap, excluded.lifetime_cap),
  daily_cap = coalesce(public.hub_point_rules.daily_cap, excluded.daily_cap),
  duplicate_policy = coalesce(public.hub_point_rules.duplicate_policy, excluded.duplicate_policy),
  notes = coalesce(public.hub_point_rules.notes, excluded.notes),
  metadata = public.hub_point_rules.metadata || excluded.metadata,
  updated_at = now();

alter table public.lead_actions
  add column if not exists camp_submission_id uuid references public.gpe_camp_challenge_submissions(id) on delete set null,
  add column if not exists camp_submission_action_id uuid references public.gpe_camp_submission_actions(id) on delete set null,
  add column if not exists season_id uuid references public.gpe_seasons(id) on delete set null,
  add column if not exists season_member_id uuid references public.gpe_season_members(id) on delete set null,
  add column if not exists challenge_id uuid references public.gpe_challenges(id) on delete set null,
  add column if not exists neon_activity_id text,
  add column if not exists general_point_transaction_id uuid references public.point_transactions(id) on delete set null,
  add column if not exists camp_point_transaction_id uuid references public.point_transactions(id) on delete set null,
  add column if not exists camp_ledger_id uuid references public.gpe_camp_points_ledger(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists pipeline_status jsonb not null default '{}'::jsonb;

alter table public.gpe_form_submissions
  add column if not exists points_result jsonb not null default '{}'::jsonb,
  add column if not exists completed_at timestamptz;

create index if not exists lead_actions_pipeline_idx
  on public.lead_actions (provider, action_type, points_status, occurred_at desc);

create index if not exists lead_actions_user_points_idx
  on public.lead_actions (user_id, points_status, occurred_at desc)
  where user_id is not null;

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
  general_rule public.hub_point_rules%rowtype;
  camp_rule public.hub_point_rules%rowtype;
  general_tx uuid;
  camp_tx uuid;
  ledger_id uuid;
  resolved_cabin_id uuid := p_cabin_id;
  general_points integer := 0;
  camp_points integer := 0;
  total_points integer := 0;
  v_points_status public.gpe_action_points_status := 'pending_identity';
begin
  if p_lead_action_id is null then
    raise exception 'Petition point finalization requires lead_action_id.';
  end if;

  if p_user_id is null then
    update public.lead_actions
    set
      points_status = 'pending_identity',
      points_result = coalesce(points_result, '{}'::jsonb) || jsonb_build_object(
        'status', 'pending_identity',
        'reason', 'No Hub profile exists for this signer yet.',
        'general', jsonb_build_object('status', 'pending_identity'),
        'camp', jsonb_build_object('status', case when p_challenge_id is null then 'not_applicable' else 'pending_identity' end),
        'total', 0
      ),
      pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object(
        'points', 'pending_identity',
        'hub', 'pending'
      )
    where id = p_lead_action_id;

    return jsonb_build_object(
      'status', 'pending_identity',
      'awardedPoints', 0,
      'general', jsonb_build_object('status', 'pending_identity', 'points', 0),
      'camp', jsonb_build_object('status', case when p_challenge_id is null then 'not_applicable' else 'pending_identity' end, 'points', 0)
    );
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

    if general_tx is null then
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
        general_points,
        'action_network_petition',
        p_lead_action_id,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'reason', general_rule.display_name,
          'rule_action_type', general_rule.action_type,
          'rule_used', general_rule.action_type,
          'campaign_slug', p_campaign_slug,
          'petition_slug', p_petition_slug,
          'lead_action_id', p_lead_action_id,
          'duplicate_policy', coalesce(general_rule.duplicate_policy, general_rule.duplicate_strategy)
        ),
        general_rule.action_type,
        case when general_rule.counts_for_season then coalesce(general_rule.season_override_id, general_rule.season_override, p_season_id) else null end,
        case when general_rule.counts_for_season then p_challenge_id else null end,
        case when general_rule.counts_for_season then p_season_member_id else null end,
        case when general_rule.counts_for_cabin then resolved_cabin_id else null end,
        general_rule.counts_for_ongoing,
        general_rule.counts_for_season,
        general_rule.counts_for_cabin and resolved_cabin_id is not null,
        'approved',
        coalesce(p_occurred_at, now()),
        coalesce(p_occurred_at, now())
      )
      returning id into general_tx;

      if general_rule.counts_for_ongoing then
        update public.profiles
        set points = greatest(0, points + general_points),
            updated_at = now()
        where id = p_user_id;
      end if;
    end if;
  end if;

  if p_challenge_id is not null and p_submission_action_id is not null and p_season_id is not null and p_season_member_id is not null then
    if resolved_cabin_id is null then
      select cabin_id into resolved_cabin_id
      from public.gpe_season_members
      where id = p_season_member_id;
    end if;

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

      if camp_tx is null then
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
          camp_points,
          'camp_petition_challenge',
          p_submission_action_id,
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
          camp_rule.action_type,
          coalesce(camp_rule.season_override_id, camp_rule.season_override, p_season_id),
          p_challenge_id,
          p_season_member_id,
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
          where id = p_user_id;
        end if;
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
          p_season_member_id,
          p_user_id,
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
          coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
            'rule_action_type', camp_rule.action_type,
            'rule_used', camp_rule.action_type,
            'point_transaction_id', camp_tx,
            'lead_action_id', p_lead_action_id,
            'campaign_slug', p_campaign_slug,
            'petition_slug', p_petition_slug
          )
        )
        returning id into ledger_id;
      end if;

      update public.gpe_camp_submission_actions
      set
        review_status = 'approved',
        approved_points = camp_points,
        reviewed_at = coalesce(reviewed_at, now()),
        reviewer_notes = coalesce(reviewer_notes, 'Automatically approved from verified Action Network petition submission.')
      where id = p_submission_action_id;

      update public.gpe_camp_challenge_submissions
      set
        review_status = 'approved',
        member_link_status = 'linked',
        reviewed_at = coalesce(reviewed_at, now())
      where id = (select submission_id from public.gpe_camp_submission_actions where id = p_submission_action_id);
    end if;
  end if;

  total_points := case when general_tx is not null then general_points else 0 end
                + case when camp_tx is not null then camp_points else 0 end;
  v_points_status := case
    when total_points > 0 then 'awarded'::public.gpe_action_points_status
    else 'not_applicable'::public.gpe_action_points_status
  end;

  update public.lead_actions
  set
    user_id = coalesce(user_id, p_user_id),
    general_point_transaction_id = coalesce(general_point_transaction_id, general_tx),
    camp_point_transaction_id = coalesce(camp_point_transaction_id, camp_tx),
    camp_ledger_id = coalesce(camp_ledger_id, ledger_id),
    points_status = v_points_status,
    completed_at = coalesce(completed_at, now()),
    points_result = coalesce(points_result, '{}'::jsonb) || jsonb_build_object(
      'status', v_points_status,
      'awardedPoints', total_points,
      'general', jsonb_build_object(
        'status', case when general_tx is null then 'not_applicable' else 'awarded' end,
        'points', case when general_tx is null then 0 else general_points end,
        'rule', 'petition_signature',
        'transactionId', general_tx
      ),
      'camp', jsonb_build_object(
        'status', case
          when p_challenge_id is null then 'not_applicable'
          when camp_tx is null then 'not_awarded'
          else 'awarded'
        end,
        'points', case when camp_tx is null then 0 else camp_points end,
        'rule', 'camp_petition_challenge',
        'transactionId', camp_tx,
        'ledgerId', ledger_id,
        'challengeId', p_challenge_id
      ),
      'total', total_points
    ),
    pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object(
      'points', case when total_points > 0 then 'success' else 'not_applicable' end,
      'camp', case when p_challenge_id is null then 'not_applicable' when camp_tx is null then 'pending' else 'success' end,
      'hub', 'success'
    )
  where id = p_lead_action_id;

  return jsonb_build_object(
    'status', v_points_status,
    'awardedPoints', total_points,
    'general', jsonb_build_object('status', case when general_tx is null then 'not_applicable' else 'awarded' end, 'points', case when general_tx is null then 0 else general_points end, 'transactionId', general_tx),
    'camp', jsonb_build_object('status', case when p_challenge_id is null then 'not_applicable' when camp_tx is null then 'not_awarded' else 'awarded' end, 'points', case when camp_tx is null then 0 else camp_points end, 'transactionId', camp_tx, 'ledgerId', ledger_id),
    'total', total_points
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
  finalized jsonb;
  attached_count integer := 0;
  awarded_total integer := 0;
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
    update public.lead_actions
    set
      user_id = p_profile_id,
      hub_identity_status = 'succeeded',
      pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object('hub', 'success')
    where id = action_row.id;

    finalized := public.service_finalize_petition_points(
      p_profile_id,
      action_row.id,
      action_row.camp_submission_action_id,
      action_row.season_id,
      action_row.season_member_id,
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

create or replace function public.admin_get_member_point_history_v2(
  p_profile_id uuid,
  p_season_id uuid default null,
  p_limit integer default 25
)
returns table (
  transaction_id uuid,
  points integer,
  action_type text,
  source text,
  source_id uuid,
  reason text,
  admin_note text,
  counts_for_ongoing boolean,
  counts_for_season boolean,
  counts_for_cabin boolean,
  approval_status text,
  season_id uuid,
  season_member_id uuid,
  challenge_id uuid,
  challenge_title text,
  cabin_id uuid,
  campaign_slug text,
  petition_slug text,
  rule_used text,
  occurred_at timestamptz,
  created_at timestamptz,
  awarded_by uuid,
  reversed_by_transaction_id uuid,
  reverses_transaction_id uuid,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to view point history.';
  end if;

  return query
  select
    pt.id,
    pt.points_earned,
    pt.action_type,
    pt.source,
    pt.source_id,
    coalesce(pt.metadata->>'reason', rule.display_name, pt.metadata->>'rule_action_type', pt.action_type, pt.source) as reason,
    pt.metadata->>'admin_note' as admin_note,
    pt.counts_for_ongoing,
    pt.counts_for_season,
    pt.counts_for_cabin,
    pt.approval_status,
    pt.season_id,
    pt.season_member_id,
    pt.challenge_id,
    challenge.title as challenge_title,
    pt.cabin_id,
    coalesce(pt.metadata->>'campaign_slug', la.campaign_slug) as campaign_slug,
    coalesce(pt.metadata->>'petition_slug', la.action_slug) as petition_slug,
    coalesce(pt.metadata->>'rule_used', pt.metadata->>'rule_action_type', pt.action_type) as rule_used,
    pt.occurred_at,
    pt.created_at,
    nullif(pt.metadata->>'awarded_by', '')::uuid as awarded_by,
    nullif(pt.metadata->>'reversal_transaction_id', '')::uuid as reversed_by_transaction_id,
    nullif(pt.metadata->>'reverses_transaction_id', '')::uuid as reverses_transaction_id,
    coalesce(pt.metadata, '{}'::jsonb) as metadata
  from public.point_transactions pt
  left join public.hub_point_rules rule on rule.action_type = pt.action_type
  left join public.gpe_challenges challenge on challenge.id = pt.challenge_id
  left join public.lead_actions la
    on (pt.source = 'action_network_petition' and la.id = pt.source_id)
    or (pt.source = 'camp_petition_challenge' and la.camp_submission_action_id = pt.source_id)
  where pt.user_id = p_profile_id
    and (p_season_id is null or pt.season_id = p_season_id or pt.season_id is null)
  order by pt.occurred_at desc, pt.created_at desc
  limit greatest(coalesce(p_limit, 25), 1);
end;
$$;

revoke all on function public.admin_get_member_point_history_v2(uuid, uuid, integer) from public;
grant execute on function public.admin_get_member_point_history_v2(uuid, uuid, integer) to authenticated;

create or replace function public.attach_petition_history_after_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null then
    perform public.service_attach_petition_history_to_profile(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_attach_petition_history on public.profiles;
create trigger profiles_attach_petition_history
after insert or update of email, neon_account_id on public.profiles
for each row
execute function public.attach_petition_history_after_profile_change();
