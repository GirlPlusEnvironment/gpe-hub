# Sync Pipeline Audit

Date: 2026-07-30

## Diagnosis

The current launch risk is the downstream synchronization pipeline, not the isolated lifecycle email logic.

The repeated symptom pattern is:

- External provider or frontend submission completes.
- Supabase may store the payload.
- Neon Activity/form write may fail or be skipped.
- Points stay pending or verifying.
- Resend confirmation may not run.
- UI may still show success because later stages were not tracked independently.

## Existing Status Store

No new table was added. The production table `public.gpe_form_sync_logs` already supports the required sync status model:

| Column | Purpose |
| --- | --- |
| `submission_id` | Links the stage to `gpe_form_submissions`. |
| `integration` | Pipeline area, for example `pipeline`, `neon`, `membership`, `hub`, `points`, `email`. |
| `operation` | Exact stage, for example `submission_received`, `petition_activity`, `finalize_petition_points`, `resend_petition_confirmation`. |
| `success` | Stage result. |
| `response_summary` | Short created-ID or status summary. |
| `error_summary` | Safe failure summary. |
| `created_at` | Stage timestamp. |

Production verification query:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'gpe_form_sync_logs'
order by ordinal_position;
```

## Pipeline Stages

The Action Network DOM bridge now logs:

| Stage | Integration | Operation |
| --- | --- | --- |
| Submission received | `pipeline` | `submission_received` |
| Duplicate replay | `pipeline` | `submission_duplicate` |
| Neon constituent lookup/create | `neon` | `account_resolution` |
| Membership lookup | `membership` | `lookup` |
| Hub profile lookup | `hub` | `identity_link` |
| Petition Activity write | `neon` | `petition_activity` |
| Lead action save | `supabase` | `lead_action` |
| Points finalization | `points` | `finalize_petition_points` |
| Resend confirmation | `email` | `resend_petition_confirmation` |
| Final state | `pipeline` | `completed`, `completed_with_warnings`, or `failed` |

The Action Network webhook ingestion path has matching repository changes for:

- submission received / duplicate
- constituent lookup/create
- petition Activity write
- points finalization
- Resend confirmation
- completed/completed-with-warnings
- failed at current stage

## Important Behavior Change

Neon constituent lookup is no longer treated as a successful form/petition sync.

Correct state separation:

| Concern | Success Source |
| --- | --- |
| Form received | Supabase `gpe_form_submissions` row created |
| Neon form record | Neon Activity ID or native provider record ID returned |
| Membership | Neon membership ID or active-member lookup |
| Points | point finalizer result with awarded or pending point IDs |
| Email | Resend/lifecycle sender accepted the message |

If the Neon Activity write fails, the form payload remains in Supabase and the submission should be marked `partial_failure` with `neon_sync_status = failed`.

## Deployment Status

Live:

| Function | Version | SHA | Status |
| --- | ---: | --- | --- |
| `action-network-completion-bridge` | 11 | `27d2a4f373064a9a033a055a4145b249abe3c57099d797bbf4d1055141144a92` | Stage logging deployed |
| `neon-climate-survey` | 45 | `26221dbe0df1591c426ab9756d1f7a0e64b04ea8d16d529590ad270a80ebf3de` | Form status fields deployed |

Repository-fixed but deploy-blocked by Supabase `409 deployment already exists`:

| Function | Current Production Version | Current Production SHA | Risk |
| --- | ---: | --- | --- |
| `camp-gpe-action-network-ingest` | 28 | `df6065f612ca54a3a47fb29c3ea0d7ee71e57c769f8befa010993a74aebd485c` | Webhook path may still mask Activity failure |
| `gpe-grad-highlight-submit` | 28 | `0977fcb5d281d63828377f20aedff2194d981eccf536876083243381dc68c300` | Grad Activity failure may still be masked in production |
| `camp-gpe-submit` | 32 | `7be2c373f5be1a98001bc19a861c91b8c97745db9af8beb01c8edead4061fd61` | Camp Activity failure may still be masked in production |

The blocked functions were retried with normal deploy and `--use-api`.

## Next Live Test

For a controlled Action Network test, inspect:

```sql
select integration, operation, success, response_summary, error_summary, created_at
from public.gpe_form_sync_logs
where submission_id = '<submission_id>'
order by created_at;
```

Expected successful path:

1. `pipeline.submission_received`
2. `neon.account_resolution`
3. `membership.lookup`
4. `hub.identity_link`
5. `neon.petition_activity`
6. `supabase.lead_action`
7. `points.finalize_petition_points`
8. `email.resend_petition_confirmation`
9. `pipeline.completed`

If points remain “Verifying,” the first failed or missing row after `supabase.lead_action` identifies whether the stop is in point finalization, pending identity, UI refresh, or email.
