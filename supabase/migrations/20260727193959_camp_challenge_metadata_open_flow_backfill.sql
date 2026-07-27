alter table public.gpe_challenges
add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.gpe_challenges
drop constraint if exists gpe_challenges_metadata_object;

alter table public.gpe_challenges
add constraint gpe_challenges_metadata_object
check (jsonb_typeof(metadata) = 'object');

update public.gpe_challenges
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{definition}',
  coalesce(metadata->'definition', '{}'::jsonb)
  || jsonb_build_object(
    'open_flow',
    coalesce(metadata#>'{definition,open_flow}', '{}'::jsonb)
    || jsonb_build_object(
      'kind',
      case
        when coalesce(submission_type, category, '') ilike '%petition%' or related_kind = 'petition' then 'external_action'
        when related_kind = 'toolkit' then 'toolkit'
        else 'submission_form'
      end,
      'type',
      case
        when coalesce(submission_type, category, '') ilike '%petition%' or related_kind = 'petition' then 'external_action'
        when related_kind = 'toolkit' then 'toolkit'
        else 'submission_form'
      end,
      'label',
      coalesce(cta_label, case
        when coalesce(submission_type, category, '') ilike '%petition%' or related_kind = 'petition' then 'Open Petition'
        when related_kind = 'toolkit' then 'Open Toolkit'
        else 'Submit Challenge'
      end),
      'url',
      coalesce(related_url, action_url, ''),
      'secondary_label',
      'Submit for Points',
      'secondary_url',
      '/camp-gpe/challenges/' || slug || '/submit'
    ),
    'submission',
    coalesce(metadata#>'{definition,submission}', '{}'::jsonb)
    || jsonb_build_object(
      'enabled',
      true,
      'type',
      coalesce(submission_type, category, 'proof'),
      'title',
      'Submit Your Challenge',
      'instructions',
      coalesce(short_description, instructions, 'Share your proof and Team GPE will review it.')
    )
  ),
  true
)
where metadata->'definition' is null
   or metadata#>'{definition,open_flow}' is null
   or metadata#>'{definition,submission}' is null
   or metadata#>>'{definition,submission,enabled}' is null;
