# GPE Website Production Readiness Audit

Status: final pre-deployment audit checklist. This is not a launch approval.

Last updated: 2026-07-18.

## Scope

This audit covers the public Wix-embedded custom pages, Neon CRM integrations, Supabase Edge Functions, Hub identity linking, campaign pages, form behavior, notifications, analytics, accessibility, performance, and deployment readiness.

Do not deploy, apply migrations, publish Wix pages, or push Git until the blockers in this document and the linked form parity audits are resolved and live smoke tests pass.

Related docs:

- `docs/gpe-public-form-audit-matrix.md`
- `docs/gpe-public-form-parity-audit.md`
- `docs/gpe-custom-form-architecture.md`
- `docs/gpe-events-neon-integration.md`
- `docs/gpe-form-url-migration.md`
- `docs/camp-gpe-hub-phase1.md`

## Current Findings

### Digital Campaigns

`gpe-mirror/digital-campaigns.html` was split out of the earlier prototype-style multi-view file into standalone Wix-embeddable campaign pages.

Current standalone files:

- `gpe-mirror/digital-campaigns.html`
- `gpe-mirror/digital-campaigns-hot-girls-hate-extreme-weather.html`
- `gpe-mirror/digital-campaigns-main-character-energy.html`
- `gpe-mirror/digital-campaigns-power-to-the-people.html`
- `gpe-mirror/digital-campaigns-savings-szn.html`

Current status:

- The old in-document JavaScript view-switching architecture was removed from the production Digital Campaigns files.
- The embedded global nav and footer were removed from the production Digital Campaigns files.
- The landing page campaign cards are real anchors to the final root-level Wix routes.
- Each campaign page has a back link to `https://www.girlplusenvironment.org/digital-campaigns`.
- Each campaign page includes a reusable campaign toolkit structure: hero, about, goals, take action, creator toolkit, campaign portfolio, related resources, social connection, and back link.
- Visible mojibake was removed from the production Digital Campaigns files.
- Some final campaign post permalinks, thumbnails, campaign-specific event registrations, and campaign asset URLs are still waiting on approved assets or Wix/Neon records, so those are represented as editorial portfolio areas rather than fake live links.

Campaigns in Action status:

- The old Digital Campaigns reference export was reviewed for its social gallery mechanism.
- What loaded before: a Wix Pro Gallery/Instagram-style gallery rendered by Wix runtime data. The export contains generated component IDs, a Wix SDK item source, generated gallery wrappers, and temporary Instagram media URLs.
- Stable mechanism found: none. No reusable iframe URL, stable Wix widget URL, or independent hosted gallery page was present in the old export.
- What was reused: the editorial placement and `@girlplusenvironment` profile CTA.
- What was intentionally not copied: generated Wix runtime DOM, generated component IDs, temporary Instagram CDN media, and session-specific gallery data.
- The production landing page therefore uses a curated `Campaigns in Action` / `See the Campaigns` portfolio-social section after the four featured campaign cards and before the final `Get Involved` CTA.
- No Instagram API integration, Instagram CDN media URLs, or scraped Wix runtime gallery DOM are stored in the production source.
- The Instagram profile link uses `data-analytics-event="instagram_profile_click"` with `page: digital_campaigns` and `placement: campaigns_in_action` metadata because no shared analytics helper is currently present in this standalone file.
- Deployment remains pending until curated portfolio assets are selected. A live social feed should not be claimed unless a stable GPE-hosted or Wix-supported embed mechanism is created and tested.

Wix route mapping:

- `/digital-campaigns`
- `/digital-campaigns-hot-girls-hate-extreme-weather`
- `/digital-campaigns-main-character-energy`
- `/digital-campaigns-power-to-the-people`
- `/digital-campaigns-savings-szn`

Each campaign page should be an isolated page file or Wix route, not an in-page JavaScript-swapped view.

Each campaign should support reusable sections:

- About
- Campaign Goals
- Take Action
- Captions
- Creator Toolkit
- Campaign Portfolio
- Resources
- Related Articles
- Social Links
- Newsletter
- Events
- Petitions

Do not ship placeholder illustrations such as generic giant icons, `Tip #1`, `LEDs`, `Insulation`, or `Smart Stats` unless they are replaced with real campaign content such as downloadable graphics, carousel previews, toolkit thumbnails, campaign photography, newsletter previews, petition CTAs, or creator resources.

### Resources Page

`gpe-mirror/resources.html` has been updated for Wix embedding.

Verified:

- No embedded global nav/header.
- No embedded footer.
- No `pt-[140px]` fixed-header gap.
- No hash-only placeholder links.
- Live cards route with full Wix URLs and `target="_top"`.
- Green Jobs and Save `$` on Energy remain non-clickable coming-soon cards.
- Camp GPE is now a live linked card.
- Keyboard focus styling exists for linked resource cards.
- Wix height messaging exists.
- Inline script syntax passes.
- True 390px mobile viewport metrics show no horizontal overflow.

Screenshots:

- `/Users/Cassandre/gpe/screenshots/resources-desktop.png`
- `/Users/Cassandre/gpe/screenshots/resources-mobile.png`

### Standalone Header/Footer Rule

Production public HTML embeds should not include global site shell markup because Wix supplies the shared header and footer.

Remove from final standalone pages:

- global `<header>`
- global footer markup
- global navigation markup
- logo navigation
- desktop/mobile global menus
- fixed header spacers
- site-wide CTA bars
- global social/footer columns
- copyright footers
- mobile-menu JavaScript that only supported the removed shell

Keep page-specific navigation such as:

- form step navigation
- event filters
- resource tabs
- Camp resource navigation
- breadcrumbs that belong to a page
- modal controls

Current Digital Campaigns status:

- The production Digital Campaigns landing page and four campaign subpages now follow this standalone embed rule. Wix still needs matching page embeds created for each route before launch.

Production-target embed audit, source verified on 2026-07-18:

| Page | Header | Footer | Status |
|---|---:|---:|---|
| `contact.html` | No | No | Clean embed |
| `become-a-member.html` | No | No | Clean embed |
| `resources.html` | No | No | Clean embed |
| `camp-gpe.html` | No | No | Clean embed |
| `events.html` | No | No | Clean embed |
| `donate.html` | No | No | Clean embed |
| `gpe-grad-highlight.html` | No | No | Clean embed |
| `take-action.html` | No | No | Clean embed |
| `mobile-climate-adaptation-survey.html` | No | No | Clean embed |
| `coal-slush-fund-action.html` | No | No | Clean embed |
| `high-energy-bills-action.html` | No | No | Clean embed |
| `camp-gpe-toolkit.html` | Page-specific nav only | No | Intentional sticky toolkit section navigation, not a global shell |
| `digital-campaigns.html` | No | No | Clean embed |
| `digital-campaigns-hot-girls-hate-extreme-weather.html` | No | No | Clean embed |
| `digital-campaigns-main-character-energy.html` | No | No | Clean embed |
| `digital-campaigns-power-to-the-people.html` | No | No | Clean embed |
| `digital-campaigns-savings-szn.html` | No | No | Clean embed |
| `strategic-plan.html` | Page hero header only | No | Intentional semantic hero header, not a global shell |
| `strategic-plan-ppt.html` | No | No | Clean embed |

Repository-wide raw Wix export scan still finds global shells in legacy/reference files such as `old-*`, mirrored blog exports, and original Neon form exports. Those are not production embed targets and should not be used directly in Wix without extraction.

Reference exports and raw Wix mirrors may contain original Wix/Neon shell markup and should not be treated as publish-ready custom embeds without extraction.

## Public Forms

Every public form that collects email should follow the shared form architecture unless intentionally excluded.

The current parity source of truth is `docs/gpe-public-form-audit-matrix.md`.

Required standard payload fields where applicable:

- `email`
- `firstName`
- `lastName`
- `phone`
- `organization`
- `city`
- `state`
- `country`
- `interests`
- `campaign`
- `source`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `page`
- `form_type`
- `member_status`
- `hub_user`
- `timestamp`

Do not let each form invent incompatible field names for the same concept.

### Contact

Required flow:

1. Save contact submission in Supabase.
2. Match/create Neon constituent when safe.
3. Sync the message to Neon activity/custom fields.
4. Send staff notification email to `hello@girlplusenvironment.org`.
5. Return branded success state.

Current implementation:

- Edge Function: `gpe-contact-submit`
- Staff notification: implemented after Supabase save.
- Neon sync failure does not block staff notification attempt.
- Notification delivery state is stored on `gpe_form_submissions`.
- Contact page image collage was corrected without changing form behavior.
- The supplied `5bbcfc_6025e7c3ad92421887497d2dc103d708~mv2.webp` image is now the front polaroid image.
- The previous front `5bbcfc_7f36928c75044fa5b72a7035bd54a390~mv2.webp` image is now the back polaroid image.
- The handwritten note now sits below the photo collage in normal document flow instead of overlapping the photos.
- Contact form data attributes, identity lookup, honeypot, idempotency, validation, error/success states, and Edge Function wiring were preserved.

Production blockers:

- Live test Resend or selected transactional provider.
- Live test Neon activity write.
- Confirm staff notification sender domain and Reply-To behavior.
- Confirm whether direct file upload is required beyond the current secure-link field.

### Membership

Required flow:

1. Lookup email.
2. If active member, prompt Hub sign-in/Hub access and do not create another membership.
3. If Neon member without Hub, activate Hub account rather than creating a duplicate membership.
4. If expired/inactive, renew/reactivate according to confirmed Neon rules.
5. If existing constituent without membership, create membership on that constituent.
6. If new person, create constituent and free membership.
7. Queue or send Hub activation/invitation.
8. Offer optional donation without implying payment is required for membership.

Current implementation:

- Edge Function: `gpe-membership-enroll`
- Shared backend helper: `_shared/membership-request.ts`
- Membership level and term IDs are server-side config.

Production blockers:

- Confirm actual Neon membership level and term IDs.
- Confirm expired-member renewal/reactivation behavior in Neon.
- Live test duplicate prevention with same email, retries, and ambiguous matches.
- Live test Hub activation/invitation flow.

### Donate

Donation should not run public membership lookup or Hub identity prompts.

Required flow:

1. Collect safe donor and donation-intent data.
2. Save donation intent idempotently.
3. Redirect to the configured Neon CRM hosted donation/payment form.
4. Neon handles constituent matching and payment.
5. Neon creates the donation record and recurring support record when configured.
6. Neon sends the applicable receipt or acknowledgement.
7. User returns to the approved GPE thank-you or next-step page when Neon return URLs are configured.

Current implementation:

- Edge Function: `gpe-donation-intake`
- Public page does not run `neon-membership-check`.
- Card/payment data is not collected in public HTML or Supabase.

Production blockers:

- Configure `GPE_DONATION_PAYMENT_URL` with the approved Neon CRM hosted donation/payment URL.
- Confirm one-time and recurring payment handling.
- Confirm tribute gift fields.
- Confirm payment success and cancel return behavior.
- Confirm Neon receipt/acknowledgement and return URL behavior.

### Volunteer

Required flow:

1. Save volunteer interest submission.
2. Match/create Neon constituent when safe.
3. Write volunteer interest to Neon.
4. Send staff notification.
5. Show branded thank-you state.

Current blocker:

- The source-of-truth provider was not confirmed from source. A dedicated custom volunteer Edge Function was not found, but that is not automatically a defect if volunteer collection intentionally remains in Neon, Wix, Action Network, or another approved hosted provider.
- Before launch, document the intended volunteer provider, verify submission storage, consent capture, notification behavior, confirmation messaging, spam protection, and analytics.

### Events

Required flow:

1. Load public events from Neon plus approved curated display metadata.
2. Register through Neon event registration where Neon owns the event.
3. Support membership lookup where useful.
4. Send calendar/confirmation email through Neon or approved transactional service.
5. Preserve registration if membership linking fails.

Current implementation:

- Public listing function: `neon-events-public`
- Registration function: `neon-event-register`
- Events doc: `docs/gpe-events-neon-integration.md`

Production blockers:

- Live test Neon event listing and registration.
- Confirm current event IDs and statuses.
- Confirm completed webinar exclusion.
- Confirm curated Hot Girls Hate Extreme Heat behavior because it may not exist in Neon.

### Surveys

Required flow:

1. Save survey response in Supabase.
2. Sync useful Neon activity/custom fields.
3. Preserve response if Neon is unavailable.
4. Optionally notify staff or update analytics.

Current implementation:

- Edge Function: `neon-climate-survey`
- Docs: `docs/neon-climate-survey-integration.md`, `docs/neon-field-map.md`

Known Neon limitation:

- No confirmed Neon API endpoint exists for recreating the original hosted survey response object. Current approach stores full survey payload in Supabase and writes a Neon activity.

### Petitions

Required flow:

1. Submit advocacy action through Action Network where Action Network owns the petition.
2. Create/match constituent as allowed by the integration.
3. Track source campaign, UTM, page, and action.
4. Ingest Action Network events into Supabase for Camp/Impact attribution where configured.
5. Avoid exposing Action Network or Neon credentials in browser code.

Current implementation:

- Public petition pages retain external Action Network behavior.
- Camp ingestion function: `camp-gpe-action-network-ingest`

Production blockers:

- Confirm Action Network webhook configuration.
- Confirm campaign/action mapping to `gpe_challenges` and point rules.
- Confirm source/UTM capture.

## Edge Function Audit

Functions currently present:

- `camp-gpe-action-network-ingest`
- `camp-gpe-challenge-submit`
- `camp-gpe-challenges`
- `camp-gpe-submit`
- `gpe-contact-submit`
- `gpe-donation-intake`
- `gpe-grad-highlight-submit`
- `gpe-membership-enroll`
- `neon-climate-survey`
- `neon-event-register`
- `neon-events-public`
- `neon-membership-check`

Every production function must have:

- request validation
- honeypot or spam protection where applicable
- rate limiting
- idempotency
- CORS restrictions
- structured errors
- Supabase-first persistence for public forms
- Neon retry or pending-sync status
- limited logging without full sensitive payload dumps
- notification handling where required
- analytics event emission or a documented deferred path

Current blocker:

- Perform a code-level checklist for each function before deployment and record pass/fail in this doc or `docs/gpe-public-form-audit-matrix.md`.

Newsletter and volunteer note:

- No dedicated `newsletter` or `volunteer` Edge Function folders were found in `supabase/functions`.
- This does not prove those workflows are broken. They may intentionally be handled by Neon hosted forms, Action Network, Wix native forms, or another approved provider.
- Production readiness requires identifying the intended provider for each workflow and verifying storage, consent, notification, confirmation, analytics, and spam protection. Do not add a custom Edge Function unless the chosen architecture requires one.

## Supabase Audit

Review before launch:

- Auth configuration
- Hub profile creation
- Hub-to-Neon identity link table
- RLS policies
- Storage buckets
- Edge Function environment variables
- Service-role usage confined to Edge Functions
- Anonymous writes only where intended and rate-limited
- Camp point ledger and duplicate-award protection
- Notification/outbox tables
- Sync log retention and PII minimization

Migrations currently present:

- `20260701_create_app_schema.sql`
- `20260710_add_profile_trigger.sql`
- `20260710_harden_storage_and_realtime.sql`
- `20260711_sync_signup_profile_metadata.sql`
- `20260717_gpe_custom_forms.sql`
- `20260717_neon_climate_survey.sql`
- `20260718_camp_gpe_hub_phase1.sql`
- `20260719_camp_gpe_challenge_automation.sql`
- `20260720_gpe_events_neon_sync.sql`
- `20260721_camp_gpe_admin_completion.sql`
- `20260722_contact_staff_notification.sql`

Do not apply migrations until reviewed against the target project and backed up.

## Notifications

Every form that needs staff awareness should send a branded staff email to `hello@girlplusenvironment.org` after Supabase save.

Notification email should include:

- form name
- received time
- submitter name/email/phone
- reply button
- submission ID
- Neon ID/status when available
- Hub ID/status when available
- source page
- UTM/campaign metadata when available

Current confirmed implementation:

- Contact staff notification exists in `gpe-contact-submit`.

Production blocker:

- Decide which other forms require staff notification versus CRM-only notification, then implement the same reliable notification/outbox pattern.

## Analytics

Required analytics events:

- Campaign Opened
- Campaign Card Click
- Toolkit Download
- Petition Click
- Register Click
- Membership Started
- Membership Completed
- Donation Started
- Donation Completed
- Newsletter Signup
- Volunteer Signup
- Hub Signup
- Hub Login
- Form Submitted
- Form Partial Success
- Form Sync Failed

Production blocker:

- Configure analytics provider and implement a shared public analytics helper plus server-side analytics/outbox events for Edge Functions. Do not add ad pixels or trackers without consent/privacy review.

## Accessibility Audit

Before launch, audit:

- keyboard navigation
- visible focus states
- labels and `for`/`id`
- fieldsets and legends
- alt text
- heading order
- contrast
- `aria-live` regions for async form status
- modal focus traps and Escape handling
- reduced-motion behavior
- non-color-only state indicators
- screen-reader-safe decorative SVGs

Known recent improvements:

- `resources.html` linked cards now have visible focus states.
- Form audit docs document several page-specific accessibility updates.

Production blocker:

- Run browser-based keyboard and screen-reader spot checks on every final page, not only static scans.

## Performance Audit

Before launch, audit:

- image aspect ratios and no stretching
- image lazy loading where appropriate
- oversized Wix/static images
- unused Tailwind utility output in standalone embeds
- font loading and fallback behavior
- animation cost and reduced-motion support
- compression/caching on hosted assets
- no excessive third-party scripts inside embeds

Current note:

- `resources.html` still contains generated utility CSS. It is functional, but a future cleanup could reduce file size once the page is visually locked.

## Content Audit

Do not ship unresolved placeholders.

Static scans should cover:

- `COMING SOON`
- `Lorem`
- `Placeholder`
- visible implementation notes
- hash-only placeholder links
- in-document JavaScript view switching
- `showView(`
- `view-section`
- mojibake / broken encoding
- fake social links
- fake toolkits/downloads
- prototype navigation

Current known placeholders:

- `resources.html`: Green Jobs and Save `$` on Energy intentionally remain `COMING SOON`.
- `digital-campaigns.html`: the former prototype placeholders and hash-only links were replaced during the standalone campaign split. Final downloadable campaign assets and Wix page placement still need production follow-up.
- Legacy/reference files contain placeholders because they are exports; do not publish them as final pages.

## Deployment Checklist

### Edge Functions

Prepare deployments for:

- `neon-membership-check`
- `gpe-membership-enroll`
- `gpe-contact-submit`
- `gpe-donation-intake`
- `neon-event-register`
- `neon-events-public`
- `neon-climate-survey`
- `gpe-grad-highlight-submit`
- `camp-gpe-submit`
- `camp-gpe-challenge-submit`
- `camp-gpe-challenges`
- `camp-gpe-action-network-ingest`

Add any missing functions before launch:

- volunteer submission only if custom volunteer collection is confirmed as the intended architecture
- newsletter signup only if it is not already handled by Neon, Action Network, Wix, or another approved provider
- shared notification retry processor, if queued notification retry is required

### Database and Infrastructure

Before production:

- Review and apply migrations in order.
- Verify RLS policies.
- Create required storage buckets.
- Add production Supabase secrets.
- Configure Neon CRM API credentials.
- Configure email provider credentials.
- Configure Neon CRM hosted membership and donation/payment forms.
- Configure Action Network webhook secrets if applicable.
- Configure analytics only after privacy review.

### QA Before Launch

- Test every form end-to-end.
- Verify records appear correctly in Neon.
- Verify confirmation emails send.
- Verify staff notifications send to `hello@girlplusenvironment.org`.
- Confirm Hub authentication for existing members.
- Confirm no duplicate constituents or memberships are created.
- Confirm Camp point ledger prevents duplicate awards.
- Test mobile, tablet, and desktop layouts.
- Run accessibility and performance audits.
- Replace remaining placeholder content or links.
- Verify all Wix routes and navigation work without embedded headers or footers.

### Launch-Day Checklist

- [ ] All production embed pages have no duplicate global header or footer.
- [ ] All production embed pages resize correctly inside Wix.
- [ ] Strategic Plan embed URL points to the repaired source.
- [ ] Digital Campaigns landing route works.
- [ ] Hot Girls Hate Extreme Weather route works.
- [ ] Main Character Energy route works.
- [ ] Power to the People route works.
- [ ] Savings SZN route works.
- [ ] Digital Campaign links escape the Wix iframe with `target="_top"`.
- [ ] Contact form saves to Supabase.
- [ ] Contact form syncs or queues Neon activity correctly.
- [ ] Contact staff notification reaches `hello@girlplusenvironment.org`.
- [ ] Membership lookup tested for active Hub member.
- [ ] Membership lookup tested for active Neon member without Hub access.
- [ ] Membership lookup tested for expired member.
- [ ] Membership lookup tested for existing constituent without membership.
- [ ] Membership lookup tested for brand-new visitor.
- [ ] Membership lookup tested for ambiguous duplicate.
- [ ] Hub activation or invitation path tested.
- [ ] Existing Hub member sign-in returns to unfinished form.
- [ ] Neon hosted donation form redirect tested.
- [ ] Neon hosted membership/payment flow, if used, tested.
- [ ] Camp registration tested.
- [ ] Camp challenge submission rejects anonymous requests.
- [ ] Camp challenge submission accepts authenticated eligible members.
- [ ] Camp admin approval tested.
- [ ] Camp point ledger updates after approval.
- [ ] Camp leaderboard updates from the ledger-backed view.
- [ ] Action Network Camp ingestion tested if enabled.
- [ ] Events listing loads Neon-backed events.
- [ ] Events registration handoff to Neon tested.
- [ ] Survey submission tested.
- [ ] Grad Highlight submission and upload/link policy tested.
- [ ] Volunteer provider confirmed and tested.
- [ ] Newsletter provider confirmed and tested.
- [ ] Instagram portfolio/feed approach confirmed in Wix.
- [ ] Mobile QA completed.
- [ ] Accessibility QA completed.
- [ ] Analytics QA completed.
- [ ] Wix publish completed only after backend smoke tests pass.
- [ ] Production smoke test completed after publish.

## Verified Source Audit - 2026-07-17

This section records code-level findings from the current repository. These checks do not prove production deployment status.

### Encoding and Embed Repairs

Files changed during the verification pass:

- `gpe-mirror/strategic-plan.html`
- `gpe-mirror/strategic-plan-ppt.html`
- `gpe-mirror/mobile-climate-adaptation-survey.html`
- `gpe-hub/scripts/audit-wix-embeds.js`
- `gpe-hub/docs/gpe-website-production-readiness-audit.md`

Encoding fixes:

- `strategic-plan.html`: corrected visible mojibake in the January 2026 caption and marquee bullets.
- `strategic-plan-ppt.html`: corrected visible mojibake in year ranges and biography separator text.
- Production target scan across Strategic Plan, Digital Campaigns, and Contact returned no mojibake, legacy view-switching calls, hash-only links, Instagram CDN URLs, copied Wix gallery markup, or generated Wix component-ID matches.

Embed shell fixes:

- `strategic-plan.html`: removed duplicated global fixed navigation and global footer, added UTF-8 and viewport metadata, reduced hero top padding from `pt-32` to `pt-20`, and added Wix height `postMessage` resizing.
- `mobile-climate-adaptation-survey.html`: removed a hidden hash-only success link placeholder while preserving dynamic success-link behavior.
- `digital-campaigns.html` and the four campaign subpages were verified clean: no embedded global nav/footer, no legacy view-switching calls, no hidden campaign views, no hash-only links, and no copied Wix gallery DOM.
- `contact.html` was verified clean: no global nav/footer and no note overlap with the requested photo collage.

Reference/raw Wix exports still contain Wix runtime shell markup. Those files are not publish-ready standalone embeds and should remain reference material unless extracted.

### Digital Campaigns Verification

Verified production files:

- `gpe-mirror/digital-campaigns.html`
- `gpe-mirror/digital-campaigns-hot-girls-hate-extreme-weather.html`
- `gpe-mirror/digital-campaigns-main-character-energy.html`
- `gpe-mirror/digital-campaigns-power-to-the-people.html`
- `gpe-mirror/digital-campaigns-savings-szn.html`

Current status:

- Implemented and verified in source as independently embeddable HTML files.
- Landing page campaign cards are real anchors to root-level Wix routes using `target="_top"`.
- Final source routes:
  - `https://www.girlplusenvironment.org/digital-campaigns`
  - `https://www.girlplusenvironment.org/digital-campaigns-hot-girls-hate-extreme-weather`
  - `https://www.girlplusenvironment.org/digital-campaigns-main-character-energy`
  - `https://www.girlplusenvironment.org/digital-campaigns-power-to-the-people`
  - `https://www.girlplusenvironment.org/digital-campaigns-savings-szn`
- Each campaign subpage has a back link to the root-level Digital Campaigns route.
- The previous in-page JavaScript view-switching architecture is absent from the production files.
- The old Digital Campaigns reference file was reviewed for its social gallery. It contains exported Wix runtime gallery data with generated component IDs and temporary Instagram media URLs, not a stable reusable embed mechanism.
- The production landing page therefore uses a curated `Campaigns in Action` / `See the Campaigns` portfolio-social section with an Instagram profile CTA rather than claiming a live embedded feed.
- No scraped Instagram CDN URLs or generated Wix runtime gallery DOM are stored in the production source.
- Standalone campaign hashtag blocks were removed from subpages.
- Generic campaign graphics sections were converted to `Campaign Portfolio` / `See the Creative` sections.
- CTA/card link styling was corrected so campaign links do not render as browser-default blue, underlined, or purple visited links.

Digital Campaigns link inventory, source verified on 2026-07-18:

| Source file | Internal GPE links | External links | Notes |
|---|---|---|---|
| `digital-campaigns.html` | Root-level campaign routes, `/take-action`, `/events` | `https://www.instagram.com/girlplusenvironment/` | Campaign cards use full absolute Wix URLs with `target="_top"` |
| `digital-campaigns-hot-girls-hate-extreme-weather.html` | `/extreme-weather`, `/take-action`, `/high-energy-bills-action`, `/camp-gpe`, `/events`, `/energy-justice`, `/resources`, `/digital-campaigns` | `https://www.instagram.com/girlplusenvironment/` | Back link uses root-level `/digital-campaigns` |
| `digital-campaigns-main-character-energy.html` | `/energy-justice`, `/events`, `/become-a-member`, `/resources`, `/digital-campaigns` | `https://www.instagram.com/girlplusenvironment/` | Back link uses root-level `/digital-campaigns` |
| `digital-campaigns-power-to-the-people.html` | `/take-action`, `/contact`, `/gpe-grad-highlight`, `/events`, `/resources`, `/energy-justice`, `/digital-campaigns` | `https://www.instagram.com/girlplusenvironment/` | Back link uses root-level `/digital-campaigns` |
| `digital-campaigns-savings-szn.html` | `/energy-justice`, `/contact`, `/high-energy-bills-action`, `/resources`, `/events`, `/digital-campaigns` | `https://www.instagram.com/girlplusenvironment/` | Back link uses root-level `/digital-campaigns` |

Digital Campaigns link rules verified in source:

- No folder-style campaign routes are used.
- No direct `.html` file paths are used as public campaign navigation.
- No hash-only links or JavaScript-only campaign navigation are present.
- Internal Wix page navigation uses full absolute `https://www.girlplusenvironment.org/...` URLs with `target="_top"`.
- External links open in a new tab with `rel="noopener noreferrer"`.

Still required in Wix Editor:

- Create or confirm one Wix page per campaign route.
- Embed the matching production HTML file for each route.
- Select approved campaign post permalinks/thumbnails or a stable GPE-hosted feed mechanism if one becomes available.
- Test desktop/tablet/mobile after the hosted HTML is embedded.

### Contact Verification

Verified final collage state in `gpe-mirror/contact.html`:

- Front image: `5bbcfc_6025e7c3ad92421887497d2dc103d708~mv2.webp`
- Back image: `5bbcfc_7f36928c75044fa5b72a7035bd54a390~mv2.webp`
- The handwritten note with `Questions, collabs, press, partnerships, or just saying hi?` and `We read every note.` sits in `.contact-note-block` below the two-photo collage in normal flow.
- `.contact-note-polaroid` is no longer present.
- Existing form data attributes, `gpe-contact-submit` wiring, `neon-membership-check` lookup, honeypot, idempotency key, labels, validation, and success/error behavior were preserved.

### Hub Admin Review Status

Camp GPE admin review is implemented in source.

- Review route: `/admin/camp`
- Frontend gate: `ProtectedRoute` + `TeamRoute`
- Role helper: `src/lib/roles.ts`
- Review UI: `src/pages/CampAdmin.tsx`
- Source tables/functions: `gpe_camp_submissions`, `gpe_camp_submission_actions`, `gpe_camp_points_ledger`, `approve_camp_submission_action`, `mark_camp_submission_action`, `reverse_camp_point_entry`
- Parent submission statuses include `pending`, `approved`, `rejected`, and `needs_info`.
- Action review statuses include `pending`, `approved`, `rejected`, `needs_information`, and `duplicate`.
- Reviewer authorization is enforced in database functions through `public.can_manage_camp(auth.uid())`, not only by hidden frontend buttons.
- RLS policies also restrict submission and point-management access to owners or Team GPE/admin roles.

Limitations:

- This verifies source implementation only. It does not confirm the migrations have been applied or the Edge Functions/RPCs are deployed in production.
- Camp review records reviewer fields and point-ledger entries, but a full separate immutable audit-log table beyond ledger/outbox/log records was not found.
- No general non-Camp admin-review workflow was verified beyond the existing admin/member/listing areas.

Access matrix from source:

| Area | Public | Member | Admin/Staff | Enforcement |
|---|---:|---:|---:|---|
| Member profile | No | Own profile | Admin via role | Protected routes, Supabase Auth, RLS |
| Membership status lookup | Limited safe state | Limited safe state | Backend service role | Edge Function returns privacy-safe states |
| Camp admin review queue | No | No | Team GPE/Admin | `TeamRoute`, RPC role checks, RLS |
| Camp approval/rejection | No | No | Team GPE/Admin | Security-definer RPCs check `can_manage_camp` |
| Public form submissions | Submit only | Submit only | Backend/admin by policy | Edge Functions persist with service role; RLS required for direct reads |
| Internal review notes | No | No | Team GPE/Admin | Review RPCs and RLS policies |

### Membership, Neon, and Hub Flow Status

Verified source components:

- Membership lookup function: `neon-membership-check`
- Membership creation function: `gpe-membership-enroll`
- Shared Neon resolver: `_shared/neon-membership.ts`
- Shared Neon account helper: `_shared/neon-account.ts`
- Membership creation and Hub invitation helper: `_shared/membership-request.ts`
- Hub auth frontend: Supabase Auth in `src/contexts/AuthContext.tsx` and login routes

Explicit answers from code review:

1. Membership signup creates or reuses a Neon constituent through `resolveOrCreateAccount`.
2. A Neon membership is created by `createMembershipServerSide` only when `DEFAULT_MEMBERSHIP_LEVEL_ID` and `DEFAULT_MEMBERSHIP_TERM_ID` are configured; otherwise the helper records a Neon activity fallback, which is not sufficient for launch.
3. Hub invitation is queued after membership work. A live account-activation email/send path depends on `HUB_INVITATION_FUNCTION_URL` or the pending `hub_invitations` workflow and was not verified deployed.
4. Existing active Neon members can be recognized as `neon_member_needs_hub_activation`; live activation without duplicate membership still requires production smoke testing.
5. Existing Hub users can sign in through Supabase Auth; passwords are not routed through Neon membership-check functions.
6. Expired members are identified by lookup state. Exact Neon renewal/reactivation semantics still depend on confirmed Neon membership configuration and live testing.
7. Duplicate Hub accounts should be constrained by Supabase Auth email uniqueness, but activation invite handling must be tested end-to-end.
8. Duplicate Neon constituents are guarded by email lookup and ambiguous-match handling; final dedupe behavior depends on Neon data quality and live API responses.
9. Membership state is checked server-side.
10. Neon credentials are referenced in Edge Functions, not public HTML/React frontend.
11. Supabase service-role credentials are referenced in Edge Functions, not public HTML/React frontend.
12. Deployment status is unverified from this repository. Source exists, but production deployment must be confirmed in Supabase and Wix.

Recent source repair:

- `camp-gpe-challenge-submit` now requires a bearer token, verifies it against Supabase Auth, uses the authenticated user email as the canonical email, rejects email mismatches, checks active GPE membership server-side, and links/creates the season member by `auth.uid()`.
- The public Camp page now attempts to retrieve the existing Supabase session access token from the shared membership/Auth helper before submitting a challenge and sends it as `Authorization: Bearer <token>`.
- This is implemented in source only. It still requires Edge Function deployment, live Supabase Auth testing, and RLS/RPC smoke tests before point-related Camp features are production-ready.

### Public Form Backend Status From Source

| Form | Frontend | Edge Function | Neon write | Supabase persistence | Notification | Idempotency | Remaining blocker |
|---|---|---|---|---|---|---|---|
| Contact | `contact.html` | `gpe-contact-submit` | Account/activity sync | `gpe_form_submissions` | Staff email implemented | Yes | Live Neon/email provider test |
| Membership | `become-a-member.html` | `gpe-membership-enroll` | Account + membership when configured | `gpe_form_submissions` | Hub invitation queued | Yes | Confirm level/term IDs and live activation |
| Donation | `donate.html` | `gpe-donation-intake` | Neon hosted donation/payment form after intake redirect | Donation intent in Supabase | Not found | Yes | Configure Neon hosted donation URL and live Neon receipt/return test |
| Events | `events.html` | `neon-events-public`, `neon-event-register` | Neon event source/registration handoff | Event cache/intents/claims | Notification outbox event | Yes | Live Neon registration test |
| Climate survey | `mobile-climate-adaptation-survey.html` | `neon-climate-survey` | Account/activity sync | Survey submission | Hub invitation path when relevant | Yes | Neon hosted survey object parity |
| Grad Highlight | `gpe-grad-highlight.html` | `gpe-grad-highlight-submit` | Account/activity sync | `gpe_form_submissions` | Hub invitation path when relevant | Yes | Upload/media policy live test |
| Camp registration | `camp-gpe.html` | `camp-gpe-submit` | Account/activity + optional membership | Registration/season member | Hub invitation path when relevant | Yes | Live Neon + Hub invite test |
| Camp challenge | `camp-gpe.html` | `camp-gpe-challenge-submit` | Neon activity for authenticated active member | Submission/actions/points | Notification outbox via DB | Yes | Auth enforcement implemented in source; deploy and live-test token/RLS behavior |
| Petition ingestion | Action Network webhook | `camp-gpe-action-network-ingest` | Membership lookup only | Submission/action/points | Sync log | Yes | Webhook secret and challenge mapping live test |
| Volunteer | Not verified | Not found | Not found | Not found | Not found | Not found | Dedicated implementation or external provider needed |
| Newsletter | Not verified | Not found | Not found | Not found | Not found | Not found | Dedicated implementation or external provider needed |

### Deployment Inventory

Repository scripts verified in `gpe-hub/package.json`:

- `npm run dev`
- `npm run build`
- `npm run build:dev`
- `npm run lint`
- `npm run preview`

No test or format script was found in `package.json`.

GitHub Pages workflow:

- `.github/workflows/deploy-pages.yml` builds on push to `main` or manual dispatch.
- Required repository secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Supabase:

- No `supabase/config.toml` was found, so local project linking/configuration is not encoded in the repository.
- Required migrations are listed earlier in this document and must be reviewed/applied in order.
- Edge Functions requiring deployment are listed earlier in this document.

Required or referenced secrets/environment values include:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_FORM_ORIGINS`
- `ALLOWED_HUB_ORIGINS`
- `NEON_ORG_ID`
- `NEON_API_KEY`
- `NEON_BASE_URL`
- `NEON_API_VERSION`
- `ELIGIBLE_MEMBERSHIP_LEVELS`
- `ELIGIBLE_MEMBERSHIP_STATUSES`
- `DEFAULT_MEMBERSHIP_LEVEL_ID`
- `DEFAULT_MEMBERSHIP_TERM_ID`
- `HUB_INVITATION_FUNCTION_URL`
- `HUB_INVITATION_SECRET`
- `GPE_MEMBERSHIP_URL`
- `GPE_HUB_LOGIN_URL`
- `GPE_EMAIL_PROVIDER`
- `RESEND_API_KEY`
- `GPE_TRANSACTIONAL_EMAIL_FROM`
- `GPE_CONTACT_NOTIFICATION_TO`
- `ACTIVE_CAMP_SEASON_SLUG`
- `ACTION_NETWORK_WEBHOOK_SECRET`
- `DEFAULT_EVENT_IMPACT_POINTS`
- `EVENT_POINTS_REQUIRE_ATTENDANCE`
- `EVENT_POINTS_AUTO_AWARD`
- `NEON_EVENTS_LIST_PATH`
- `NEON_EVENTS_DISABLE_LIVE_SYNC`
- `GPE_DONATION_PAYMENT_URL`
- `NEON_EVENT_REGISTRATION_URL_TEMPLATE`

### Validation Results

Commands run:

- `npm run build`: passed.
- `npm run lint`: failed with existing TypeScript/ESLint issues, including `no-explicit-any`, React hook dependency warnings, and `no-control-regex` in shared Edge helpers.
- `npx eslint supabase/functions/camp-gpe-challenge-submit/index.ts`: passed after the Camp challenge authentication repair.
- `node --check gpe-form-membership.js`: passed after adding the shared Supabase session-token helper.
- Targeted source scan for Strategic Plan, Digital Campaigns, and Contact: no matches for global nav/footer, hash-only links, mojibake, legacy view-switching calls, copied Wix gallery DOM, or Instagram CDN URLs.
- `node scripts/audit-wix-embeds.js`: exits successfully with warnings for raw Wix/reference exports.
- Frontend secret scan over `gpe-mirror` and Hub frontend source found no exposed `SUPABASE_SERVICE_ROLE_KEY`, `NEON_API_KEY`, Action Network secret, or Resend key.

### Ordered Deployment Plan

Phase A - source control prep:

1. Create a deployment branch.
2. Install dependencies with the repository’s Node workflow.
3. Run `npm run build`.
4. Run `npm run lint` and resolve or formally waive existing lint failures.
5. Run `node scripts/audit-wix-embeds.js`.
6. Review the diff, open a PR, and obtain review.

Phase B - database and Supabase:

1. Confirm Supabase project link because no `supabase/config.toml` exists.
2. Back up the target database.
3. Review and apply migrations in order.
4. Verify RLS policies and storage buckets.
5. Configure auth redirect URLs and email templates.
6. Deploy Edge Functions.
7. Set required function secrets.

Phase C - Neon:

1. Confirm Neon organization/account IDs and API credentials.
2. Confirm membership level and term IDs.
3. Confirm constituent dedupe rules and custom field mappings.
4. Confirm event IDs/statuses and event registration URLs.
5. Test sandbox or low-risk records before production smoke tests.

Phase D - email and notifications:

1. Confirm provider, currently source-compatible with Resend via `GPE_EMAIL_PROVIDER`.
2. Verify sender domain and `GPE_TRANSACTIONAL_EMAIL_FROM`.
3. Verify `GPE_CONTACT_NOTIFICATION_TO`, defaulting policy, and Reply-To behavior.
4. Test staff notification and retry behavior.

Phase E - Neon hosted payments:

1. Configure `GPE_DONATION_PAYMENT_URL` with the approved Neon CRM hosted donation/payment URL.
2. Confirm the Neon hosted membership/payment form path for any paid membership branch before enabling it.
3. Verify one-time gifts, recurring gifts if enabled, tribute notes, confirmation receipts, cancel/return URLs, and Neon donation/member record creation.
4. Confirm the website does not collect card data and does not create a duplicate payment flow in Supabase.

Phase F - static HTML hosting:

1. Confirm how each `gpe-mirror/*.html` file is hosted.
2. Verify final hosted URLs and cache behavior.
3. Confirm Wix embeds point to current hosted files, not stale copies.

Phase G - Wix Editor:

1. Create/confirm pages for Strategic Plan, Digital Campaigns landing, each campaign subpage, Contact, and other embed pages.
2. Add/update HTML embeds with current production URLs.
3. Verify postMessage height behavior.
4. Add approved curated campaign portfolio assets or a stable social embed only if a reusable mechanism is confirmed.
5. Confirm slugs, SEO metadata, social images, desktop/tablet/mobile.
6. Publish only after backend and form smoke tests pass.

Phase H - end-to-end QA:

1. Test anonymous visitor, active Neon member without Hub, active Hub member, expired member, existing constituent without membership, brand-new visitor, ambiguous duplicate, admin, and ordinary member attempting admin access.
2. Test form success, backend failure, Neon write, email delivery, Neon hosted payment handoff, analytics, keyboard navigation, reduced motion, mobile overflow, and Wix iframe resizing.

Phase I - production release:

1. Approve code changes.
2. Apply migrations.
3. Configure secrets.
4. Deploy Edge Functions.
5. Configure Action Network or provider webhooks that are actually used by source.
6. Deploy hosted frontend/HTML.
7. Run backend smoke tests.
8. Update Wix embeds and native Instagram feed.
9. Publish Wix.
10. Run production smoke tests and monitor logs, Neon records, email, auth, analytics, and payment events.

Rollback plan:

- Hosted HTML: restore prior hosted artifact or Wix embed URL.
- Edge Functions: redeploy previous function bundle.
- Database: use backup and forward rollback migrations where destructive rollback is unsafe.
- Wix: revert embed URLs/native component changes and republish previous page version.
- Neon hosted payments: restore the previous hosted form URL or Wix CTA target.

## Production Status Language

Use these labels in reports:

- Implemented and verified locally
- Implemented but not live-tested
- Dependent on migration
- Dependent on Edge Function deployment
- Dependent on Neon credentials
- Dependent on Supabase secrets
- Dependent on Wix publishing
- Dependent on Neon hosted payment-form configuration
- Unresolved field mapping
- Unresolved event record
- Unresolved identity link

Do not describe the website or form system as fully production-ready until live Neon, Supabase Auth, Wix embed, form, Neon hosted payment, notification, and webhook smoke tests pass.
