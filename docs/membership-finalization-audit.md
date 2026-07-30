# Membership Finalization & Neon Data Audit

## Findings

The direct membership creation call was shared, but finalization was not. `createMembershipServerSide` created a Neon membership and resolved local pending Hub profile state, then returned. Each caller was responsible for remembering the remaining workflow.

Grad Highlight created a membership and queued a Hub invite, but did not trigger the `member-welcome` lifecycle email. Camp, Climate Survey, Event Registration, and Become a Member each had their own variation of the same post-processing, which made silent email/invite failures easy to miss.

Demographic fields were normalized by `membership-schema.ts` and stored in local form/lead payloads, but they were not mapped into Neon account or membership custom fields. The only Neon account fields consistently sent were identity/contact fields available during account creation.

## Shared Finalization

Membership-producing workflows now use `createAndFinalizeMembership`.

This shared finalizer:

- creates the Neon membership
- invalidates membership lookup cache through the existing membership creation path
- resolves pending Hub profiles and claims pending awards through the existing membership creation path
- records a Neon `GPE Membership Profile Data` activity with the collected membership profile and mapping report
- queues the Hub invitation
- triggers the `member-welcome` lifecycle email
- returns explicit email, invite, profile activity, and mapping statuses

## Mapping Report

| Frontend Field | Neon Destination | Status |
| --- | --- | --- |
| First Name | Individual primary contact `firstName` | Working |
| Last Name | Individual primary contact `lastName` | Working |
| Email | Individual primary contact `email1` | Working |
| Phone | Individual primary contact `phone1` | Working when collected by workflow |
| City | Individual primary contact address `city` | Working when collected by workflow |
| State | Individual primary contact address `stateProvince` | Working when collected by workflow |
| Zip | Individual primary contact address `zipCode` | Working when collected by workflow |
| Age Range | Account custom field | Missing Neon field ID |
| Race/Ethnicity | Account custom field | Missing Neon field ID |
| Race/Ethnicity Self-description | Account custom field | Missing Neon field ID |
| Gender Identity | Account custom field | Missing Neon field ID |
| Gender Self-description | Account custom field | Missing Neon field ID |
| Climate Interests | Account custom field | Missing Neon field ID |
| Communication Preferences | Account custom field | Missing Neon field ID |
| Office Hours Interest | Account custom field | Missing Neon field ID |
| Email Consent | Account custom field or consent field | Missing Neon field ID |
| SMS Consent | Account custom field or consent field | Missing Neon field ID |
| Terms/Privacy Consent | Internal consent audit | Intentionally ignored for Neon profile fields |
| Eligibility Affirmation | Internal eligibility audit | Intentionally ignored for Neon profile fields |

## Required Neon Configuration

The code now looks for these optional environment variables while producing the mapping report:

- `NEON_MEMBERSHIP_FIELD_AGE_RANGE`
- `NEON_MEMBERSHIP_FIELD_RACE_ETHNICITY`
- `NEON_MEMBERSHIP_FIELD_RACE_ETHNICITY_OTHER`
- `NEON_MEMBERSHIP_FIELD_GENDER_IDENTITY`
- `NEON_MEMBERSHIP_FIELD_GENDER_IDENTITY_OTHER`
- `NEON_MEMBERSHIP_FIELD_CLIMATE_INTERESTS`
- `NEON_MEMBERSHIP_FIELD_COMMUNICATION_PREFERENCES`
- `NEON_MEMBERSHIP_FIELD_OFFICE_HOURS_INTEREST`
- `NEON_MEMBERSHIP_FIELD_EMAIL_CONSENT`
- `NEON_MEMBERSHIP_FIELD_SMS_CONSENT`

Until those production Neon custom field IDs and option IDs are confirmed, demographic values are preserved in Neon as the `GPE Membership Profile Data` activity and in Supabase form/lead payloads, but not written into discrete Neon custom fields.

## Manual Verification Still Required

A live Neon test must confirm:

- `member-welcome` lifecycle email is queued by the email service
- Hub invitation is queued or sent
- `GPE Membership Profile Data` activity appears on the Neon account
- each configured custom field ID accepts the expected value or option ID
