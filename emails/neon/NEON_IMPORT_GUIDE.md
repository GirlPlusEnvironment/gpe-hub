# Neon Import Guide

Last updated: 2026-07-29

This guide documents where to install the generated Neon CRM email HTML. Do not publish these automatically. Copy the current live Neon template first, replace bracket placeholders with exact Neon merge fields from the Neon editor, send a test, then activate only after review.

Navigation notes are based on Neon One support docs for System Emails and System Email & Letter Automation Settings:

- https://support.neonone.com/hc/en-us/articles/4407408950413-System-Emails
- https://support.neonone.com/hc/en-us/articles/4407398527501-System-Email-Letter-Automation-Settings

Neon sender must remain:

`Girl Plus Environment <hello@girlplusenvironment.org>`

## Neon Navigation

Official Neon One documentation places system emails at:

Settings cog
-> Global Settings
-> Communications
-> Transaction Acknowledgements
-> System Emails

On the System Emails page:

1. Select the correct tab: Account, Donation, Event, Membership, Store, or Neon Pay.
2. Select the email type row or its action menu.
3. Choose Edit Settings & Versions or build a new version.
4. Paste the generated HTML only after replacing placeholders with exact Neon merge tokens.
5. Confirm sender settings stay `Girl Plus Environment <hello@girlplusenvironment.org>`.
6. Send a test email before enabling any condition or default version.

Neon documentation also says system emails are controlled by System Email & Letter Defaults. Check:

Settings cog
-> Global Settings
-> Communications
-> Transaction Acknowledgements
-> System Emails or System Letters

Then review the automation settings for logged-in constituents and public form submissions.

## Account Emails

| Neon email | Purpose | Subject | Preview text | Required merge fields | Neon location | HTML file |
| --- | --- | --- | --- | --- | --- | --- |
| Account Form Confirmation | Confirms a Neon Account Form submission, including Neon Forms such as Camp GPE, Grad Highlight, volunteer forms, and future surveys | We got your form 💖 | Your form was received by Girl Plus Environment. | `[[NEON_FIRST_NAME_TOKEN]]`, `[[NEON_ACCOUNT_CONFIRMATION_BLOCK]]` | System Emails -> Account tab -> Account Form Confirmation | `emails/neon/account/account-confirmation.html` |
| Volunteer Form Submitted | Confirms a Neon Volunteer Form submission | We got your volunteer form 💖 | Thanks for raising your hand. | `[[NEON_VOLUNTEER_FORM_DETAILS_BLOCK]]` | System Emails -> Account tab -> Volunteer Form Submitted | `emails/neon/volunteers/volunteer-submitted.html` |

## Membership Emails

| Neon email | Purpose | Subject | Preview text | Required merge fields | Neon location | HTML file |
| --- | --- | --- | --- | --- | --- | --- |
| Membership Registration | New membership confirmation | You can sit with us, girlie! 💖 | Thanks for becoming a Girl Plus Environment member. | `[[NEON_FIRST_NAME_TOKEN]]`, `[[NEON_MEMBERSHIP_DETAILS_BLOCK]]`, `[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]` | System Emails -> Membership tab -> Membership Registration | `emails/neon/membership/membership-registration.html` |
| Membership Registration Pay Later | New membership awaiting payment | Your GPE membership is almost official 💖 | Complete payment to activate your membership. | `[[NEON_PAYMENT_DETAILS_BLOCK]]`, `[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]` | System Emails -> Membership tab -> Membership Registration - Pay Later | `emails/neon/membership/membership-registration-pay-later.html` |
| Membership Renewal Completion Notice | Renewal completed | Still sitting with us 💖 | Your GPE membership is active for another term. | `[[NEON_MEMBERSHIP_DETAILS_BLOCK]]`, `[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]` | System Emails -> Membership tab -> Membership Renewal Completion Notice | `emails/neon/membership/membership-renewal.html` |
| Membership Renewal Pay Later | Renewal awaiting payment | Your renewal is almost done 💖 | Complete payment to finish your renewal. | `[[NEON_PAYMENT_DETAILS_BLOCK]]`, `[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]` | System Emails -> Membership tab -> Membership Renewal - Pay Later | `emails/neon/membership/membership-renewal-pay-later.html` |
| Membership Due | Renewal due notice | Keep your seat with GPE 💖 | Your GPE membership is ready for renewal. | `[[NEON_MEMBERSHIP_DETAILS_BLOCK]]`, `[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]` | System Emails -> Membership tab -> Membership Due | `emails/neon/membership/membership-due.html` |
| Membership Overdue | Lapsed renewal notice | Girl, your membership needs attention 👀 | Your renewal date has passed. | `[[NEON_PAYMENT_DETAILS_BLOCK]]`, `[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]` | System Emails -> Membership tab -> Membership Overdue | `emails/neon/membership/membership-overdue.html` |
| Membership Auto-Renewal Enabled | Auto-renewal setup confirmation | Your GPE membership is set to renew 💖 | Auto-renewal is on for your membership. | `[[NEON_RECURRING_SCHEDULE_BLOCK]]`, `[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]` | System Emails -> Membership tab -> Membership Auto-Renewal Enabled | `emails/neon/membership/membership-auto-renewal-enabled.html` |
| Membership Auto-Renewal Notice | Upcoming auto-renewal notice | Your GPE membership renews soon | Your membership is scheduled to auto-renew. | `[[NEON_RECURRING_SCHEDULE_BLOCK]]`, `[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]` | System Emails -> Membership tab -> Membership Auto-Renewal Notice | `emails/neon/membership/membership-auto-renewal-notice.html` |
| Membership Auto-Renewal Error Notice | Auto-renewal payment issue | Your GPE renewal needs attention | Your auto-renewal payment needs review. | `[[NEON_PAYMENT_DETAILS_BLOCK]]`, `[[NEON_PAYMENT_UPDATE_URL_TOKEN]]` | System Emails -> Membership tab -> Membership Auto-Renewal Error Notice | `emails/neon/membership/membership-auto-renewal-error.html` |

## Event Emails

| Neon email | Purpose | Subject | Preview text | Required merge fields | Neon location | HTML file |
| --- | --- | --- | --- | --- | --- | --- |
| Event Registration | Event registration confirmation | You’re on the list 💖 | Your event registration is confirmed. | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_EVENT_DETAILS_BLOCK]]`, `[[NEON_EVENT_REGISTRATION_URL_TOKEN]]` | System Emails -> Event tab -> Event Registration | `emails/neon/events/event-registration.html` |
| Event Registration Pay Later | Event registration awaiting payment | Your event spot is almost set | Complete payment for your event registration. | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_EVENT_DETAILS_BLOCK]]`, `[[NEON_EVENT_PAYMENT_URL_TOKEN]]` | System Emails -> Event tab -> Event Registration - Pay Later | `emails/neon/events/event-registration-pay-later.html` |
| Event Reminder | Scheduled event reminder | Girl, we’re almost live 👀 | Your GPE event is coming up. | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_EVENT_DETAILS_BLOCK]]`, `[[NEON_EVENT_LINK_TOKEN]]` | System Emails -> Event tab -> Event Reminder | `emails/neon/events/event-reminder.html` |
| Waitlist Confirmation | Event waitlist confirmation | You’re on the waitlist | We saved your place on the waitlist. | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_WAITLIST_DETAILS_BLOCK]]` | System Emails -> Event tab -> Waitlist Confirmation | `emails/neon/events/waitlist-confirmation.html` |
| Notify Me | Full-event notify-me confirmation | We’ll let you know | We saved your notify-me request. | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_NOTIFY_ME_DETAILS_BLOCK]]` | System Emails -> Event tab -> Notify Me | `emails/neon/events/notify-me.html` |
| Attendee Confirmation | Next Generation Event attendee ticket confirmation | You’re checked in 💖 | Your attendee details are confirmed. | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_ATTENDANCE_DETAILS_BLOCK]]` | System Emails -> Event tab -> Attendee Confirmation | `emails/neon/events/attendee-confirmation.html` |
| Attendee Reminder | Next Generation Event attendee reminder | Don’t forget to pull up | Your event attendee reminder is here. | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_EVENT_DETAILS_BLOCK]]`, `[[NEON_EVENT_LINK_TOKEN]]` | System Emails -> Event tab -> Attendee Reminder | `emails/neon/events/attendee-reminder.html` |
| Refund and Release | Event refund or release notice | Your event refund was processed | Your event refund or release was processed. | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_REFUND_DETAILS_BLOCK]]` | System Emails -> Event tab -> Refund and Release | `emails/neon/events/refund-release.html` |
| Exchange | Event exchange notice | Your event registration was updated | Your event registration exchange was processed. | `[[NEON_EXCHANGE_DETAILS_BLOCK]]`, `[[NEON_EVENT_REGISTRATION_URL_TOKEN]]` | System Emails -> Event tab -> Exchange | `emails/neon/events/exchange.html` |

## Donation Emails

| Neon email | Purpose | Subject | Preview text | Required merge fields | Neon location | HTML file |
| --- | --- | --- | --- | --- | --- | --- |
| Donation Appreciation | Donation receipt and acknowledgement | You just put resources behind the work 💖 | Thank you for giving to Girl Plus Environment. | `[[NEON_RECEIPT_BLOCK]]`, `[[NEON_TRANSACTION_ID_TOKEN]]` | System Emails -> Donation tab -> Donation Appreciation | `emails/neon/donations/donation-appreciation.html` |
| Donation Appreciation Pay Later | Donation payment pending | Your gift is almost complete | Finish your gift when you are ready. | `[[NEON_RECEIPT_BLOCK]]`, `[[NEON_DONATION_PAYMENT_URL_TOKEN]]` | System Emails -> Donation tab -> Donation Appreciation - Pay Later | `emails/neon/donations/donation-appreciation-pay-later.html` |
| Donation Anniversary | Donation anniversary message | A year of showing up 💖 | Thank you for another year of care. | `[[NEON_DONATION_ANNIVERSARY_BLOCK]]` | System Emails -> Donation tab -> Donation Anniversary | `emails/neon/donations/donation-anniversary.html` |
| Tribute Acknowledgement | Tribute gift acknowledgement | A gift was made in your honor | Someone made a gift connected to you. | `[[NEON_TRIBUTE_DETAILS_BLOCK]]` | System Emails -> Donation tab -> Tribute Acknowledgement | `emails/neon/donations/tribute-acknowledgement.html` |
| Soft Credit Acknowledgement | Soft credit recipient acknowledgement | A gift was connected to you | A donation was credited to your support. | `[[NEON_SOFT_CREDIT_DETAILS_BLOCK]]` | System Emails -> Donation tab -> Soft Credit Recipient Acknowledgement | `emails/neon/donations/soft-credit-acknowledgement.html` |
| Matched Donation Acknowledgement | Matched donation notice | Your gift got matched 💖 | Your donation was matched. | `[[NEON_MATCHED_DONATION_DETAILS_BLOCK]]` | System Emails -> Donation tab -> Matched Donation Acknowledgement | `emails/neon/donations/matched-donation-acknowledgement.html` |
| Recurring Created | Recurring donation schedule created | Your recurring gift is set 💖 | Your recurring gift schedule was created. | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | System Emails -> Donation tab -> Recurring Schedule Created | `emails/neon/donations/recurring-created.html` |
| Recurring Updated | Recurring donation schedule updated | Your recurring gift was updated | Your recurring gift schedule changed. | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | System Emails -> Donation tab -> Recurring Schedule Updated | `emails/neon/donations/recurring-updated.html` |
| Recurring Paused | Recurring donation schedule paused | Your recurring gift is paused | Your recurring gift schedule was paused. | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | System Emails -> Donation tab -> Recurring Schedule Paused | `emails/neon/donations/recurring-paused.html` |
| Recurring Cancelled | Recurring donation schedule cancelled | Your recurring gift was cancelled | Your recurring gift schedule was cancelled. | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | System Emails -> Donation tab -> Recurring Schedule Cancelled | `emails/neon/donations/recurring-cancelled.html` |
| Recurring Notice | Upcoming recurring donation notice | Your recurring gift is coming up | Your recurring gift is scheduled soon. | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | System Emails -> Donation tab -> Recurring Donation Notice | `emails/neon/donations/recurring-notice.html` |
| Recurring Error | Recurring donation payment issue | Your recurring gift needs attention | Your recurring gift payment needs review. | `[[NEON_RECURRING_SCHEDULE_BLOCK]]`, `[[NEON_PAYMENT_UPDATE_URL_TOKEN]]` | System Emails -> Donation tab -> Recurring Donation Error | `emails/neon/donations/recurring-error.html` |
| Pledge Invoice | Pledge invoice | Your GPE pledge invoice | Your pledge invoice is ready. | `[[NEON_PLEDGE_DETAILS_BLOCK]]`, `[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]` | System Emails -> Donation tab -> Pledge Invoice | `emails/neon/donations/pledge-invoice.html` |
| Pledge Overdue | Pledge overdue notice | Your GPE pledge needs attention | Your pledge is overdue. | `[[NEON_PLEDGE_DETAILS_BLOCK]]`, `[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]` | System Emails -> Donation tab -> Pledge Overdue | `emails/neon/donations/pledge-overdue.html` |

## Store Emails

| Neon email | Purpose | Subject | Preview text | Required merge fields | Neon location | HTML file |
| --- | --- | --- | --- | --- | --- | --- |
| Purchase Acknowledgement | Store purchase receipt | Your GPE purchase is complete | Your store purchase was processed. | `[[NEON_PURCHASE_RECEIPT_BLOCK]]` | System Emails -> Store tab -> Purchase Acknowledgement | `emails/neon/purchases/purchase-complete.html` |
| Refund | Store refund notice | Your GPE refund was processed | Your purchase refund was processed. | `[[NEON_REFUND_DETAILS_BLOCK]]` | System Emails -> Store tab -> Refund | `emails/neon/purchases/refund.html` |
| Exchange | Store exchange notice | Your GPE exchange was processed | Your purchase exchange was processed. | `[[NEON_EXCHANGE_DETAILS_BLOCK]]` | System Emails -> Store tab -> Exchange | `emails/neon/purchases/exchange.html` |

## Manual Checks Before Publish

- Confirm every bracket placeholder has been replaced with a real Neon merge token.
- Confirm receipt, tax, deductibility, refund, and payment language remains legally complete.
- Confirm sender remains `Girl Plus Environment <hello@girlplusenvironment.org>`.
- Confirm the correct system email type is active only after a reviewed test.
- Confirm System Email & Letter Defaults match the desired online/public form behavior.
