# Neon Template Mapping

Status values in this document are intentionally conservative. The generated HTML is ready for review, but no template should be activated until the exact Neon merge tokens are pasted from the existing Neon template editor and a test email is approved.

## Global Rules

- Supabase Auth templates remain unchanged.
- Existing Neon schedules remain unchanged.
- Existing Neon templates should be copied before replacement.
- Bracketed `[[NEON_*]]` placeholders are documentation markers only.
- Replace placeholders with exact Neon merge tokens copied from Neon.
- Do not use Supabase variables such as `{{ .ConfirmationURL }}`, `{{ .Token }}`, or `{{ .Email }}`.

## Membership

| Template | Subject | Existing Neon Tokens Required | Button Token | Record Fields | Active | Schedule Enabled | Ready For Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Membership Registration | You can sit with us, girlie! 💖 | `[[NEON_FIRST_NAME_TOKEN]]`, `[[NEON_MEMBERSHIP_DETAILS_BLOCK]]` | `[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]` | Membership term, account link, receipt fields when present | Unknown | Unknown | Needs tokens |
| Membership Registration Pay Later | Your GPE membership is almost official 💖 | `[[NEON_PAYMENT_DETAILS_BLOCK]]` | `[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]` | Invoice, balance, payment due fields | Unknown | Unknown | Needs tokens |
| Membership Renewal | Still sitting with us 💖 | `[[NEON_MEMBERSHIP_DETAILS_BLOCK]]` | `[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]` | Renewal term, renewal date, account link | Unknown | Unknown | Needs tokens |
| Membership Renewal Pay Later | Your renewal is almost done 💖 | `[[NEON_PAYMENT_DETAILS_BLOCK]]` | `[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]` | Renewal invoice, balance, payment link | Unknown | Unknown | Needs tokens |
| Membership Due | Keep your seat with GPE 💖 | `[[NEON_MEMBERSHIP_DETAILS_BLOCK]]` | `[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]` | Renewal date, amount, membership term | Unknown | Unknown | Needs tokens |
| Membership Overdue | Girl, your membership needs attention 👀 | `[[NEON_PAYMENT_DETAILS_BLOCK]]` | `[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]` | Overdue balance, due date, payment link | Unknown | Unknown | Needs tokens |
| Membership Auto Renewal Enabled | Your GPE membership is set to renew 💖 | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | `[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]` | Schedule, amount, payment method | Unknown | Unknown | Needs tokens |
| Membership Auto Renewal Notice | Your GPE membership renews soon | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | `[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]` | Renewal date, amount, payment method | Unknown | Unknown | Needs tokens |
| Membership Auto Renewal Error | Your GPE renewal needs attention | `[[NEON_PAYMENT_DETAILS_BLOCK]]` | `[[NEON_PAYMENT_UPDATE_URL_TOKEN]]` | Error, retry, update-payment link | Unknown | Unknown | Needs tokens |

## Events

| Template | Subject | Existing Neon Tokens Required | Button Token | Record Fields | Active | Schedule Enabled | Ready For Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Event Registration | You’re on the list 💖 | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_EVENT_DETAILS_BLOCK]]` | `[[NEON_EVENT_REGISTRATION_URL_TOKEN]]` | Date, time, location, virtual link, ticket, registrant | Unknown | Unknown | Needs tokens |
| Event Registration Pay Later | Your event spot is almost set | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_EVENT_DETAILS_BLOCK]]` | `[[NEON_EVENT_PAYMENT_URL_TOKEN]]` | Invoice, event details, payment link | Unknown | Unknown | Needs tokens |
| Event Reminder | Girl, we’re almost live 👀 | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_EVENT_DETAILS_BLOCK]]` | `[[NEON_EVENT_LINK_TOKEN]]` | Date, time, location or join link | Unknown | Unknown | Needs tokens |
| Waitlist Confirmation | You’re on the waitlist | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_WAITLIST_DETAILS_BLOCK]]` | None | Waitlist position, event details | Unknown | Unknown | Needs tokens |
| Notify Me | We’ll let you know | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_NOTIFY_ME_DETAILS_BLOCK]]` | None | Event interest fields | Unknown | Unknown | Needs tokens |
| Attendee Confirmation | You’re checked in 💖 | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_ATTENDANCE_DETAILS_BLOCK]]` | None | Attendance record and event details | Unknown | Unknown | Needs tokens |
| Attendee Reminder | Don’t forget to pull up | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_EVENT_DETAILS_BLOCK]]` | `[[NEON_EVENT_LINK_TOKEN]]` | Date, time, location or join link | Unknown | Unknown | Needs tokens |
| Refund Release | Your event refund was processed | `[[NEON_EVENT_NAME_TOKEN]]`, `[[NEON_REFUND_DETAILS_BLOCK]]` | None | Refund amount, payment method, transaction | Unknown | Unknown | Needs tokens and legal review |
| Exchange | Your event registration was updated | `[[NEON_EXCHANGE_DETAILS_BLOCK]]` | `[[NEON_EVENT_REGISTRATION_URL_TOKEN]]` | Old registration, new registration, balance | Unknown | Unknown | Needs tokens |

## Donations

| Template | Subject | Existing Neon Tokens Required | Button Token | Record Fields | Active | Schedule Enabled | Ready For Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Donation Appreciation | You just put resources behind the work 💖 | `[[NEON_RECEIPT_BLOCK]]`, `[[NEON_TRANSACTION_ID_TOKEN]]` | Website URL | Receipt, amount, fund, payment, tax, deductibility | Unknown | Unknown | Needs receipt review |
| Donation Appreciation Pay Later | Your gift is almost complete | `[[NEON_RECEIPT_BLOCK]]` | `[[NEON_DONATION_PAYMENT_URL_TOKEN]]` | Invoice, amount, fund, payment link | Unknown | Unknown | Needs tokens |
| Donation Anniversary | A year of showing up 💖 | `[[NEON_DONATION_ANNIVERSARY_BLOCK]]` | Website URL | Anniversary fields | Unknown | Unknown | Needs tokens |
| Tribute Acknowledgement | A gift was made in your honor | `[[NEON_TRIBUTE_DETAILS_BLOCK]]` | None | Honoree, donor display, message | Unknown | Unknown | Needs tokens |
| Soft Credit Acknowledgement | A gift was connected to you | `[[NEON_SOFT_CREDIT_DETAILS_BLOCK]]` | None | Soft credit, donor display, amount when allowed | Unknown | Unknown | Needs tokens |
| Matched Donation Acknowledgement | Your gift got matched 💖 | `[[NEON_MATCHED_DONATION_DETAILS_BLOCK]]` | None | Match company, original gift, matched amount | Unknown | Unknown | Needs tokens |
| Recurring Created | Your recurring gift is set 💖 | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | None | Amount, frequency, schedule, payment method | Unknown | Unknown | Needs tokens |
| Recurring Updated | Your recurring gift was updated | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | None | Amount, frequency, schedule, payment method | Unknown | Unknown | Needs tokens |
| Recurring Paused | Your recurring gift is paused | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | None | Pause date, schedule | Unknown | Unknown | Needs tokens |
| Recurring Cancelled | Your recurring gift was cancelled | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | None | Cancellation date and schedule | Unknown | Unknown | Needs tokens |
| Recurring Notice | Your recurring gift is coming up | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | None | Upcoming payment date, amount, payment method | Unknown | Unknown | Needs tokens |
| Recurring Error | Your recurring gift needs attention | `[[NEON_RECURRING_SCHEDULE_BLOCK]]` | `[[NEON_PAYMENT_UPDATE_URL_TOKEN]]` | Error, retry, update-payment link | Unknown | Unknown | Needs tokens |
| Pledge Invoice | Your GPE pledge invoice | `[[NEON_PLEDGE_DETAILS_BLOCK]]` | `[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]` | Pledge amount, due date, balance, tax language | Unknown | Unknown | Needs tokens |
| Pledge Overdue | Your GPE pledge needs attention | `[[NEON_PLEDGE_DETAILS_BLOCK]]` | `[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]` | Overdue amount, due date, balance | Unknown | Unknown | Needs tokens |

## Purchases

| Template | Subject | Existing Neon Tokens Required | Button Token | Record Fields | Active | Schedule Enabled | Ready For Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Purchase Complete | Your GPE purchase is complete | `[[NEON_PURCHASE_RECEIPT_BLOCK]]` | None | Item, payment, tax, receipt | Unknown | Unknown | Needs receipt review |
| Refund | Your GPE refund was processed | `[[NEON_REFUND_DETAILS_BLOCK]]` | None | Refund amount, original purchase, transaction | Unknown | Unknown | Needs legal review |
| Exchange | Your GPE exchange was processed | `[[NEON_EXCHANGE_DETAILS_BLOCK]]` | None | Old item, new item, balance, transaction | Unknown | Unknown | Needs tokens |

## Volunteers

| Template | Subject | Existing Neon Tokens Required | Button Token | Record Fields | Active | Schedule Enabled | Ready For Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Volunteer Form Submitted | We got your volunteer form 💖 | `[[NEON_VOLUNTEER_FORM_DETAILS_BLOCK]]` | Website URL | Volunteer form fields | Unknown | Unknown | Needs tokens |
