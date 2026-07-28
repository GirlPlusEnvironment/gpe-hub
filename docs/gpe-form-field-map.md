# GPE Custom Form Field Map

This map lists the custom frontend keys, source labels, Neon IDs where found, and server destinations.

## Camp GPE Registration

| Key | Label | Type | Required | Neon destination | Allowed values / notes |
|---|---|---:|---:|---|---|
| `firstName` | First Name | text | yes | `account.name.firstName` | account field |
| `lastName` | Last Name | text | yes | `account.name.lastName` | account field |
| `email` | Email | email | yes | `account.email1` | membership preflight key |
| `phone` | Phone Number | tel | no | `account.address.phone1.number` | phone type in export had Home/Mobile/Other/Work |
| `instagram` | Instagram Handle | text | no | custom field `130` | |
| `tiktok` | TikTok Handle | text | no | custom field `138` | |
| `linkedin` | LinkedIn URL | url | no | custom field `137` | |
| `openToCollaborations` | Open to Collaborations? | radio | no | custom field `136` | `yes` = option `136`; `no` = option `80` |
| `otherAccounts` | Other Accounts? | textarea | no | custom field `134` | |
| `membershipConsent` | Become a Girl Plus Environment member with this Camp registration | checkbox | no | Neon membership creation via `DEFAULT_MEMBERSHIP_LEVEL_ID` / `DEFAULT_MEMBERSHIP_TERM_ID` | `consent`; production currently returns partial failure until these secrets are configured |

## Camp GPE Challenge

| Key | Label | Type | Required | Neon destination | Allowed values / notes |
|---|---|---:|---:|---|---|
| `firstName` | First Name | text | no | `account.name.firstName` when supplied; Neon activity payload | |
| `lastName` | Last Name | text | no | `account.name.lastName` when supplied; Neon activity payload | |
| `email` | Email | email | yes | `account.email1` | |
| `challenge` | Which Challenge are you submitting? | select | no | custom field `139`; review queue `challenge_key`, defaults to `unspecified` when blank | `challenge_1` option `81`; `challenge_2` option `82`; `challenge_3` option `83`; `challenge_4` option `84` |
| `actions` | Which actions did you take? | checkbox | no | custom field `141`; Neon activity payload | `petition` option `141`; `share_petition` option `88`; `feed_post` option `89`; `shared_friend` option `90`; `other` |
| `otherAction` | Other action | text | no | Neon activity payload | shown when Other is selected |
| `screenshotLinks` | Upload screenshot(s) | textarea | no | custom field `135` | Custom form stores pasted/upload links; file upload provider still needs final production choice. |
| `instagram` | Instagram Handle | text | no | custom field `130` | |
| `linkedin` | LinkedIn URL | url | no | custom field `137` | |
| `tiktok` | TikTok Handle | text | no | custom field `138` | |
| `socialLinks` | Share Links to Social Media Posts | textarea | no | custom field `134` | |
| `notes` | Notes | textarea | no | Neon activity payload | |

## Membership

| Key | Label | Type | Required | Neon destination | Allowed values / notes |
|---|---|---:|---:|---|---|
| `firstName` | First Name | text | yes | `account.name.firstName` | |
| `lastName` | Last Name | text | yes | `account.name.lastName` | |
| `email` | Email | email | yes | `account.email1` | membership check first |
| `phone` | Phone Number | tel | no | `account.address.phone1.number` | |
| `addressLine1` | Address Line 1 | text | no | `account.address.line1.line1` when supplied | |
| `addressLine2` | Address Line 2 | text | no | `account.address.line2` when supplied | |
| `city` | City | text | no | `account.address.city` when supplied | |
| `state` | State/Province | text | no | `account.address.stateOrProvince` when supplied | |
| `zip` | ZIP/Postal Code | text | no | `account.address.zipCode` when supplied | |
| `country` | Country | text | no | `account.address.country` when supplied | default United States |
| `membershipLevel` | Membership Level | server config | yes | server membership creation config | Export shows `GPE Member`, term ID `1`, cost `0`; production uses `DEFAULT_MEMBERSHIP_LEVEL_ID` and `DEFAULT_MEMBERSHIP_TERM_ID` instead of hardcoding HTML values. These secrets are not currently configured in production, so real membership creation cannot be certified yet. |
| `autoRenew` | I would like to automatically renew my membership | checkbox | no | membership option | included from export, though the term is free/lifetime |
| `eligibilityAffirmed` | I identify as a Black or Brown girl, woman, femme, or gender-expansive person | checkbox | yes | canonical membership payload; exact Neon custom field pending dashboard confirmation | `yes` |
| `ageRange` | Age range | select | yes | canonical membership payload; exact Neon custom field pending dashboard confirmation | `under_18`, `18_24`, `25_34`, `35_44`, `45_plus`, `prefer_not_to_say` |
| `raceEthnicity` | Race/ethnicity | checkbox | yes | canonical membership payload; exact Neon custom field pending dashboard confirmation | `black_african_american`, `latina_latine_hispanic`, `indigenous_native`, `asian_pacific_islander`, `middle_eastern_north_african`, `multiracial`, `self_describe` |
| `raceEthnicityOther` | Race/ethnicity self-description | text | no | canonical membership payload; exact Neon custom field pending dashboard confirmation | |
| `genderIdentity` | Gender identity | checkbox | no | canonical membership payload; exact Neon custom field pending dashboard confirmation | `girl`, `woman`, `femme`, `gender_expansive`, `nonbinary`, `self_describe`, `prefer_not_to_say` |
| `genderIdentityOther` | Gender self-description | text | no | canonical membership payload; exact Neon custom field pending dashboard confirmation | |
| `climateInterests` | Climate interests | checkbox | no | canonical membership payload; exact Neon custom field pending dashboard confirmation | `energy_justice`, `extreme_weather`, `clean_beauty`, `climate_mental_health`, `green_jobs`, `community_advocacy` |
| `communicationPreferences` | Communication preferences | checkbox | no | canonical membership payload; exact Neon custom field pending dashboard confirmation | `email`, `sms`, `events`, `office_hours` |
| `interestedInOfficeHours` | Interested in attending GPE Office Hours | checkbox | no | canonical membership payload; exact Neon automation field pending dashboard confirmation | `yes`; must be remapped to exact Neon field/option before automation parity is claimed |
| `emailConsent` | Email consent | checkbox | yes | canonical membership payload; exact Neon consent field pending dashboard confirmation | `yes` |
| `smsConsent` | SMS consent | checkbox | no | canonical membership payload; exact Neon consent field pending dashboard confirmation | `yes` |
| `termsConsent` | Terms/privacy consent | checkbox | yes | canonical membership payload; exact Neon consent field pending dashboard confirmation | `yes` |
| `consent` | Membership consent | checkbox | yes | submission consent | required before server membership create/reactivation |

## Donation Intake

| Key | Label | Type | Required | Neon destination | Allowed values / notes |
|---|---|---:|---:|---|---|
| `amount` | Donation Amount | radio | yes | donation intake payload | `$50`, `$125`, `$200`, `$500`; Neon CRM hosted donation/payment flow owns donation completion |
| `frequency` | Frequency | select | yes | donation intake payload | `one_time`, `monthly` |
| `otherAmount` | Other Amount | text | no | donation intake payload | safe amount intent only |
| `firstName` | First Name | text | yes | account match/create | |
| `lastName` | Last Name | text | yes | account match/create | |
| `email` | Email | email | yes | membership/account lookup | |
| `phone` | Phone Number | tel | no | safe contact payload | |
| `city` | City | text | no | safe contact payload | |
| `state` | State | text | no | safe contact payload | |
| `zip` | ZIP Code | text | no | safe contact payload | |
| `tributeNote` | Tribute or donor note | textarea | no | safe donation note | |

Raw card fields from the Neon export are intentionally excluded from the custom page and Supabase tables.

## Neon Runtime Configuration

Membership creation must not be treated as successful unless Neon returns a membership ID. Production currently needs these Supabase secrets before end-to-end membership certification can pass:

| Secret | Purpose | Current impact if missing |
|---|---|---|
| `DEFAULT_MEMBERSHIP_LEVEL_ID` | Neon membership level for new GPE members | Membership-capable flows save the submission, then return partial failure instead of false success |
| `DEFAULT_MEMBERSHIP_TERM_ID` | Neon membership term for new GPE members | Membership-capable flows save the submission, then return partial failure instead of false success |
| `NEON_ACTIVITY_TIMEZONE_ID` | Required by Neon CRM v2 `/activities` `activityDates.timeZone.id` | Activity logging fails before sending invalid JSON |
| `NEON_ACTIVITY_STATUS_ID` | Shared fallback status ID for Neon activity records | Activity logging fails before sending invalid JSON when no specific status secret is set |
| `NEON_ACTIVITY_COMPLETED_STATUS_ID` | Completed status ID for saved survey/highlight/contact activity records | Needed to log completed activity records without relying on the shared fallback |
| `NEON_ACTIVITY_OPEN_STATUS_ID` | Open status ID for membership request fallback activities | Needed only for membership request fallback activity records |

## GPE Grad Highlight

| Key | Label | Type | Required | Neon destination | Allowed values / notes |
|---|---|---:|---:|---|---|
| `firstName` | First Name | text | yes | `account.name.firstName` | |
| `lastName` | Last Name | text | yes | `account.name.lastName` | |
| `email` | Email | email | yes | `account.email1` | |
| `instagram` | Instagram Handle | text | yes | custom field `130` | |
| `celebration` | What are you celebrating? | textarea | yes | custom field `131` | |
| `photoConfirmation` | Photo confirmation | radio | yes | custom field `132` | `yes` option `132`; `contact_me` option `78` |

## Mobile Climate Adaptation Survey

The complete survey field map remains in `docs/neon-field-map.md`. The corrected `age` destination is `surveyPayload.age`; city, state/province, and ZIP are the only address destinations used by the custom survey.
