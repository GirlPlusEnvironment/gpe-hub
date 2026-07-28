# GPE Form URL Migration

Status: repository links were updated where they are controlled public links. Export/reference files are intentionally retained. Wix-embedded navigation must use canonical absolute URLs with `target="_top"` so route changes escape the Wix HTML iframe.

## Canonical URLs

| Form | Canonical URL | Anchor |
|---|---|---|
| Camp GPE | `https://www.girlplusenvironment.org/camp-gpe#submission` | `#submission` |
| Camp GPE Challenge | `https://www.girlplusenvironment.org/camp-gpe#challenge` | `#challenge` |
| Donation | `https://www.girlplusenvironment.org/donate#donation` | `#donation` |
| Membership | `https://www.girlplusenvironment.org/become-a-member#membership` | `#membership` |
| GPE Grad Highlight | `https://www.girlplusenvironment.org/gpe-grad-highlight#submission` | `#submission` |
| Climate Survey | `https://www.girlplusenvironment.org/mobile-climate-adaptation-survey#survey` | `#survey` |

## Legacy URLs Found

| Old URL | References | Replacement |
|---|---|---|
| `https://girlplusenvironment.app.neoncrm.com/forms/camp-gpe-1` | `gpe-mirror/camp-gpe-sign-up-form.html` reference export | `https://www.girlplusenvironment.org/camp-gpe#submission` |
| `https://girlplusenvironment.app.neoncrm.com/forms/camp-gpe-challenge-submissions` | `gpe-mirror/camp-gpe-challenge-form.html` reference export; previously `camp-gpe-toolkit.html`; previously `event-details/camp-gpe.html` | `https://www.girlplusenvironment.org/camp-gpe#challenge` |
| `https://girlplusenvironment.app.neoncrm.com/forms/donate` | `gpe-mirror/donate-form.html` reference export | `https://www.girlplusenvironment.org/donate#donation` |
| `https://girlplusenvironment.app.neoncrm.com/forms/membership` | `gpe-mirror/become-a-member-form.html` reference export | `https://www.girlplusenvironment.org/become-a-member#membership` |
| `https://girlplusenvironment.app.neoncrm.com/forms/gpe-grad-highlight` | `gpe-mirror/gpe-grad-highlight-form.html` reference export | `https://www.girlplusenvironment.org/gpe-grad-highlight#submission` |
| `https://girlplusenvironment.app.neoncrm.com/forms/mobile-climate-adaptation-plan-survey` | `gpe-mirror/neon-form-survey.html` reference export; existing climate docs | `https://www.girlplusenvironment.org/mobile-climate-adaptation-survey#survey` |
| `https://girlplusenvironment.app.neoncrm.com/np/clients/girlplusenvironment/survey.jsp?surveyId=2` | existing climate docs; previously `gpe-mirror/take-action.html` | `https://www.girlplusenvironment.org/mobile-climate-adaptation-survey#survey` |
| `https://girlplusenvironment.app.neoncrm.com/forms/share/Rk9STS1FTUJFRFNIQVJJTkctQ09ERTE1` | previously `event-details/camp-gpe.html`; reference exports contain Neon internals | `https://www.girlplusenvironment.org/camp-gpe#challenge` |

## Links Updated In This Pass

- `gpe-mirror/take-action.html`: climate survey CTA points to `https://www.girlplusenvironment.org/mobile-climate-adaptation-survey#survey` with `target="_top"`.
- `gpe-mirror/take-action.html`: Grad Highlight CTA points to `https://www.girlplusenvironment.org/gpe-grad-highlight#submission` with `target="_top"`.
- `gpe-mirror/mobile-climate-adaptation-survey.html`: Back to actions and membership fallback links use canonical absolute Wix URLs.
- `gpe-mirror/gpe-grad-highlight.html`: Back to actions uses the canonical absolute Wix URL.
- `gpe-mirror/camp-gpe-toolkit.html`: visible Camp challenge CTAs now point to `camp-gpe.html#challenge`.
- `gpe-mirror/camp-gpe-toolkit.html`: JavaScript `campaignLinks.submissions` now points to `https://www.girlplusenvironment.org/camp-gpe#challenge`.
- `gpe-mirror/event-details/camp-gpe.html`: challenge link and removed Neon share script area now point to `../camp-gpe.html#challenge`.

## Neon Redirect Reality

Neon-hosted forms may support configurable after-submission destination/confirmation URLs in dashboard settings. That helps after someone submits a Neon form, but it does not make the old hosted Neon URL a reliable landing-page redirect endpoint.

## Production Check

Checked on July 28, 2026:

- `https://www.girlplusenvironment.org/take-action` returns `200`.
- `https://www.girlplusenvironment.org/mobile-climate-adaptation-survey` returns `200`.
- `https://www.girlplusenvironment.org/gpe-grad-highlight` returns `200`.
- The Neon-connected public Edge Functions `neon-climate-survey` and `gpe-grad-highlight-submit` accept Wix-origin unauthenticated requests and return function-level validation errors for invalid payloads, confirming requests reach the deployed functions instead of failing at JWT auth.
- The pushed website source now uses canonical absolute top-level Wix URLs for Back to Actions on Grad Highlight and Mobile Climate Survey, and the Take Action page links Mobile Climate Survey through the first-party route instead of the hosted Neon survey URL.
- If production Wix still renders an older embed script version, republish the Wix HTML embed with the current `gpe-form-membership.js?v=20260728` helper reference.

Manual dashboard work:

- Configure any available post-submission confirmation destination to the matching canonical GPE URL.
- Archive, deactivate, or internally rename legacy hosted forms when operationally safe.
- Remove old forms from Neon navigation or public form lists where possible.
- Add a “Survey moved” or “Form moved” message only if Neon supports editable hosted-page messaging.
- Do not claim bookmarks to `neoncrm.com` URLs can be forcibly redirected by the GPE website.
