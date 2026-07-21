# GPE Public Form Parity Audit

Status: pre-deployment audit notes. Do not treat this as production approval.

Last updated: 2026-07-17.

## Standalone Page Shell Audit

The current final/custom public pages are intended to be embedded into Wix page sections. Wix supplies the global site header and footer.

Audited final/custom pages:

- `contact.html`
- `become-a-member.html`
- `camp-gpe.html`
- `events.html`
- `donate.html`
- `gpe-grad-highlight.html`
- `take-action.html`
- `mobile-climate-adaptation-survey.html`
- `coal-slush-fund-action.html`
- `high-energy-bills-action.html`

Current result:

- No audited final/custom page contains global `<header>`, `<footer>`, `<nav>`, `showView()`, `view-section`, mobile menu code, duplicate global social footer, or prototype routing.
- `contact.html` has been stripped of the prototype global nav/footer and fixed-header spacing while preserving the scrapbook contact composition.
- Dead prototype dropdown navigation CSS was removed from `become-a-member.html`, `donate.html`, and `gpe-grad-highlight.html`.
- `coal-slush-fund-action.html` used a semantic `<header>` for its campaign hero, not a global site header; it was converted to a page-specific `<section>` to keep the standalone audit clean without changing visible content.
- Reference exports and raw Wix mirrors still contain original shell markup and are not cleared for use as final standalone embeds without extraction.

## Become a Member

Source reviewed:

- `gpe-mirror/become-a-member.html`
- `gpe-mirror/become-a-member-form.html`
- `gpe-mirror/old-become-a-member.html`
- `supabase/functions/gpe-membership-enroll/index.ts`
- `supabase/functions/_shared/membership-request.ts`

### Current Custom Form Coverage

| Custom key | Source Neon field | Status |
|---|---|---|
| `firstName` | `account.name.firstName` | covered |
| `lastName` | `account.name.lastName` | covered |
| `email` | `account.email1` | covered |
| `phone` | phone/account contact field | covered as safe contact field |
| `addressLine1` | `account.address.line1.line1` | covered |
| `addressLine2` | `account.address.line2` | covered |
| `city` | `account.address.city` | covered |
| `state` | `account.address.stateOrProvince` | covered as text rather than Neon select |
| `zip` | `account.address.zipCode` | covered |
| `country` | `account.address.country` | covered as text rather than Neon select |
| `autoRenew` | `autoRenew` | covered, but source term is free/lifetime so backend does not create paid auto-renew payment |
| `consent` | explicit custom consent | covered |
| server config | `termId` / GPE Member | covered via `DEFAULT_MEMBERSHIP_LEVEL_ID` and `DEFAULT_MEMBERSHIP_TERM_ID`; source export shows GPE Member, term id `1`, cost `0` |

### Missing or Deferred Neon Branches

The Neon export contains branches and machinery that are not fully replicated in the custom page:

- `account.asCompany`
- `account.company.name`
- submember enrollment fields
- contact selection for submembers
- Neon hosted payment-preparation flow
- raw card/payment token fields
- donation add-on widgets
- Neon reCAPTCHA/request metadata

Payment-card fields must remain excluded from custom HTML and Supabase tables. If paid memberships or donation add-ons are required inside membership, they need a secure provider redirect or tokenized payment flow, not direct browser-to-Supabase card collection.

### Backend Membership Behavior

`gpe-membership-enroll` currently:

- saves the custom submission to Supabase first
- checks existing Neon membership through `resolveMembership`
- returns already-member without creating a duplicate active membership
- fails closed for ambiguous account matches
- creates or matches the Neon account server-side
- creates the membership through `createMembershipServerSide`
- uses `DEFAULT_MEMBERSHIP_LEVEL_ID` and `DEFAULT_MEMBERSHIP_TERM_ID`
- queues Hub invitation after membership creation

Inactive or expired Neon accounts proceed through the same server-side membership creation path. Before production, confirm in Neon whether this should be treated as renewal/reactivation against the prior membership record or a new membership term.

### UX Updates Completed

- Replaced the bare success message with a free membership confirmation and optional donation next step.
- Added “Continue for Free” and “Add a Donation” choices after membership save.
- Added next-step links to Camp GPE, Hub, and Take Action.
- Made the decorative “YES / OF COURSE” choices keyboard-accessible radio-style controls.
- Made the criteria checklist keyboard-accessible toggle controls.
- Restored a layered eraser/photo/lined-paper collage treatment with hand-drawn floral SVG accents behind the composition.
- Updated the sticky note to a square yellow note with straight edges, subtle paper texture, one small tape piece, black outline, and brutalist shadow.
- Removed tape from the member photo and kept the photo unobstructed with a black border and shadow.
- Moved “MAKE YOUR MARK” onto a separate lined notebook-paper card and kept the eraser fully visible.

### Production Blockers

- Confirm the actual Neon membership level and term IDs and set them as Supabase secrets.
- Confirm whether expired memberships should be renewed, reactivated, or recreated.
- Confirm whether membership should include any paid add-on or donation option beyond linking to the donation page.
- Run live Neon/Hub smoke tests with secrets in a non-production environment.

## Donation

Source reviewed:

- `gpe-mirror/donate.html`
- `gpe-mirror/donate-form.html`
- `gpe-mirror/old-donate.html`
- `supabase/functions/gpe-donation-intake/index.ts`

Current coverage:

- `frequency`: required, `one_time` or `monthly`.
- `amount`: required, current public options are `$50`, `$125`, `$200`, `$500`.
- `otherAmount`: optional safe amount intent.
- `firstName`, `lastName`, `email`: required contact fields.
- `phone`, `city`, `state`, `zip`, `tributeNote`: optional safe donor context.
- `website`: honeypot only.
- No public membership lookup is performed on `donate.html`.
- No Hub password, Hub activation, or membership conversion panel is shown on `donate.html`.

Payment boundary:

- The custom page never collects card, CVC, tokenized card, or bank fields.
- `gpe-donation-intake` rejects payment-card-looking payloads.
- Supabase stores only donation intent/contact data first.
- `gpe-donation-intake` does not call `neon-membership-check`, does not create memberships, and returns `membershipOutcome: "not_checked"`.
- Actual payment completion depends on `GPE_DONATION_PAYMENT_URL`.
- If that URL is missing, the frontend shows that the payment link is not configured and does not claim the gift is complete.

Image rendering:

- The donation community photo previously used a forced `aspect-video object-cover` treatment against a 760x700 source image, which made the hero/supporting image feel vertically distorted.
- The image now uses a page-scoped `.donation-community-photo` class with natural responsive proportions: `width: 100%`, `height: auto`, `aspect-ratio: auto`, and `object-fit: contain`.
- The existing rounded corners, brutalist border, and shadow remain on the wrapper.

Deferred:

- Confirm the final secure processor URL and whether it accepts amount, frequency, and submission ID query parameters.
- Confirm one-time/monthly return URLs and cancellation handling.
- Confirm tribute/designation fields against the final Neon donation export if donation designations are required.

## Contact

Source reviewed:

- `gpe-mirror/contact.html`
- `gpe-mirror/contact-form.html`
- `gpe-mirror/old-contact.html`
- `supabase/functions/gpe-contact-submit/index.ts`

Current coverage:

- `firstName`: required, maps to Neon `name.firstName`.
- `lastName`: required, maps to Neon `name.lastName`.
- `email`: required, maps to Neon `email1` and safe identity lookup.
- `phone`: optional, maps to Neon `address.phone1.number` where supported and activity payload.
- `phoneType`: optional native select, maps to Neon `address.phone1.type`; allowed values are `M`, `H`, `W`.
- `message`: optional, maps to Neon custom field `134`, max 3000 characters.
- `fileAttachment`: optional secure share-link field for Neon custom field `135`, max 3000 characters.
- `website`: honeypot only.

Behavior:

- Contact remains available to everyone.
- Email lookup is simple, nonblocking, and uses public-safe identity states.
- Hub sign-in is optional and only shown after a Hub-account state.
- Passwords are handled through Supabase Auth only; no password is sent to Neon or stored in form payloads.
- No membership offer appears by default.
- `gpe-contact-submit` saves the message to Supabase first, then creates/matches a Neon constituent when safe and writes a Neon activity.
- If Neon is unavailable, the message remains saved and is marked for pending sync/review.
- After the Supabase save, `gpe-contact-submit` sends a branded staff notification email to `GPE_CONTACT_NOTIFICATION_TO` or `hello@girlplusenvironment.org`.
- The staff notification is independent of Neon sync. A temporary Neon sync failure does not prevent the staff email attempt.
- Staff email delivery status is stored on `gpe_form_submissions` as `staff_notification_status`, provider, provider message ID, timestamp, last error, and retry count.
- Submitter confirmation email is intentionally not enabled until transactional copy and communications rules are approved.

Visual/page status:

- The duplicate global nav and footer were removed from `contact.html`.
- The current pink dotted scrapbook/brutalist Contact design was preserved.
- Unsplash placeholders were replaced with one supplied GPE Summit photo and one lined-paper collage card.
- Image rendering preserves proportions; the photo uses intentional square cropping with `object-fit: cover`, never `fill`.

Deferred:

- Direct binary file upload for Neon custom field `135` is not implemented. A secure upload provider should be selected before collecting files in custom HTML.
- Live Neon account/activity sync and staff notification behavior must be tested with real secrets before production.
- Staff notifications require a transactional email provider. Current implementation supports Resend through `GPE_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `GPE_TRANSACTIONAL_EMAIL_FROM`, and `GPE_CONTACT_NOTIFICATION_TO`.

## Camp GPE

Source reviewed:

- `gpe-mirror/camp-gpe.html`
- `gpe-mirror/camp-gpe-sign-up-form.html`
- `gpe-mirror/camp-gpe-challenge-form.html`
- `supabase/functions/camp-gpe-submit/index.ts`
- `supabase/functions/camp-gpe-challenge-submit/index.ts`
- `supabase/functions/camp-gpe-challenges/index.ts`
- `src/lib/camp.ts`

Registration coverage:

- Required: `firstName`, `lastName`, `email`.
- Optional: `phone`, `instagram`, `tiktok`, `linkedin`, `openToCollaborations`, `otherAccounts`, `membershipConsent`.
- Duplicate Camp registration is checked in `gpe_form_registrations` with `form_key = camp_gpe`.
- Camp season membership is saved separately in `gpe_season_members`.
- General GPE membership and Camp registration remain separate concepts.
- If no active Neon membership is found and `membershipConsent = consent`, `camp-gpe-submit` calls `createMembershipServerSide` from `_shared/membership-request.ts`, then queues Hub invitation when appropriate.
- Ambiguous account matches are saved for manual review and do not create duplicate accounts.

Challenge coverage:

- Required: `email` only.
- Optional: `firstName`, `lastName`, selected `challengeIds`, `actions`, `otherAction`, proof links, social handles, social post links, and notes.
- Challenge options are loaded from `camp-gpe-challenges`, which reads active database challenge records.
- Selected actions are normalized into `gpe_camp_submission_actions`.
- Automatic points are awarded only through `rpc/auto_approve_camp_submission_action`.
- Point totals remain ledger-backed through the Camp database views/RPCs.

Deferred:

- Confirm all seeded challenge point values against the authoritative Camp point system.
- Run live duplicate registration and partial Hub-invitation-failure smoke tests after secrets are configured.

## GPE Grad Highlight

Source reviewed:

- `gpe-mirror/gpe-grad-highlight.html`
- `gpe-mirror/gpe-grad-highlight-form.html`
- `supabase/functions/gpe-grad-highlight-submit/index.ts`

Current coverage:

- Required: `firstName`, `lastName`, `email`, `instagram`, `celebration`, `photoConfirmation`.
- Membership preflight uses the shared helper.
- Submission is Supabase-first, then Neon account/activity sync happens server-side.
- No production-facing `alert()` handler remains in the final page.

Deferred:

- The current public form asks the submitter to email the photo. A future upload provider should be selected before collecting file binaries in this custom form.
- Confirm the exact photo release/permissions language if the original Neon export included more detailed release text.

## Mobile Climate Adaptation Survey

Source reviewed:

- `gpe-mirror/mobile-climate-adaptation-survey.html`
- `docs/neon-field-map.md`
- `supabase/functions/neon-climate-survey/index.ts`

Current coverage:

- Complete field-by-field survey mapping remains documented in `docs/neon-field-map.md`.
- `age` is stored in `surveyPayload.age`; it is not written to address line 1.
- City, state/province, and ZIP are the only address fields written as address fields.
- Submission is Supabase-first and Neon survey answers are preserved in a Neon activity because a supported hosted-survey response creation endpoint has not been confirmed.

Deferred:

- The survey page still has its own membership-check implementation rather than fully delegating UI state to `gpe-form-membership.js`. Its visible messages are aligned, but the helper should be unified in a later cleanup pass.

## Events

Source reviewed:

- `gpe-mirror/events.html`
- `gpe-mirror/old-events.html`
- `supabase/functions/neon-events-public/index.ts`
- `supabase/functions/neon-event-register/index.ts`
- `supabase/functions/_shared/neon-events.ts`
- `docs/gpe-events-neon-integration.md`

Current coverage:

- `events.html` is isolated to page content and no longer includes the prototype header/footer shell.
- Event display loads through `neon-events-public`, which syncs safe public event fields from Neon and falls back to the Supabase cache.
- Registration intent uses `neon-event-register`, saves Supabase first, checks membership, checks existing Neon registration when possible, and returns a Neon registration URL for ticketing/payment/capacity completion.
- The page does not claim registration is complete unless the server reports an existing Neon registration.

Deferred:

- Confirm `NEON_EVENTS_LIST_PATH` against the exact Neon event API available to the GPE account.
- Configure `NEON_EVENT_REGISTRATION_URL_TEMPLATE` before publishing registration CTAs.
- Add a final attendance reconciliation/admin path before awarding Impact Points automatically for events.
