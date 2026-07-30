# Action Network Shared JS Integration Audit - 2026-07-30

## Summary

The Action Network dropdown fix now lives in one shared helper:

- `girlplusenvironment.org/gpe-action-network-dropdowns.js`
- `gpe-mirror/gpe-action-network-dropdowns.js`

The helper is loaded from the canonical jsDelivr/GitHub asset:

`https://cdn.jsdelivr.net/gh/GirlPlusEnvironment/girlplusenvironment.org@main/gpe-action-network-dropdowns.js?v=20260730`

The helper was committed and pushed to `GirlPlusEnvironment/girlplusenvironment.org`:

- commit: `4f81cf0 Fix Action Network shared helper integration`

## Petition Page Coverage

| Page | Shared helper reference | Ordering | Duplicate inline helper | Status |
| --- | --- | --- | --- | --- |
| `coal-slush-fund-action.html` | canonical jsDelivr URL | helper before page init; AN widget is injected dynamically and observed | no | verified |
| `high-energy-bills-action.html` | canonical jsDelivr URL | helper before page init; AN widget is injected dynamically and observed | no | verified |
| `extreme-weather-action.html` | canonical jsDelivr URL | AN embed, shared helper, page init | no | verified |
| `take-action/extreme-weather.html` | canonical jsDelivr URL | AN embed, shared helper | no | verified |
| `gpe-mirror/coal-slush-fund-action.html` | canonical jsDelivr URL | matches production copy | no | verified |
| `gpe-mirror/high-energy-bills-action.html` | canonical jsDelivr URL | matches production copy | no | verified |
| `gpe-mirror/extreme-weather-action.html` | canonical jsDelivr URL | matches production copy | no | verified |

Note: there is no `gpe-mirror/take-action/extreme-weather.html` counterpart in this workspace.

## Shared Asset Audit

| Asset | Production copy | Mirror copy | Hosted asset | Status |
| --- | --- | --- | --- | --- |
| Action Network dropdown helper | `gpe-action-network-dropdowns.js` | byte-for-byte match | HTTP 200 after jsDelivr purge | verified |
| Membership helper | `gpe-form-membership.js` | present | HTTP 200 | verified |
| Choice controls helper | `gpe-choice-controls.js` | present | HTTP 200 | verified |

## Network / Render Verification

Non-submitting Playwright checks were run locally against:

- `coal-slush-fund-action.html`
- `high-energy-bills-action.html`
- `extreme-weather-action.html`
- `take-action/extreme-weather.html`

Results:

- shared helper loaded with HTTP 200 on every checked page
- `window.GPEActionNetworkDropdowns` was present
- Action Network widget rendered
- selects initialized exactly through the shared helper
- no visible Select2 duplicate containers
- no visible empty generated dropdown/write-in inputs
- no `undefined.element` page errors

The first jsDelivr `@main` request returned 404 because the new file was not yet on GitHub. After pushing commit `4f81cf0` and purging jsDelivr, the canonical `@main` URL returned HTTP 200.

## Remaining Launch-Gate Live Tests

These were not executed as part of this non-submitting shared asset audit because they create real production records or send real external submissions.

| Flow | Neon | Membership | Hub | Resend | Points | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Become Member | required | required | required | required | N/A | needs fresh-email live test |
| Climate Survey + Member | required | required | required | required | required | needs fresh-email live test |
| Grad Highlight + Member | required | required | required | required | required | needs fresh-email live test |
| Camp Challenge | required | N/A | N/A | required | required | needs fresh-email live test |
| Action Network Petition | required | optional | N/A | required | required | needs live petition test |
| Event Registration | required | optional | N/A | required | required | needs live event test |

## Notes

- Production and mirror copies for the three primary petition shells match byte-for-byte after this pass.
- The broader `girlplusenvironment.org` working tree still has unrelated dirty files from other launch work; they were intentionally not included in the Action Network commit.
