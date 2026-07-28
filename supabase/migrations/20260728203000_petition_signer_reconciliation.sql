alter table public.lead_actions
  add column if not exists neon_activity_id text,
  add column if not exists invitation_status public.gpe_form_sync_status not null default 'not_attempted',
  add column if not exists reconciliation_error text,
  add column if not exists reconciled_at timestamptz;

create index if not exists lead_actions_reconciliation_idx
  on public.lead_actions (provider, neon_sync_status, invitation_status, points_status, created_at desc);

create or replace function public.service_award_petition_signature_points(
  p_user_id uuid,
  p_lead_action_id uuid,
  p_points integer default 5,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  transaction_id uuid;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'missing_user');
  end if;
  if p_lead_action_id is null then
    return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'missing_source');
  end if;
  if coalesce(p_points, 0) <= 0 then
    return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'invalid_points');
  end if;

  select id into transaction_id
  from public.point_transactions
  where source = 'action_network_petition'
    and source_id = p_lead_action_id
    and points_earned > 0
  limit 1;

  if transaction_id is not null then
    return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'duplicate_source', 'transaction_id', transaction_id);
  end if;

  insert into public.point_transactions (
    user_id,
    points_earned,
    source,
    source_id,
    metadata,
    action_type,
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
    'action_network_petition',
    p_lead_action_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('rule_action_type', 'petition_signature', 'reconciled', true),
    'petition_signature',
    true,
    false,
    false,
    'approved',
    coalesce(p_occurred_at, now()),
    now()
  )
  returning id into transaction_id;

  update public.profiles
  set points = greatest(0, coalesce(points, 0) + p_points),
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'awarded', true, 'transaction_id', transaction_id, 'points', p_points);
end;
$$;

revoke all on function public.service_award_petition_signature_points(uuid, uuid, integer, jsonb, timestamptz) from public;
grant execute on function public.service_award_petition_signature_points(uuid, uuid, integer, jsonb, timestamptz) to service_role;

insert into public.gpe_form_registry (
  slug,
  title,
  provider,
  route_url,
  destination_url,
  provider_action_id,
  campaign_slug,
  source_page,
  membership_prompt_enabled,
  general_points,
  camp_points,
  status,
  metadata
)
values
  ('high-energy-bills-action', 'High Energy Bills Action', 'action_network', 'https://www.girlplusenvironment.org/high-energy-bills-action/', 'https://actionnetwork.org/letters/tell-congress-we-need-relief-from-high-energy-bills-partner/?source=GPE', 'tell-congress-we-need-relief-from-high-energy-bills-partner', 'high-energy-bills', 'high-energy-bills-action.html', false, 5, 10, 'live', '{"completion_endpoint":"camp-gpe-challenge-submit"}'::jsonb),
  ('coal-slush-fund-action', 'Coal Slush Fund Action', 'action_network', null, 'https://actionnetwork.org/petitions/stop-trumps-700-million-coal-slush-fund-partner?source=Girl%20Plus%20Environment', 'stop-trumps-700-million-coal-slush-fund-partner', 'coal-slush-fund', null, false, 5, 10, 'live', '{"completion_endpoint":"camp-gpe-challenge-submit"}'::jsonb)
on conflict (slug) do update set
  title = excluded.title,
  provider = excluded.provider,
  route_url = excluded.route_url,
  destination_url = excluded.destination_url,
  provider_action_id = excluded.provider_action_id,
  campaign_slug = excluded.campaign_slug,
  source_page = excluded.source_page,
  membership_prompt_enabled = excluded.membership_prompt_enabled,
  general_points = excluded.general_points,
  camp_points = excluded.camp_points,
  status = excluded.status,
  metadata = public.gpe_form_registry.metadata || excluded.metadata,
  updated_at = now();
