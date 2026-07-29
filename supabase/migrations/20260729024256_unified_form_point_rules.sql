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
  (
    'event_registered',
    'Event Registration',
    5,
    true,
    true,
    false,
    false,
    false,
    null,
    'source_once',
    null,
    null,
    null,
    'source_once',
    'Awarded after a verified event registration is matched or completed.',
    '{"category":"events","source":"neon_event"}'::jsonb
  ),
  (
    'survey_completed',
    'Survey Completed',
    10,
    true,
    true,
    false,
    false,
    false,
    null,
    'source_once',
    null,
    null,
    null,
    'source_once',
    'Awarded after a verified survey submission.',
    '{"category":"surveys","source":"neon_survey"}'::jsonb
  ),
  (
    'grad_highlight_submission',
    'Grad Highlight Submission',
    50,
    true,
    true,
    false,
    false,
    false,
    null,
    'source_once',
    null,
    null,
    null,
    'source_once',
    'Awarded after a verified Grad Highlight submission. Content moderation can still happen separately.',
    '{"category":"stories","source":"neon_form","review":"moderation_only"}'::jsonb
  )
on conflict (action_type) do update set
  display_name = excluded.display_name,
  point_value = excluded.point_value,
  active = excluded.active,
  counts_for_ongoing = excluded.counts_for_ongoing,
  counts_for_season = excluded.counts_for_season,
  counts_for_cabin = excluded.counts_for_cabin,
  requires_approval = excluded.requires_approval,
  duplicate_strategy = excluded.duplicate_strategy,
  duplicate_policy = excluded.duplicate_policy,
  notes = excluded.notes,
  metadata = public.hub_point_rules.metadata || excluded.metadata,
  updated_at = now();

update public.hub_point_rules
set point_value = 25,
    notes = 'Awarded after verified event attendance.',
    metadata = metadata || '{"category":"events","source":"neon_event","event":"EVENT_ATTENDED"}'::jsonb,
    updated_at = now()
where action_type = 'event_attendance'
  and point_value <> 25;
