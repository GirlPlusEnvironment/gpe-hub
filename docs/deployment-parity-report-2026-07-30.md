# Deployment Parity Report - 2026-07-30

## Summary

The main production drift found in this pass was confirmed and corrected:

- `gpe-hub` production was serving an older GitHub Pages bundle.
- `girlplusenvironment.org` was serving an older `gpe-form-membership.js` from jsDelivr.
- The local `girlplusenvironment.org` and `gpe-mirror` copies were not fully identical for the Climate Survey fallback URLs.

The Hub and static helper deployment gaps are now closed. Live form submission tests and Edge Function logs are still required to verify Neon object creation.

## gpe-hub

| Check | Result |
| --- | --- |
| Latest deployed commit | `373e764fd7327358e8d7987865c504e17a388363` |
| GitHub Pages run | `30587294897` |
| GitHub Pages status | `completed / success` |
| Previous live entry bundle | `/assets/index-BjRrst3A.js` |
| Current live entry bundle | `/assets/index-CneHeMGU.js` |
| Local build entry bundle | `/assets/index-CneHeMGU.js` |
| Production parity | Verified for entry bundle and key chunks |

Verified live chunks:

| Area | Live Asset | Status |
| --- | --- | --- |
| Footer | `/assets/Footer-BHKEmWsz.js` | Contains new approved footer copy |
| Invite page | `/assets/Invite-IZ3Rk6r4.js` | Functional Invite a Member form is live |
| Camp Submit for Points | `/assets/CampChallengeDetail-CxwojWyk.js` | Opens embedded modal iframe instead of route-only redirect |
| Membership helper | `/assets/membership-DejDKEgd.js` | Calls `gpe-membership-enroll` and `hub-account-activation` |

Live footer no longer contains `A playful mission board...`.

## girlplusenvironment.org

Latest deployed static commit:

`e5fa299 Align static form membership helper`

The pushed static changes include:

- `become-a-member.html`
- `camp-gpe.html`
- `contact.html`
- `events.html`
- `gpe-form-membership.js`
- `gpe-grad-highlight.html`
- `mobile-climate-adaptation-survey.html`

The CDN copy of `gpe-form-membership.js` was stale before this pass:

| File | Repo SHA1 Before Purge | CDN SHA1 Before Purge | Status |
| --- | --- | --- | --- |
| `gpe-form-membership.js` | `4fdf61ee90a7130809d9ff54ea5b9aadf5b304f8` | `1bea9a1f78ac8c52ccd0d7af4fb926b2c7d26e58` | Stale CDN |

After push and jsDelivr purge:

| File | Repo SHA1 | CDN SHA1 | Status |
| --- | --- | --- | --- |
| `gpe-form-membership.js` | `4fdf61ee90a7130809d9ff54ea5b9aadf5b304f8` | `4fdf61ee90a7130809d9ff54ea5b9aadf5b304f8` | Verified |
| `gpe-choice-controls.js` | `1a2af2ed773bdeaf4bb9a42bee1b4d12dfbf18ea` | `1a2af2ed773bdeaf4bb9a42bee1b4d12dfbf18ea` | Verified |
| `gpe-action-network-dropdowns.js` | `289ca2c3b40f62c9643d61340258734969eedc98` | `289ca2c3b40f62c9643d61340258734969eedc98` | Verified |

jsDelivr purge results:

- `gpe-form-membership.js`: finished, not throttled.
- `become-a-member.html`: finished, not throttled.
- `mobile-climate-adaptation-survey.html`: finished, not throttled.

## gpe-mirror

The mirror directory is not a Git repository, so parity was checked by file hashes.

After the Climate Survey fallback URL correction, the primary static repo and mirror match for:

| File | Status |
| --- | --- |
| `become-a-member.html` | Match |
| `mobile-climate-adaptation-survey.html` | Match |
| `gpe-grad-highlight.html` | Match |
| `camp-gpe.html` | Match |
| `events.html` | Match |
| `contact.html` | Match |
| `gpe-form-membership.js` | Match |

## Static Page Script Coverage

| Page | Expected Shared JS | Script Tag Present | CDN Status | Inline Duplicate Risk | Endpoint |
| --- | --- | --- | --- | --- | --- |
| `become-a-member.html` | `gpe-choice-controls.js`, `gpe-form-membership.js` | Yes | 200 / verified hash | Uses page submit code plus shared helper | `gpe-membership-enroll` |
| `mobile-climate-adaptation-survey.html` | `gpe-choice-controls.js`, `gpe-form-membership.js` | Yes | 200 / verified hash | Uses page submit code plus shared helper | `neon-climate-survey` |
| `gpe-grad-highlight.html` | `gpe-choice-controls.js`, `gpe-form-membership.js` | Yes | 200 / verified hash | Uses page submit code plus shared helper | `gpe-grad-highlight-submit` |
| `camp-gpe.html` | `gpe-choice-controls.js`, `gpe-form-membership.js` | Yes | 200 / verified hash | Uses page submit code plus shared helper | `camp-gpe-submit` |
| `events.html` | `gpe-choice-controls.js`, `gpe-form-membership.js` | Yes | 200 / verified hash | Uses page submit code plus shared helper | `neon-event-register` |
| `coal-slush-fund-action.html` | `gpe-form-membership.js`, `gpe-action-network-dropdowns.js` | Yes | 200 / verified hash | Dropdown duplicate check passed locally | Action Network bridge |
| `high-energy-bills-action.html` | `gpe-form-membership.js`, `gpe-action-network-dropdowns.js` | Yes | 200 / verified hash | Dropdown duplicate check passed locally | Action Network bridge |
| `extreme-weather-action.html` | `gpe-form-membership.js`, `gpe-action-network-dropdowns.js` | Yes | 200 / verified hash | Dropdown duplicate check passed locally | Action Network bridge |
| `take-action/extreme-weather.html` | `gpe-action-network-dropdowns.js` | Yes | 200 / verified hash | Dropdown duplicate check passed locally | Action Network embed |

Direct requests to `https://www.girlplusenvironment.org/*.html` return Wix `400 Error: Bad Request`, so page HTML parity for the Wix-hosted pages cannot be verified by filename URL. Browser-level verification must use the actual Wix published page URLs or the embedded page surface.

## Supabase Edge Functions

Deployed function versions observed:

| Function | Version | JWT |
| --- | ---: | --- |
| `gpe-membership-enroll` | 30 | false |
| `neon-climate-survey` | 46 | false |
| `gpe-grad-highlight-submit` | 29 | false |
| `camp-gpe-submit` | 33 | false |
| `neon-event-register` | 28 | false |
| `action-network-completion-bridge` | 11 | false |
| `hub-account-activation` | 14 | true |
| `hub-invitation-request` | 1 | true |
| `hub-listing-submit` | 1 | true |
| `hub-listing-review` | 1 | true |

Supabase MCP `get_logs` could not be used in this session because OAuth authorization is required. Edge Function logs remain the next required diagnostic input for Neon write failures.

## Remaining Launch Verification

Run live submissions with fresh emails and capture:

| Flow | Browser Function Call | Function 200 | Neon Object ID | Membership ID | Resend ID | Points/Ledger | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Become a Member | Pending live test | Pending | Pending | Pending | Pending | N/A | Not certified |
| Climate Survey only | Pending live test | Pending | Pending | N/A | Pending | N/A | Not certified |
| Climate Survey + member | Pending live test | Pending | Pending | Pending | Pending | Pending if applicable | Not certified |
| Grad Highlight only | Pending live test | Pending | Pending | N/A | Pending | Pending | Not certified |
| Grad Highlight + member | Pending live test | Pending | Pending | Pending | Pending | Pending | Not certified |
| Camp registration | Pending live test | Pending | Pending | Optional | Pending | Pending | Not certified |
| Camp challenge | Pending live test | Pending | Pending | N/A | Pending | Pending | Not certified |
| Event registration | Pending live test | Pending | Pending | Optional | Neon event email | Pending | Not certified |
| Action Network petition | Pending live test | Pending | Pending | Optional | Pending | Pending | Not certified |

## Current Assessment

Frontend deployment drift was real and has been corrected for:

- Hub production bundle.
- Shared membership helper on jsDelivr.
- Static primary/mirror parity for the audited form pages.
- Action Network shared dropdown helper.

The remaining Neon failures should now be investigated through live submission response JSON and Edge Function logs, not more frontend speculation. If a live function call returns success but Neon does not show a record, inspect the corresponding function logs for the exact Neon endpoint, payload summary, HTTP status, response body, and object ID.
