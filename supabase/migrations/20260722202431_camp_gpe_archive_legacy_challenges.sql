begin;

with camp_season as (
  select id
  from public.gpe_seasons
  where slug = 'camp-gpe-2026'
  limit 1
),
intended_schedule(slug) as (
  values
    ('beat-heat-extreme-weather-petition'),
    ('beat-heat-story-sticker'),
    ('beat-heat-short-video'),
    ('tell-your-story-climate-story'),
    ('tell-your-story-camp-graphics'),
    ('tell-your-story-encourage-petition-signatures'),
    ('sign-high-energy-bills-petition'),
    ('energy-justice-utility-costs-video'),
    ('energy-justice-share-energy-bill-fact'),
    ('finish-strong-favorite-lesson'),
    ('finish-strong-final-petitions'),
    ('finish-strong-advocacy-reflection')
)
update public.gpe_challenges challenge
set
  is_active = false,
  is_public = false,
  is_hub_visible = false,
  updated_at = now()
from camp_season
where challenge.season_id = camp_season.id
  and challenge.slug not in (select slug from intended_schedule);

commit;
