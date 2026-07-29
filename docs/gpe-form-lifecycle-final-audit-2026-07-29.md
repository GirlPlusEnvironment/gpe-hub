# GPE Form Lifecycle Final Audit

Status: implementation audit after the membership helper polish and petition finalization pass.

Date: 2026-07-29.

Scope:

- Static embed sources in `/Users/Cassandre/gpe/girlplusenvironment.org`
- Shared helper `gpe-form-membership.js`
- Supabase Edge Functions in `/Users/Cassandre/gpe/gpe-hub/supabase/functions`
- Hub admin diagnostics and point-rule surfaces in `/Users/Cassandre/gpe/gpe-hub/src`

## Executive Summary

The membership helper is now much more stable, but the audit confirms that the product should not keep pushing every public form through one universal inline membership pattern.

The right model is three separate experiences:

| Flow | User intent | Recommended membership behavior | Current fit |
|---|---|---|---|
| Action Network / petition | Take action | Inline lookup and optional membership/sign-in inside the action area | Partially aligned |
| Donation | Give money | Optional membership checkbox near the end; never interrupt payment intent | Not yet implemented |
| Become a Member | Join GPE | Enrollment-first lookup copy; no extra opt-in panel | Needs frontend simplification |

The petition backend now has the missing pending-awards layer and a generic point-event service. Webhook submission can create or match Neon, record the action, call `service_record_point_event(...)`, store general petition and Camp petition awards by normalized email/lead action when no Hub profile exists, and materialize those awards into Hub transactions when a profile is linked. The remaining petition gaps are live webhook verification, frontend lifecycle clarity, and broader diagnostics.

## Helper Version Audit

Current active pages loading the shared helper all use:

`https://cdn.jsdelivr.net/gh/GirlPlusEnvironment/girlplusenvironment.org@main/gpe-form-membership.js?v=20260729a`

Confirmed pages:

| Page | Helper loaded | Initializer found | Notes |
|---|---:|---:|---|
| `become-a-member.html` | Yes | Yes | Uses `membershipEnrollment`; lookup/status only, no injected opt-in panel. |
| `camp-gpe.html` | Yes | Yes | Uses `campRegistration` for signup and `passiveLookup` for challenge reporting. Explicit `membershipConsent` and `data-gpe-membership-canonical` remain the correct reuse pattern. |
| `contact.html` | Yes | Yes | Uses `passiveLookup`; contextual lookup only, no injected membership prompt. |
| `events.html` | Yes | Yes | Uses `inlineMembership`; frontend supports optional membership, but backend does not yet create Neon constituents for all registrants. |
| `gpe-grad-highlight.html` | Yes | Yes | Uses `inlineMembership`; creates/matches Neon, but story points are not yet wired. |
| `mobile-climate-adaptation-survey.html` | Yes | Yes | Uses `inlineMembership`; creates/matches Neon, but survey points are not yet wired. |
| `high-energy-bills-action.html` | Yes | Yes | Uses `petition`; completion UI exists and point source of truth remains the Action Network webhook. |
| `coal-slush-fund-action.html` | Yes | Yes | Uses `petition`; same lifecycle as above. |
| `extreme-weather-action.html` | Yes | Yes | Uses `petition`; same lifecycle as above. |
| `donate.html` | No | No | This is acceptable only if donation gets a separate lightweight donor lookup path. |

No mixed helper versions were found among the active helper-loading pages.

Mode smoke test:

- `membershipEnrollment` does not inject a membership panel or auth panel.
- `passiveLookup` does not inject a membership panel or auth panel.
- `petition` still injects the inline membership panel when lookup returns a new/nonmember state.

## Page-Specific Initializer Audit

The static pages still duplicate several helper-adjacent concerns:

- `endpointFor` appears in multiple pages.
- `collect` / field serialization patterns are repeated.
- `membershipRequestForForm` is called directly by page scripts.
- Action Network completion watcher and Camp reporting UI are duplicated across petition pages.

This is now the main maintainability risk. The shared helper should expose explicit modes instead of requiring each page to know how much of the membership lifecycle to run.

Implemented helper modes:

| Mode | Used by | Behavior |
|---|---|---|
| `petition` | Action Network embeds | Inline membership/sign-in under email; petition submission never blocked by skipped membership. |
| `donation` | Donation embed | Passive lookup plus optional checkbox near payment step. |
| `membershipEnrollment` | Become a Member | Lookup/status copy only; no injected opt-in panel. |
| `campRegistration` | Camp GPE signup | Reuse explicit checkbox and canonical fields; no second panel. |
| `passiveLookup` | Contact or informational forms | Lookup for context only; no membership prompt. |

## Lifecycle Matrix

| Form | Create Neon Constituent | Member Check | Membership Prompt | Hub Check | Points | Ledger | Automation |
|---|---|---|---|---|---|---|---|
| Become Member | Yes | Yes | N/A, primary form | Invite/link after membership | Not needed by default | Optional only | Welcome / Hub invite |
| Donate | No | No | Not present | No | No | Donation history not yet represented | Donor journey not yet wired |
| Action Network Petition | Yes, via webhook | Yes | Partial, public page helper/fallback only | Pending by lead/email, claimed to Hub when linked | Yes: general + Camp when applicable | Pending-award rows first, Hub ledger after link | Partial |
| Camp GPE registration | Yes | Yes | Yes, explicit checkbox | Invite/link after membership | Registration only, not challenge points | Partial | Camp journey |
| Camp GPE challenge reporting | Uses authenticated Hub identity; Neon only when profile/membership resolves | Yes | Member-only | Required | Review-first challenge points | Yes after approval | Camp moderation |
| Event registration | Partial; only creates Neon during membership opt-in path | Yes | Yes | Partial | Not awarded | Not awarded | Event notification partial |
| Event attendance | Not public form yet | Not complete | N/A | N/A | Not awarded | Not awarded | Attendance follow-up not complete |
| Contact | Optional lead constituent | Optional/contextual | No | Optional sign-in only | None | None | Staff follow-up |
| Grad Highlight | Yes | Yes | Yes | Optional | Story points not awarded | Not awarded | Neon activity / follow-up |
| Mobile Climate Survey | Yes | Yes | Yes/contextual | Optional | Survey points not awarded | Not awarded | Pending conversion / follow-up |

## Flow Findings

### Action Network / Petition

Current state:

- Petition backend is now action-first instead of profile-first.
- `camp-gpe-action-network-ingest` creates or matches Neon constituents, creates Neon activity, records `lead_actions`, finalizes petition points, and returns a completed state.
- `service_record_point_event(...)` is the generic point-event RPC for verified actions. The petition finalizer now routes `PETITION_SUBMITTED` and `CAMP_PETITION_COMPLETED` through this service.
- `gpe_pending_point_awards` stores verified general petition and Camp petition awards when no Hub profile exists yet.
- `service_attach_petition_history_to_profile` now claims pending awards when a matching Hub profile later appears.
- General petition and Camp petition point rules now exist and are editable in the Hub admin point rules surface.
- Static petition pages show a completion state after detected Action Network success and prevent duplicate local completion from the same session.

Remaining gaps:

- The Action Network widget itself is still external script markup; frontend completion detection is a DOM watcher, not a first-party submit callback.
- Inline Hub sign-in under the petition email/status area is not fully implemented as a silent Supabase session restore plus inline password flow.
- Public petition pages still contain Camp reporting UI that posts to `camp-gpe-challenge-submit`. That endpoint is an authenticated, review-first Camp challenge path, while the new petition webhook is the automated award path. Keeping both visible makes the lifecycle feel split.
- Admin diagnostics now have petition pipeline status, but they should expand to every integration step: Action Network, Neon, Hub, general points, Camp points, challenge progress, and automation.

Recommendation:

Keep Action Network webhook -> Supabase Edge Function -> Neon -> point engine -> ledger as the source of truth. Remove or hide manual "Assign/Report Camp Points" affordances for petition challenges once webhook coverage is verified for each campaign.

### Donation

Current state:

- `donate.html` intentionally avoids loading the shared membership helper.
- `gpe-donation-intake` validates and saves a donation intent, avoids card data, and returns the configured payment URL.

Gaps:

- No Neon constituent create/match currently runs for every donor.
- No member lookup is performed.
- No optional "I'd also like to become a free GPE member" checkbox exists.
- Donor history / lead action / automation is not yet represented beyond the form submission.

Recommendation:

Keep donation separate from the shared inline membership expansion. Add a donation-specific lightweight lookup and optional checkbox near the end of the form, then update `gpe-donation-intake` to always create or match a Neon constituent before handing off to payment.

### Become a Member

Current state:

- Backend is correctly enrollment-first: `gpe-membership-enroll` resolves or creates the Neon account, creates membership server-side when configured, queues Hub invitation, and records lead action.
- Frontend still initializes the generic helper and calls `membershipRequestForForm`.

Gap:

- The membership page should not run the same inline opt-in expansion used by petitions and content submissions. This page is already the membership flow, so the helper should only provide lookup/status copy and duplicate-prevention behavior.

Recommendation:

Add a `membershipEnrollment` helper mode. It should show "welcome back" or "existing account found" copy and then let the existing full form submit. It should never inject a second opt-in panel.

### Events

Current state:

- `events.html` loads the helper and can submit optional membership requests.
- `neon-event-register` creates a registration intent, resolves membership, records a lead action, and can create membership when the user opts in.

Gaps:

- It does not always create or match a Neon constituent for every registrant.
- Event registration and attendance are not yet independent point events.
- No registration/attendance ledger entries are awarded from the point rule engine.

Recommendation:

Split event lifecycle into `EVENT_REGISTERED` and `EVENT_ATTENDED`. Registration can create/match Neon and optionally award a smaller configured rule. Attendance should be confirmed later and awarded separately.

### Grad Highlight And Survey

Current state:

- Both flows create or match Neon constituents and record durable submissions.
- Both can use contextual membership prompts.

Gaps:

- Grad Highlight does not yet award story/community points.
- Mobile Climate Survey does not yet award survey points.
- Ledger entries are not created for either flow.

Recommendation:

Move both onto the same event-based point service proposed below, using configured rules such as `STORY_SUBMITTED` and `SURVEY_COMPLETED`.

## Point Engine Audit

The admin point rules surface is now more configurable, and the petition path is now routed through the generic point-event service. Other action sources still need to move onto the same service.

Current state:

- Petition-specific rules exist.
- Petition finalization is idempotent.
- `service_record_point_event(...)` exists and currently supports petition event aliases plus future event names.
- Admin rules now expose enabled state, points, duplicate policy, caps, season override, and notes.

Remaining design gap:

- Event, survey, story, donation, and office-hours flows have not been migrated to `service_record_point_event(...)` yet.
- Some awarding is still implemented through specific flows such as challenge review and existing admin operations.

Recommended event model:

| Event | Default points | Notes |
|---|---:|---|
| `PETITION_SUBMITTED` | 5 | Always awarded after verified petition submission. |
| `CAMP_PETITION_CHALLENGE` | 5 | Awarded only when mapped to an active Camp challenge. |
| `EVENT_REGISTERED` | 10 | Registration intent, separate from attendance. |
| `EVENT_ATTENDED` | 25 | Attendance-confirmed only. |
| `OFFICE_HOURS_ATTENDED` | 15 | Should be attendance-confirmed. |
| `VOLUNTEERED` | 50 | Requires configured source or approval policy. |
| `STORY_SUBMITTED` | 15 | Grad Highlight/community story path. |
| `RECRUIT_MEMBER` | 20 | Requires duplicate policy and attribution. |
| `SURVEY_COMPLETED` | Configurable | Mobile Climate Survey or future research flows. |

Implemented service shape:

`service_record_point_event(event_type, subject_identity, source, source_id, metadata)`

That service should:

- Resolve the point rule.
- Enforce enabled state.
- Enforce duplicate policy.
- Enforce daily and lifetime caps.
- Apply season override.
- Write the ledger.
- Return a structured award summary for frontend and diagnostics.

## GitHub Actions

GitHub Actions should not be used for real-time user events.

Recommended path:

Action Network webhook -> Supabase Edge Function -> Neon -> point event service -> ledger -> Hub refresh / automation

GitHub Actions should remain limited to deployments, scheduled maintenance, and batch audits.

## Priority Implementation List

1. Add explicit helper modes so petition, donation, membership enrollment, Camp registration, and passive lookup do not share the same UI behavior by accident.
2. Update `gpe-donation-intake` to always create or match Neon constituents and add an optional membership checkbox flow near the end of `donate.html`.
3. Simplify `become-a-member.html` to a membership-enrollment helper mode with no injected opt-in panel.
4. Update `neon-event-register` to create or match Neon constituents for every registration, then add separate `EVENT_REGISTERED` and `EVENT_ATTENDED` point events.
5. Add the generic point-event service and move petition, event, story, survey, volunteer, and recruit awards onto it incrementally.
6. Hide or retire manual petition Camp reporting UI once Action Network webhooks are verified for all active petition campaigns.
7. Expand diagnostics from petition-only status into a full pipeline view for every public lifecycle: submission, Neon, Hub, points, ledger, Camp, and automation.

## Production Verification Notes

Evidence gathered locally:

- Active helper-loading pages all use `v=20260728c`.
- `donate.html` does not load the helper and does not initialize `GPEFormMembership`.
- `camp-gpe-challenge-submit` is still an authenticated, review-first endpoint and returns `awardedPoints: 0` on submission.
- `gpe-donation-intake` currently records donation intake with `neon_sync_status: "skipped"` and `membership_outcome: "not_checked"`.
- `neon-event-register` only creates or matches Neon through the optional membership path, not for every registrant.
- Petition completion and point finalization are represented by the `camp-gpe-action-network-ingest` path and `service_finalize_petition_points`.
- `service_finalize_petition_points(null, ...)` was rollback-tested against the linked database and returned `pendingPoints: 10` with separate pending general and Camp award IDs.

External verification still needed:

- Confirm every active Action Network campaign is configured to call the deployed webhook.
- Submit live test petition signatures for each campaign and confirm Neon constituent, lead action, petition activity, general points, Camp points, ledger, and diagnostics rows.
- Republish Wix embeds if production Wix is not directly loading the updated GitHub source files.
