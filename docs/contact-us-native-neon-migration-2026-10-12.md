# Contact Us Native Neon Form 12 Migration — 2026-10-12

## Decision

Neon Form 12 must become the only browser-side Contact Us intake when this migration is published. The current `gpe-contact-submit` browser handler must not run alongside it because that would create a second account/activity/email path without a supported shared idempotency identifier.

The prepared Wix replacement is `wix/contact-us-neon-native.html`. It includes the exact Neon-generated embed script:

```html
<script src='https://girlplusenvironment.app.neoncrm.com/forms/share/Rk9STS1FTUJFRFNIQVJJTkctQ09ERTEy'></script>
```

No production cutover has been made.

## Embed behavior

Inspection of the supplied script confirms that it:

- creates an iframe for `https://girlplusenvironment.app.neoncrm.com/forms/contact-us`;
- requests `hideTheme=1`, so the surrounding Neon theme is omitted while the form fields retain their Neon Form Builder styling;
- verifies `postMessage` origins against `https://girlplusenvironment.app.neoncrm.com`;
- resizes the iframe in response to Neon's `iframeHeight` messages;
- supports scroll-to-top and constituent-login messages;
- handles Neon's `neonCrmResult` result token and loads the Neon result page in the iframe;
- has no documented or exposed completion callback containing submitted fields, account ID, native submission ID, or form-submission payload.

Only height, scrolling, iframe-ready, login, and embed-token messages are exposed by the generated script. Those messages must not be treated as proof that a submission completed.

## Field comparison

| Existing GPE field | Neon Form 12 field | Required | Mapping status |
|---|---|---:|---|
| First Name | `name.firstName` / First Name | Yes | Matched |
| Last Name | `name.lastName` / Last Name | Yes | Matched |
| Email | `email1` / Email | Yes | Matched |
| Phone number | `address.phone1.number` / Phone 1 | No | Matched |
| Phone type | `address.phone1.type` / Home, Mobile, Other, Work | No | Matched; Neon additionally offers Other |
| Message | Account custom field `134` / Message | No | Matched; maximum 3,000 characters |
| File Attachment | Account custom field `135` / File Attachment | No | Functionally improved: Neon supplies a real single-file upload with a 25 MB limit; the custom Wix form only accepted a share URL |
| Hub membership lookup/sign-in panel | No Form 12 field | No | Intentionally removed; it is not part of the contact inquiry and cannot safely wrap a cross-origin Neon form |
| Spam honeypot | Neon reCAPTCHA and Neon form protections | Internal | Replaced by the native form's supported protection |

No current visitor-facing Contact Us question is lost. The backend's dormant `organization`, `contactReason`, and `subject` fields were not present in the published custom Wix form and therefore are not a migration gap.

## Required-field behavior

The captured live Form 12 rules require First Name, Last Name, and Email. Email format validation is enabled. Message and File Attachment are optional, and both are limited by Neon configuration. This matches the existing custom Wix page's required fields.

If GPE operational policy requires every inquiry to contain a message, change **Message → Required** in Neon Form 12 before publishing the Wix replacement. That is a Neon Form Builder change, not a Wix or Supabase change.

## Styling boundary

The replacement preserves the current GPE page heading, pink dotted background, black brutalist borders/shadows, magenta/yellow/cyan palette, community photo collage, note card, responsive single-column mobile layout, reduced-motion support, and fallback hosted-form link.

Because the form is cross-origin inside an iframe, Wix CSS cannot style fields within it. Field typography, controls, colors, button, file uploader, error messages, reCAPTCHA, and exit page must be configured in Neon Form 12's Form/Theme/Exit Page editors. The current Neon theme already uses GPE pink styling and a responsive field layout.

## Supabase and Activity limitation

The official embed does not expose submitted values or a native submission identifier. Neon also does not document a Form Submission webhook. Its supported CRM webhooks cover Accounts, Activities, Donations, Event Registrations, Memberships, Orders, and Pledge Payments.

An Account create/update webhook cannot reliably prove that Form 12 was submitted:

- an existing account may be updated rather than created;
- the webhook does not document a native Form 12 submission ID;
- other Neon operations can create or update the same account;
- message custom-field changes do not provide a safe per-submission idempotency key.

Therefore the safe initial production architecture is:

1. Form 12 native submission is authoritative.
2. Neon owns constituent matching, validation, reCAPTCHA, file upload, and its configured exit page.
3. `gpe-contact-submit` remains deployed but is removed from the Contact Wix frontend.
4. Supabase backup, secondary Activity, and Resend staff notification are marked **not automatically preserved** until Neon supplies a supported correlation mechanism or export/API for native submissions.
5. Do not infer completion from iframe load, height messages, account webhooks, or the presence of `neonCrmResult` in the outer URL unless Neon documents that contract for integrations.

## Notifications

The public form HTML and generated embed do not disclose whether Form 12 has a staff notification or constituent acknowledgement enabled. Before cutover, a Neon administrator must inspect Form 12's notification/system-email settings and run a manual test.

During the native-only phase, the Supabase/Resend Contact notification must not be invoked from the page. Otherwise a submission would need to be independently sent to `gpe-contact-submit`, creating duplicate account/activity/email behavior. Neon should be configured as the sole sender for any Form 12 staff or visitor email until a supported post-submission reconciliation exists.

## Test evidence

- The exact embed script was fetched successfully and inspected.
- The prepared page rendered correctly at desktop width.
- On localhost, the iframe returned HTTP 403 because localhost is not an approved Neon Supported Domain. This confirms domain enforcement; it is not a production-form failure.
- The hosted Form 12 rendered all expected fields and native file uploader.
- A clearly labeled browser test was filled, but Neon reCAPTCHA refused headless automation (`No reCAPTCHA clients exist`). Neon displayed its failure state and no success/result navigation occurred. The test was therefore **not submitted**, and no native submission is claimed.
- Native dashboard verification remains pending a human test from an approved Wix preview/production origin and an authenticated Neon dashboard check.

## Wix installation and acceptance procedure

1. In Neon Form 12 → Sharing → Embed, confirm Supported Domains include:
   - `https://www.girlplusenvironment.org`
   - `https://girlplusenvironment.org`
   - `https://editor.wix.com`
   - the site's UUID-based `https://<metaSiteId>.filesusr.com` domain
   - `https://www-girlplusenvironment-org.filesusr.com`
2. In Wix Studio, open the Contact Us page.
3. Select the existing Contact HTML embed element.
4. Choose **Enter Code** and replace its complete contents with `wix/contact-us-neon-native.html`.
5. Set the element width to 100% and provide enough initial height for the page; the Neon script manages its inner iframe height, while Wix still controls the outer HTML component height.
6. Preview in Wix. Confirm the form appears instead of 403, and test desktop and mobile layouts.
7. Submit one human-completed record labeled `GPE NATIVE FORM 12 WIX ACCEPTANCE — 2026-10-12`.
8. In Neon, open Contact Us → Form Submissions and verify the exact label, all fields, account association, file behavior if tested, and timestamp.
9. Inspect the associated account and confirm whether Neon itself creates any Activity. Do not assume it does.
10. Confirm staff and visitor email behavior using Neon Emails/Sent Emails and the receiving inboxes.
11. Confirm no new `contact` row or `contact_activity` log is created in Supabase for the native-only test; that is the expected temporary limitation, not a silent success.
12. Publish Wix only after steps 6–11 pass. Keep the old HTML available for rollback, but do not leave both forms active on the page.

## Historical records

The 14 Supabase records cannot be inserted into Form 12 history through a documented public API. They must not be replayed as new submissions because that would change dates and may trigger account changes or email. Preserve their existing Supabase rows and Activities, provide a restricted staff export, and ask Neon Support whether an internal timestamp-preserving, email-suppressed import is available.
