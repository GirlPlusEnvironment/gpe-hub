# Neon CRM Email Templates

These files are draft HTML, plain-text, and preview assets for Neon CRM email templates.

Do not use this directory for Supabase Auth templates. The existing Supabase templates for confirm signup, invite user, magic link, OTP, change email address, reset password, and reauthentication should remain unchanged.

## Ownership

Neon CRM continues to send emails tied directly to Neon records:

- Event registration
- Event reminders
- Waitlist emails
- Event payment notices
- Donation receipts
- Recurring donation notices
- Tribute and matching-gift acknowledgements
- Membership payment confirmations
- Membership renewals
- Membership due and overdue notices
- Volunteer form confirmations
- Purchases and refunds

Supabase plus Resend owns Hub lifecycle emails such as pending points, Hub activation, challenge completion, friend invitations, and public action follow-ups.

## Design

The Neon templates use the approved GPE email visual system:

- Pink background
- Black hero
- White content card
- Three-pixel black borders
- Offset black shadow
- Cyan label
- Magenta button
- Courier body copy
- Arial Black headings
- Table layout
- Inline CSS
- Maximum width of 620px

The footer statement must remain exactly:

We've got those good jobs, resources, funding + mentors for black + brown femmes in climate. This is our place to share and make space for each other to lead this climate and environmental justice movement.

Do not add another mission statement below it.

## Merge Token Workflow

Neon merge fields vary by template type. The generated files intentionally use bracketed placeholders such as `[[NEON_FIRST_NAME_TOKEN]]`, `[[NEON_RECEIPT_BLOCK]]`, and `[[NEON_EVENT_LINK_TOKEN]]`.

Before publishing any Neon template:

1. Open the existing template in Neon.
2. Save a copy of the current Neon HTML and plain-text template outside the editor.
3. Copy the current Neon merge tokens for names, dates, receipts, payment links, account links, event links, and legal text.
4. Replace the bracketed placeholders in the generated HTML with the exact Neon tokens.
5. Preserve the receipt, refund, tax, deductibility, payment, and registration management fields already present in Neon.
6. Send a test email.
7. Review desktop and mobile rendering.
8. Publish only after the test is approved.

Do not use Supabase Auth variables in Neon templates, including `{{ .ConfirmationURL }}`, `{{ .Token }}`, or `{{ .Email }}`.

Do not invent Neon merge fields. If a token is unknown, leave the bracketed placeholder and mark the template as not ready.

## Preview

Generate all Hub and Neon email previews:

```bash
npm run emails:generate
```

Open the Neon preview index:

```text
emails/neon/previews/index.html
```

Each preview includes a desktop iframe, a narrow mobile iframe with long sample values, and a plain-text preview.

## Publishing Rules

- Do not activate templates automatically.
- Do not disable existing Neon emails.
- Do not alter Neon schedules.
- Do not publish until a test email has been reviewed.
- Do not remove legal, tax, receipt, payment, refund, pledge, or registration-management language.
- Do not paste private keys into these files.

## Secrets

Local secrets belong in ignored local env files such as `.env.local` or `supabase/.env.local`.

The committed `.env.example` should contain empty or placeholder values only.
