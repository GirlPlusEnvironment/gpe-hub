-- Hub listing submissions now award points only after Team GPE approval through
-- hub-listing-review -> service_record_point_event(...). The older job insert
-- trigger fires during pending-review creation and can reject valid submissions
-- with "Not authorized to award Hub points."
drop trigger if exists listings_award_job_points on public.listings;

update public.hub_point_rules
set active = false,
    notes = coalesce(notes || E'\n', '') || 'Disabled 2026-08-04: superseded by review-gated job_approved point event.',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'disabled_at', '2026-08-04T00:00:00Z',
      'disabled_reason', 'superseded_by_review_gated_job_approved',
      'replacement_rule', 'job_approved'
    ),
    updated_at = now()
where action_type = 'job_submission'
  and coalesce(metadata->>'source', '') = 'listing_insert_trigger';
