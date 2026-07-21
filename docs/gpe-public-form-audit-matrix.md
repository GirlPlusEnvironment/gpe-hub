# GPE Public Form Audit Matrix

Status: pre-deployment implementation audit. This file documents the current custom form parity state and remaining production blockers. It is not a deployment approval.

Last updated: 2026-07-18.

## Summary

| Page | Form | Source reviewed | Current backend | Status |
|---|---|---|---|---|
| `contact.html` | Contact Us | `contact-form.html`, `old-contact.html` | `gpe-contact-submit` | Native custom contact form; simple nonblocking identity lookup; no membership offer by default; staff notification email after Supabase save. |
| `become-a-member.html` | Membership enrollment | `become-a-member-form.html`, `old-become-a-member.html` | `gpe-membership-enroll` | Functional custom free-membership flow; any paid/add-on membership branch should use the approved Neon CRM hosted membership/payment form path. |
| `donate.html` | Donation intake | `donate-form.html`, `old-donate.html` | `gpe-donation-intake` | Safe intake only; no public membership lookup; payment completion requires the configured Neon CRM hosted donation/payment URL. |
| `camp-gpe.html` | Camp registration | `camp-gpe-sign-up-form.html` | `camp-gpe-submit` | Functional; Camp registration and GPE membership remain separate. |
| `camp-gpe.html` | Camp challenge submission | `camp-gpe-challenge-form.html`, Camp challenge DB config | `camp-gpe-challenge-submit`, `camp-gpe-challenges` | Functional dynamic challenge submission; challenge config is database-sourced. |
| `gpe-grad-highlight.html` | Grad Highlight submission | `gpe-grad-highlight-form.html` | `gpe-grad-highlight-submit` | Functional; photo is collected by email instruction, not direct upload. |
| `mobile-climate-adaptation-survey.html` | Mobile Climate Adaptation Plan Survey | `neon-form-survey.html`, `docs/neon-field-map.md` | `neon-climate-survey` | Functional survey payload; original Neon hosted survey response endpoint remains unconfirmed. |
| `events.html` | Event listing and registration intent | `old-events.html`, Neon event docs/config | `neon-events-public`, `neon-event-register` | Neon-backed listing/registration handoff with curated Hot Girls Hate Extreme Heat display fallback. |
| `coal-slush-fund-action.html` | Action Network petition | Action Network widget source | Action Network widget plus `camp-gpe-action-network-ingest` future webhook path | External petition remains Action Network-owned; country initial-render CSS fix is present. |
| `high-energy-bills-action.html` | Action Network letter | Action Network widget source | Action Network widget plus `camp-gpe-action-network-ingest` future webhook path | External letter remains Action Network-owned; country initial-render CSS fix is present. |

## Wix Header/Footer Audit

Standalone Wix-embedded public pages must not include their own global site shell. The scan covered:

- `become-a-member.html`
- `camp-gpe.html`
- `events.html`
- `donate.html`
- `gpe-grad-highlight.html`
- `take-action.html`
- `mobile-climate-adaptation-survey.html`
- `contact.html`
- `coal-slush-fund-action.html`
- `high-energy-bills-action.html`

Result:

- No global `<header>`, `<footer>`, `<nav>`, `showView()`, `view-section`, mobile menu, duplicate social footer, or prototype routing remains in the audited final/custom pages.
- `contact.html` now has no embedded global nav/footer and no fixed-header spacing. Its main content begins naturally inside the Wix embed.
- Removed dead prototype `.nav-dropdown` / `.nav-item` CSS from `become-a-member.html`, `donate.html`, and `gpe-grad-highlight.html`.
- Converted the Coal Slush Fund page's page-specific campaign `<header>` wrapper to a `<section>` with an accessible label. This was a semantic cleanup only; it did not remove campaign content or visual design.
- `camp-gpe-toolkit.html` contains a page-specific sticky toolkit navigation and campaign logo/media-library references; these are not global Wix navigation.
- Legacy/reference exports such as `old-events.html`, `old-donate.html`, `old-become-a-member.html`, `neon-form-survey.html`, `gpe-community-hub.html`, and raw Wix/blog mirror files still contain exported Wix/Neon shell markup and should not be published as the standalone custom pages without a separate extraction pass.

## Public Image Rendering Audit

Image rendering standard:

- Do not use `object-fit: fill`.
- Do not force unrelated width/height combinations that distort people, faces, or campaign artwork.
- Use `height: auto` or `object-fit: contain` when the full source image should remain visible.
- Use `object-fit: cover` only when intentional artistic cropping is acceptable.

Current audit result:

- `donate.html`: fixed the community photo distortion by removing the forced `aspect-video object-cover` treatment. The image now uses a page-scoped `.donation-community-photo` class with `width: 100%`, `height: auto`, `aspect-ratio: auto`, and `object-fit: contain`, preserving the original 760x700 proportions inside the existing rounded brutalist frame.
- `become-a-member.html`: the member photo uses a near-source aspect ratio in the collage and `object-cover` for natural cropping, not stretching. No `object-fit: fill` or forced mismatched inline image dimensions were found.
- `events.html`: the hero and card artwork use `object-cover` inside editorial image crops. This is intentional cropping for event artwork, not stretching. The required Camp GPE, Hot Girls Hate Extreme Heat, and Beyond the Table images remain mapped.
- `gpe-grad-highlight.html`: the Grad Highlight artwork is full-width with no forced height; `object-cover` does not distort it in the current markup.
- `camp-gpe.html`, `take-action.html`, and `mobile-climate-adaptation-survey.html`: no direct `<img>` tags were found in the audited current custom files.
- `contact.html`: replaced the two Unsplash placeholders with one supplied GPE Summit photo plus a lined-paper collage card. The photo uses `object-fit: cover` only inside an intentional square crop, with no `object-fit: fill` or stretched width/height pair.
- `camp-gpe-toolkit.html`: media previews use `object-fit: contain` for campaign assets, which preserves proportions.

## Membership UX and Payload

Shared browser helper:

- `gpe-mirror/gpe-form-membership.js`

Current behavior:

- Debounces valid email lookup.
- Uses server-side `neon-membership-check`.
- Uses public-safe identity states: `hub_user_active_member`, `hub_user_no_active_membership`, `neon_member_needs_hub_activation`, `expired_member`, `existing_constituent_no_membership`, `new_person`, `ambiguous_match`, and `lookup_unavailable`.
- Shows inline status beneath the email field.
- Creates a shared inline opt-in panel for nonmember, inactive/expired member, or existing constituent without active membership states.
- Reveals Hub sign-in controls only after `hub_user_active_member`.
- Reveals Hub activation guidance after `neon_member_needs_hub_activation`.
- Requires explicit membership consent when the inline membership panel is selected.
- Emits `membershipRequest` with reused name/email/phone/city/state/ZIP values where available.
- Does not expose Neon or Supabase service-role secrets.

Server-side membership creation paths:

- Primary membership page: `gpe-membership-enroll` -> `resolveMembership` -> `resolveOrCreateAccount` -> `createMembershipServerSide` -> `queueHubInvitation`.
- Contact: `gpe-contact-submit` saves the message first, then creates/matches a Neon constituent when safe and writes a Neon activity with custom field references `134` and `135`.
- Contact: staff notification is sent after Supabase save regardless of Neon sync result. Delivery state is stored on the submission as notification status, provider, provider message ID, timestamp, last error, and retry count.
- Camp registration: `camp-gpe-submit` -> `resolveOrCreateAccount` -> optional `createMembershipServerSide` when `membershipConsent = consent` -> `queueHubInvitation`.
- Camp challenge: `camp-gpe-challenge-submit` saves challenge first, then optional `createMembershipServerSide` for consented `membershipRequest`.
- Donation: `gpe-donation-intake` saves donation intent first and redirects to the configured Neon CRM hosted donation/payment URL. It does not run public membership lookup or membership creation.
- Grad Highlight: `gpe-grad-highlight-submit` saves highlight first, then optional `createMembershipServerSide` for consented `membershipRequest`.
- Events: `neon-event-register` saves registration intent first, then optional `createMembershipServerSide` for consented `membershipRequest`.

## Field Matrix

### Contact Us

| Original field | Current field | Required | Backend destination | Status / reason |
|---|---|---:|---|---|
| Form ID | `formId: 12` | yes metadata | `gpe_form_submissions.submission_payload.formId` | Preserved as metadata. |
| Page title | `Drop Your Name & a Message Below` | yes display/source | Contact intro copy | Preserved visually as the form intro. |
| `name.firstName` | `firstName` | yes | Neon account create/match | Restored. |
| `name.lastName` | `lastName` | yes | Neon account create/match | Restored. |
| `email1` | `email` | yes | Identity lookup, Neon account create/match | Restored. |
| `address.phone1.number` | `phone` | no | Neon account payload/activity note | Restored. |
| `address.phone1.type` | `phoneType` | no | Contact payload; allowed `M`, `H`, `W` | Restored as an accessible native select. Neon export defaulted to Mobile. |
| `customFields[0].id = 134` | metadata | yes metadata | Neon activity note custom field map | Preserved. |
| `customFields[0].value` / Message | `message` | no | Supabase payload and Neon activity note | Restored with 3000 character max. |
| `customFields[1].id = 135` | metadata | yes metadata | Neon activity note custom field map | Preserved. |
| `customFields[1].value` / File Attachment | `fileAttachment` | no | Supabase payload and Neon activity note | Restored as optional secure share-link field. Direct binary upload is deferred until an upload provider is selected. |
| Staff notification | n/a | n/a | Transactional email to `hello@girlplusenvironment.org` | Sent only after Supabase save. Uses escaped branded HTML, plain-text fallback, Reply-To submitter email, and submission ID idempotency. |
| Neon login/recovery modal | none | no | Supabase Auth optional sign-in panel | Intentionally replaced; public passwords use GPE Hub Supabase Auth only. |

Contact identity behavior:

- Runs a simple nonblocking safe email lookup.
- Allows guest submission for all identity states.
- Shows optional sign-in for Hub-account states, but does not require a password.
- Does not offer membership by default; Contact is communication, not conversion.
- Ambiguous or unavailable lookup is saved for review and does not block the message.
- Staff notification requires `GPE_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `GPE_TRANSACTIONAL_EMAIL_FROM`, and optionally `GPE_CONTACT_NOTIFICATION_TO`.
- Submitter confirmation email is intentionally disabled pending approved transactional copy and communications review.

### Authentication Policy Matrix

| Page | Neon form/source | Email check | Hub password | Membership offer | Header/footer removed | Live tested |
|---|---|---|---|---|---|---|
| `donate.html` | Donation | No | No | No | Yes | Pending |
| `contact.html` | Contact | Optional/simple | Optional sign-in only | No by default | Yes | Pending |
| `become-a-member.html` | Membership | Yes | Contextual | Primary purpose | Yes | Pending |
| `camp-gpe.html` registration | Camp enrollment | Yes | Contextual | Yes | Yes | Pending |
| `camp-gpe.html` challenge | Challenge submission | Yes | Required/verified | Required/verified | Yes | Pending |
| `events.html` | Event registration | Yes | Optional unless members-only | Optional | Yes | Pending |
| `mobile-climate-adaptation-survey.html` | Survey | Yes | Optional | Optional | Yes | Pending |
| `gpe-grad-highlight.html` | Submission | Yes | Optional | Optional | Yes | Pending |

### Become a Member

| Original field | Current field | Required | Backend destination | Status / reason |
|---|---|---:|---|---|
| `account.name.firstName` | `firstName` | yes | Neon account create/match | Restored. |
| `account.name.lastName` | `lastName` | yes | Neon account create/match | Restored. |
| `account.email1` | `email` | yes | Membership lookup and Neon account | Restored. |
| Phone | `phone` | no | Neon account payload where supported | Restored as safe contact field. |
| Address line 1 | `addressLine1` | no | Neon account payload where supported | Restored. |
| Address line 2 | `addressLine2` | no | Neon account payload where supported | Restored. |
| City | `city` | no | Neon account payload where supported | Restored. |
| State/Province | `state` | no | Neon account payload where supported | Restored as text. |
| ZIP/Postal Code | `zip` | no | Neon account payload where supported | Restored. |
| Country | `country` | no | Neon account payload where supported | Restored as text default. |
| Membership level / term | server config | yes | `DEFAULT_MEMBERSHIP_LEVEL_ID`, `DEFAULT_MEMBERSHIP_TERM_ID` | Intentionally server-side. |
| Auto-renew | `autoRenew` | no | Stored in submission; not used for card payment | Present, but production should confirm relevance for free membership. |
| Membership consent | `consent` | yes | Required before membership create | Restored. |
| Company membership branch | none | conditional | none | Deferred; original Neon branch documented. |
| Submember branch | none | conditional | none | Deferred; not implemented in custom free-membership flow. |
| Card/payment fields | none | conditional | Neon CRM hosted membership/payment form only | Intentionally excluded; never store card data in Supabase. |
| Optional donation add-on | post-submit donation link | no | `donate.html#donation` / Neon hosted donation path | Implemented as optional support step, not membership payment. |

### Donation

| Original field | Current field | Required | Backend destination | Status / reason |
|---|---|---:|---|---|
| Donation frequency | `frequency` | yes | `gpe_form_submissions.submission_payload.fields.frequency` | Restored. |
| Donation amount | `amount` | yes | safe donation intent | Restored: `$50`, `$125`, `$200`, `$500`. |
| Other amount | `otherAmount` | no | safe donation intent | Restored. |
| First name | `firstName` | yes | safe donor contact | Restored. |
| Last name | `lastName` | yes | safe donor contact | Restored. |
| Email | `email` | yes | safe donor contact | Restored. |
| Phone | `phone` | no | safe donor contact | Restored. |
| City | `city` | no | safe donor contact | Restored. |
| State | `state` | no | safe donor contact | Restored. |
| ZIP | `zip` | no | safe donor contact | Restored. |
| Tribute / donor note | `tributeNote` | no | safe donation note | Restored. |
| Card/CVC/payment token | none | yes in hosted payment step | Neon CRM hosted donation/payment form | Intentionally excluded from custom HTML and Supabase. |
| Optional membership | none | no | none | Intentionally removed from Donate; giving should continue directly to secure payment. |

### Camp Registration

| Original field | Current field | Required | Backend destination | Status / reason |
|---|---|---:|---|---|
| First Name | `firstName` | yes | Neon account, form submission | Restored. |
| Last Name | `lastName` | yes | Neon account, form submission | Restored. |
| Email | `email` | yes | Neon account, registration uniqueness | Restored. |
| Phone Number | `phone` | no | Neon account/activity | Restored. |
| Instagram Handle | `instagram` | no | Neon custom/activity payload | Restored. |
| TikTok Handle | `tiktok` | no | Neon custom/activity payload | Restored. |
| LinkedIn URL | `linkedin` | no | Neon custom/activity payload | Restored. |
| Open to Collaborations? | `openToCollaborations` | no | Neon custom/activity payload | Restored. |
| Other Accounts? | `otherAccounts` | no | Neon custom/activity payload | Restored. |
| Membership consent | `membershipConsent` | no | optional free membership create | Restored and server-connected. |

Duplicate Camp registration is checked in `gpe_form_registrations`; Camp season membership is stored in `gpe_season_members`. General GPE membership is not treated as Camp enrollment.

### Camp Challenge

| Original field | Current field | Required | Backend destination | Status / reason |
|---|---|---:|---|---|
| Contact email | `email` | yes | form submission, Neon account match/create, Camp season member | Restored. |
| First name | `firstName` | no | optional account/activity payload | Restored. |
| Last name | `lastName` | no | optional account/activity payload | Restored. |
| Selected challenge | `challengeIds` | conditional | `gpe_camp_submission_actions.challenge_id` | Replaced static challenge list with DB-sourced active challenges. |
| Action categories | `actions` | no | `gpe_camp_submission_actions` / payload | Restored. |
| Other write-in | `otherAction` | required when Other | `other_description` | Restored. |
| Screenshot/proof links | `screenshotLinks` | conditional | `proof_urls` | Restored; required only when selected challenge requires proof. |
| Instagram | `instagram` | no | activity/payload | Restored. |
| TikTok | `tiktok` | no | activity/payload | Restored. |
| LinkedIn | `linkedin` | no | activity/payload | Restored. |
| Social post links | `socialLinks` | no | `proof_urls` / payload | Restored. |
| Notes | `notes` | no | payload/activity | Restored. |
| Optional membership | shared inline `membershipRequest` | no | optional server membership create | Added. |

### GPE Grad Highlight

| Original field | Current field | Required | Backend destination | Status / reason |
|---|---|---:|---|---|
| First name | `firstName` | yes | Neon account/activity | Restored. |
| Last name | `lastName` | yes | Neon account/activity | Restored. |
| Email | `email` | yes | Neon account/activity, membership lookup | Restored. |
| Instagram handle | `instagram` | yes | Neon activity/custom payload | Restored. |
| Celebration text | `celebration` | yes | Neon activity/custom payload | Restored. |
| Photo confirmation | `photoConfirmation` | yes | Neon activity/custom payload | Restored. |
| Photo upload | email instruction | yes operationally | out-of-band email | Intentional: no upload provider selected for custom HTML. |
| Optional membership | shared inline `membershipRequest` | no | optional server membership create | Added. |

### Mobile Climate Adaptation Survey

The complete survey map is maintained in `docs/neon-field-map.md`.

Confirmed:

- All survey questions and option IDs are generated from the local field array.
- `age` is stored in `surveyPayload.age`, not address line 1.
- Only `city`, `stateOrProvince`, and `zipCode` map to address fields.
- Submission is Supabase-first and then Neon activity sync.

Remaining:

- The survey still uses its local membership-check function rather than the shared panel helper. It is behaviorally aligned but not fully refactored.

### Events

| Original/event source | Current field | Required | Backend destination | Status / reason |
|---|---|---:|---|---|
| Neon event ID | `neonEventId` | when Neon-backed | registration intent / Neon lookup | Restored for Neon events. |
| Event slug | `eventSlug` | yes | registration intent | Restored. |
| First name | `firstName` | yes | registration intent / membership lookup | Restored. |
| Last name | `lastName` | yes | registration intent / membership lookup | Restored. |
| Email | `email` | yes | registration intent / membership lookup | Restored. |
| Phone | `phone` | no | registration intent | Restored. |
| Accessibility notes | `accessNeeds` | no | registration intent payload | Restored. |
| Neon completion consent | `consent` | yes | registration intent payload | Restored. |
| Optional membership | shared inline `membershipRequest` | no | optional server membership create | Added. |
| Ticket/card/payment fields | none | handled by Neon | Neon hosted/portal registration | Intentionally excluded. |

Events page sources:

- Neon-backed events come from `neon-events-public`.
- `Hot Girls Hate Extreme Heat` is a curated local display event without a fake Neon ID.
- Featured hero prioritizes active Camp GPE, Hot Girls Hate Extreme Heat, Beyond the Table, then the next upcoming event.

### Action Network Petitions

| Page | Current source | Membership behavior | Camp points path | Status |
|---|---|---|---|---|
| `coal-slush-fund-action.html` | Action Network petition widget | Widget-owned form; no Neon secrets in browser | future/server webhook via `camp-gpe-action-network-ingest` | External widget retained. |
| `high-energy-bills-action.html` | Action Network letter widget | Widget-owned form; no Neon secrets in browser | future/server webhook via `camp-gpe-action-network-ingest` | External widget retained. |

Action Network remains the advocacy action source. Supabase ingestion is the operational path for Camp point linkage; public pages do not expose Action Network private credentials or Neon credentials.

## Remaining Production Blockers

- Run live Neon membership create/renewal tests in a non-production environment.
- Confirm Neon renewal semantics for inactive/expired members.
- Configure `DEFAULT_MEMBERSHIP_LEVEL_ID` and `DEFAULT_MEMBERSHIP_TERM_ID`.
- Configure `GPE_DONATION_PAYMENT_URL` with the approved Neon CRM hosted donation/payment URL and verify amount/frequency transfer.
- Configure `NEON_EVENT_REGISTRATION_URL_TEMPLATE`.
- Confirm Neon event API path and event status/date fields for the GPE account.
- Complete responsive screenshot QA before Wix publish.
- Decide whether the climate survey should be refactored to the shared membership panel helper in a follow-up pass.
