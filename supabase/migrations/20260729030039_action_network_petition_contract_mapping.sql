update public.gpe_form_registry
set
  general_points = 5,
  camp_points = 5,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'point_rule', 'petition_signature',
    'camp_rule', 'camp_petition_challenge',
    'action_type', 'petition_signature',
    'completion_card', jsonb_build_object(
      'verifiedTitle', 'Action Complete',
      'verifiedMessage', 'Thanks for taking action!',
      'pendingMessage', 'Points saved. Create or connect a Hub account anytime to claim them.'
    )
  )
where provider = 'action_network'
  and provider_action_id in (
    'extreme-weather-puts-our-communities-at-risk-its-time-for-bold-climate-action-2',
    'tell-congress-we-need-relief-from-high-energy-bills-partner',
    'stop-trumps-700-million-coal-slush-fund-partner'
  );

update public.gpe_challenges
set
  is_active = true,
  point_value = 5,
  requires_review = false,
  requires_proof = false,
  auto_approve = true,
  instructions = 'Sign the verified Action Network petition. Points are awarded automatically after webhook confirmation.',
  updated_at = now()
where external_source = 'action_network'
  and external_action_slug in (
    'extreme-weather-puts-our-communities-at-risk-its-time-for-bold-climate-action-2',
    'tell-congress-we-need-relief-from-high-energy-bills-partner',
    'stop-trumps-700-million-coal-slush-fund-partner'
  );
