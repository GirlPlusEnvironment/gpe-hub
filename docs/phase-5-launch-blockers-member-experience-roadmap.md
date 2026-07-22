# Phase 5: Launch Blockers and Member Experience Audit

## Objective

Transition the Hub from a polished application into GPE's central member platform by removing launch blockers, replacing remaining hardcoded experiences, and strengthening member onboarding, recognition, identity resolution, and integrations.

This phase should prioritize:

1. Critical bugs and launch blockers.
2. Missing workflows that affect member adoption.
3. Product improvements that can safely follow launch.

Do not use this roadmap as permission to redesign the Hub again. The established Camp/seasonal visual system should remain in place.

## Part 1: Launch Blockers

### 1. Submission Workflow

Status: Partially complete.

All reviewed contributor submissions should require only:

- Title.
- Category or type, when the form exposes one.
- At least one reviewable detail:
  - Description.
  - External link.
  - Uploaded attachment.

Everything else should be optional, including:

- Work arrangement.
- Application URL.
- Deadline.
- Contact email.
- Salary range.
- Compensation.
- Organization details beyond the minimum needed to understand the submission.

Validation should focus on whether Team GPE has enough information to review the submission, not whether a contributor completed every field.

Completed in current pass:

- Job submission form requirements relaxed.
- Event submission form requirements relaxed.
- Funding submission form requirements relaxed.
- Resource submission form requirements relaxed.
- Submit buttons no longer block on nonessential completion percentage.
- Optional URLs and deadlines are still validated when supplied.

Remaining checks:

- Confirm admin review can edit incomplete listing details before publishing.
- Confirm submitted records with only a link or attachment render correctly in the review queue.
- Confirm member-facing copy says submissions are reviewed before publication or points.

### 2. Audit All Embedded Forms

Status: Needs targeted follow-up.

Review every embedded or linked external form, including:

- Climate Adaptation Feedback.
- Grad Highlight.
- Take Action forms.
- Partnership forms.
- Resource submissions.
- Remaining Neon forms.

Goals:

- Replace Wix-relative embeds or blocked iframe URLs with official hosted form endpoints.
- Prefer canonical provider URLs when iframes are blocked by security headers.
- Preserve attribution through redirects, webhooks, or explicit confirmation flows.

Fallback behavior when embedding is impossible:

- Open the official form in a new tab.
- Display a clear in-app explanation.
- Preserve post-submission tracking through redirect URLs, webhooks, or review claims.

Notes:

- Active shared GPE form endpoint resolution has been hardened separately.
- Wix export internals may still reference `filesusr.com`; those are not automatically unsafe unless they are used as function endpoints or blocked form embeds.

### 3. Remove Remaining Hardcoded Camp Content

Status: Partially complete.

The platform should use:

- Primary experience label: Seasonal Challenges.
- Current season label: loaded from the database, for example Camp GPE.

Season-specific content should come from backend configuration wherever possible:

- Titles.
- Descriptions.
- Countdown text.
- Hero banners.
- Announcements.
- CTA copy.
- Badges.
- Leaderboard labels.
- Prizes.
- Theme accents.

Completed in current pass:

- Removed the hardcoded `camp-gpe-2026` active-season fallback.
- Active season now resolves from visible active `gpe_seasons` rows when no environment override exists.
- Updated user-facing runtime copy toward Seasonal Challenges.
- Kept existing Camp route and function names for compatibility.

Remaining work:

- Add editable seasonal CMS fields for hero content, art, announcements, prizes, featured challenge, badges, and theme accents.
- Audit badge names and challenge categories for season-specific hardcoding.
- Confirm all countdown and leaderboard labels read from active season data.

### 4. Improve Challenge Cards

Status: Partially complete.

Refine challenge cards for:

- Checkbox sizing.
- Typography weight.
- Spacing.
- Accessibility.
- Hierarchy.
- Mobile responsiveness.
- Difficulty and point labels.

Acceptance criteria:

- Cards remain playful but are easier to scan.
- Touch targets are usable on mobile.
- Selection state is clear without relying only on color.
- Screen readers can identify challenge title, status, point value, and selected state.

## Part 2: Seasonal Administration

Transform Camp Admin into a reusable Seasonal CMS.

Administrators should be able to manage:

- Seasons.
- Hero content.
- Countdown.
- Featured challenge.
- Announcements.
- Challenge ordering.
- Point values.
- Badge availability.
- Cabins.
- Leaderboard visibility.
- Prize information.
- Theme colors.
- Seasonal artwork.

No code changes should be required for future seasonal programs.

### Challenge Management

Replace remaining hardcoded challenge assumptions with database-managed content.

Support:

- Create.
- Edit.
- Archive.
- Duplicate.
- Feature.
- Reorder.
- Publish and unpublish.

Optional import path:

- Import challenges from the existing Camp GPE spreadsheet or Google Form if that remains the operational source of truth.

## Part 3: Membership Experience

### Strengthen Hub Invitations

When someone joins Girl Plus Environment:

1. Check if a Hub account already exists.
2. If one exists:
   - Reconnect membership.
   - Restore cabin.
   - Restore badges.
3. If none exists:
   - Create a pending member record.
   - Generate a secure magic link.
   - Send a branded Hub invitation.
   - Guide the member into onboarding.

Handle edge cases:

- Duplicate emails.
- Changed email addresses.
- Expired invitations.
- Multiple memberships.
- Partial onboarding.
- Abandoned signups.

The Hub should never silently fail because an email is missing from one system. It should provide clear messaging and guide the person toward account creation or account recovery.

### Member Recognition

Improve how the Hub recognizes existing members.

If someone signs in with an email matching Neon, an existing Hub account, or a legacy member list, the Hub should automatically associate the membership when safe.

Member-facing recovery example:

> We found an existing Girl Plus Environment membership. Would you like to reconnect your account?

This should reduce manual support and make existing members feel recognized immediately.

## Part 4: Member Identity Resolution

Status: Foundational roadmap item.

GPE systems currently identify the same person through separate records across:

- Neon.
- Hub/Supabase Auth.
- Wix.
- Action Network.
- Slack.
- Email tools.
- Event and survey tools.

Build a reliable identity layer that can:

- Match records by normalized email.
- Track previous emails safely.
- Handle email changes.
- Store external IDs per provider.
- Queue uncertain matches for Team review.
- Attach unmatched activity later when the member creates a Hub account.
- Prevent duplicate accounts from receiving duplicate points.

Recommended model:

- A canonical Hub profile or member identity.
- Provider identity records, for example Neon account ID, Action Network person ID, Slack user ID, Wix contact ID.
- Identity confidence/status values, such as verified, probable, pending_review, rejected, merged.
- An audit trail for merges and manual identity decisions.

This unlocks:

- Retroactive points.
- Seamless onboarding.
- Petition recognition.
- Event attendance credit.
- Membership recovery.
- Less manual support.

## Part 5: Petition Recognition

Status: High-value missing workflow.

The Hub should recognize participation regardless of where the petition was completed:

- Wix pages.
- Neon.
- Action Network.
- Embedded forms.
- Future integrations.

Build a reliable petition completion pipeline.

Support:

- Action Network webhooks.
- Neon submissions.
- Wix redirect confirmation pages.
- Future integrations.

When possible:

1. Identify the member by email or provider identity.
2. Verify completion.
3. Save a reviewed or reviewable action record.
4. Award points only through the approved points workflow.
5. Update leaderboard.
6. Unlock badges.
7. Create activity feed entry.
8. Notify the member.

If the person is not yet registered:

- Store the completion.
- Associate it later when they create a Hub account.
- Award retroactive credit after identity resolution and approval.

No one should lose points because they completed an action before joining the Hub.

## Part 6: Integration Layer

Continue replacing manual processes with connected systems.

Audit integrations for:

- Neon membership.
- Neon forms.
- Action Network.
- Hub.
- Email notifications.
- Slack.
- Event attendance.
- Surveys.
- Resource downloads.

For each integration, document:

- Source system.
- Destination system.
- Trigger.
- Authentication/secrets required.
- Retry behavior.
- Failure notification.
- Data owner.
- Member-facing outcome.

## Part 7: Lifecycle Automation

Map the full member journey and automate the highest-value handoffs.

### Join GPE

1. Member joins GPE.
2. Hub invitation is sent.
3. Member creates account.
4. Member chooses cabin.
5. Member completes first challenge.
6. Member earns first badge.
7. Welcome email is sent.
8. Member appears on leaderboard.

### Event Registration

1. Member registers.
2. Attendance is confirmed.
3. Points are queued or awarded through approval workflow.
4. Badge unlocks where applicable.
5. Community/activity notification appears.

### Petition Completion

1. Petition is signed.
2. Completion is verified.
3. Points are awarded through approval workflow.
4. Activity feed updates.
5. Leaderboard refreshes.

## Deliverables

### Launch Blocker Checklist

- Submission forms accept low-friction records for review.
- Active season does not depend on hardcoded `camp-gpe-2026`.
- Active embedded forms do not use Wix-relative function endpoints.
- Challenge cards are readable and accessible.
- Member-facing submission status is visible.

### V1.1 Roadmap

- Seasonal CMS.
- Challenge management CRUD.
- Identity resolution layer.
- Hub invitation automation.
- Petition recognition pipeline.
- Integration registry.
- Lifecycle automation.

### External Configuration Documentation

Document credentials and configuration needed for:

- Neon API.
- Supabase Edge Functions.
- Action Network webhooks.
- Email provider.
- Slack app/webhooks.
- Wix redirects or form confirmations.

Never commit secret values.

### Scalability Recommendations

- Centralize identity resolution before adding more point sources.
- Route all point awards through immutable ledger entries.
- Keep member submissions low-friction and review-first.
- Treat external integrations as queued events with retries.
- Avoid building one-off workflows for each campaign.
- Keep Seasonal Challenges generic while allowing each season to have its own name, art, prizes, and rules.
