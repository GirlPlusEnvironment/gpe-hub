import { OFFICIAL_FOOTER, OFFICIAL_HUB_DESCRIPTION, SENDER, URLS } from "./email-tokens.mjs";

const footerLinksHtml = `<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#000000;">
  <a href="{{preferencesUrl}}" style="font-weight:700;color:#000000;text-decoration:underline;">Email preferences</a>
</p>`;

export const sampleVariables = {
  firstName: "Cassan",
  actionName: "High Energy Bills petition",
  takeActionUrl: URLS.takeActionUrl,
  communityResourcesUrl: URLS.communityResourcesUrl,
  joinHubUrl: URLS.membershipUrl,
  inviteUrl: URLS.invitePageUrl,
  hubUrl: URLS.hubUrl,
  hubInviteUrl: `${URLS.hubUrl}/accept-invite`,
  invitePageUrl: URLS.invitePageUrl,
  membershipUrl: URLS.membershipUrl,
  membershipHelpUrl: URLS.membershipHelpUrl,
  points: "10",
  recipientEmail: "support@gpecommunityhub.org",
  claimUrl: URLS.hubUrl,
  totalPoints: "270",
  pointsUrl: URLS.pointsUrl,
  nextActionUrl: URLS.takeActionUrl,
  challengeTitle: "Sign the High Energy Bills Petition",
  nextChallengeUrl: `${URLS.hubUrl}/camp-gpe/challenges`,
  cabinRank: "2",
  personalRank: "7",
  inviterName: "Maya",
  inviterFirstName: "Maya",
  friendFirstName: "Ari",
  personalNote: "You would love this space.",
  inviteLandingUrl: URLS.membershipUrl,
  eventName: "Climate Careers Night",
  discussionUrl: `${URLS.hubUrl}/community`,
  preferencesUrl: URLS.preferencesUrl,
  membershipId: "membership_123",
  membershipTermId: "term_123",
  pendingAwardId: "pending_123",
  pointEventId: "point_event_123",
  submissionId: "submission_123",
  invitationId: "invitation_123",
  joinedUserId: "user_123",
  eventId: "event_123",
  attendeeId: "attendee_123",
  displayName: "Cassan",
  profileUrl: `${URLS.hubUrl}/profile`,
  badgeName: "Advocacy Starter",
  badgesUrl: `${URLS.hubUrl}/profile`,
  weeklyPoints: "35",
  monthlyHighlights: "3 actions completed",
  leaderboardPosition: "12",
  campUrl: `${URLS.hubUrl}/camp-gpe`,
  membershipLevel: "GPE Member",
  anniversaryYear: "1",
  renewalUrl: URLS.membershipUrl,
  resourceTitle: "Climate Justice Funding List",
  resourceUrl: URLS.communityResourcesUrl,
  jobsUrl: `${URLS.hubUrl}/explore`,
  websiteUrl: URLS.websiteUrl,
  newsletterUrl: URLS.websiteUrl,
  submissionName: "Grad Highlight",
  petitionName: "High Energy Bills petition",
  campaignName: "Energy Justice",
  surveyName: "Mobile Climate Survey"
};

export const resendTemplates = [
  {
    key: "public-action-follow-up",
    status: ["ready", "needs trigger", "needs preference rule"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "A person completes an eligible public action and is not an active GPE member.",
    idempotency: "public-action-follow-up:{source_type}:{source_id}",
    variables: ["firstName", "actionName", "takeActionUrl", "communityResourcesUrl", "joinHubUrl", "inviteUrl"],
    subject: "Girl, you did that 💖",
    preview: "Thanks for taking action with Girl Plus Environment. Here’s what else is waiting.",
    heroSymbol: "💖",
    heroHeading: "YOU DID THAT",
    heroText: "Thanks for completing an action with Girl Plus Environment.",
    eyebrow: "Action complete",
    contentHeading: "KEEP THAT SAME ENERGY",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Thanks for completing an action with Girl Plus Environment, {{firstName}}.
</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#000000;">
You showed up for {{actionName}}. Now come see what else we have going on.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
We have more ways to take action. We also keep free community resources ready for anyone who needs them.
</p>`,
    primaryCta: { label: "Take Another Action", url: "{{takeActionUrl}}" },
    secondaryHtml: `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:20px;margin-bottom:18px;">
  <p style="margin:0 0 10px;font-family:Arial Black,Arial,sans-serif;font-size:16px;line-height:1.3;text-transform:uppercase;color:#000000;">
    Free resources for the public
  </p>
  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#000000;">
    Find climate tools, community support, and resources you can use right now.
  </p>
  <a href="{{communityResourcesUrl}}" style="font-weight:700;color:#000000;text-decoration:underline;">
    Visit Community Resources →
  </a>
</div>
<div style="background-color:#fde68a;border:3px solid #000000;border-radius:20px;padding:20px;">
  <p style="margin:0 0 10px;font-family:Arial Black,Arial,sans-serif;font-size:16px;line-height:1.3;text-transform:uppercase;color:#000000;">
    Did you know we have a Hub?
  </p>
  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#000000;">
    ${OFFICIAL_HUB_DESCRIPTION}
  </p>
  <p style="margin:0;font-size:14px;line-height:1.6;color:#000000;">
    <a href="{{joinHubUrl}}" style="font-weight:700;color:#000000;text-decoration:underline;">Join us</a>
    or
    <a href="{{inviteUrl}}" target="_blank" rel="noopener noreferrer" style="font-weight:700;color:#000000;text-decoration:underline;">invite an eligible friend or colleague</a>.
  </p>
</div>`,
    closingNote: "Real environmental action led by us and for us.",
    footerLinksHtml,
    text: `Girl, you did that.
Thanks for completing an action with Girl Plus Environment, {{firstName}}.
You showed up for {{actionName}}. Now come see what else we have going on.

Take another action:
{{takeActionUrl}}

Free community resources:
{{communityResourcesUrl}}

Did you know we have a Hub?
${OFFICIAL_HUB_DESCRIPTION}

Join us:
{{joinHubUrl}}

Invite an eligible friend or colleague:
{{inviteUrl}}

${OFFICIAL_FOOTER}`
  },
  {
    key: "member-welcome",
    status: ["ready", "needs trigger", "needs preference rule"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "Neon confirms a new active membership.",
    idempotency: "member-welcome:{membership_term_id}",
    variables: ["firstName", "hubUrl", "invitePageUrl", "membershipId", "membershipTermId"],
    subject: "You can sit with us, girlie! 💖",
    preview: "You’re officially a GPE member. Now join the group chat.",
    heroSymbol: "💖",
    heroHeading: "YOU CAN SIT WITH US",
    heroText: "Thanks for becoming a Girl Plus Environment member.",
    eyebrow: "Membership confirmed",
    contentHeading: "WELCOME TO GPE",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
You can sit with us, girlie!
</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#000000;">
Thanks for becoming a GPE member, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Your membership helps make room for Black + Brown femmes to lead this climate and environmental justice movement.
</p>`,
    primaryCta: { label: "Join the Group Chat", url: "{{hubUrl}}" },
    secondaryHtml: `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:20px;margin-bottom:18px;">
  <p style="margin:0 0 10px;font-family:Arial Black,Arial,sans-serif;font-size:16px;line-height:1.3;text-transform:uppercase;color:#000000;">
    Your Hub is ready
  </p>
  <p style="margin:0;font-size:14px;line-height:1.6;color:#000000;">
    ${OFFICIAL_HUB_DESCRIPTION}
  </p>
</div>
<div style="background-color:#fde68a;border:3px solid #000000;border-radius:20px;padding:20px;">
  <p style="margin:0 0 10px;font-family:Arial Black,Arial,sans-serif;font-size:16px;line-height:1.3;text-transform:uppercase;color:#000000;">
    Bring somebody with you
  </p>
  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#000000;">
    Know a Black or Brown femme who should be in this space?
  </p>
  <a href="{{invitePageUrl}}" target="_blank" rel="noopener noreferrer" style="font-weight:700;color:#000000;text-decoration:underline;">
    Invite a friend or colleague →
  </a>
</div>`,
    closingNote: "Black + Brown femmes belong in the room.",
    footerLinksHtml,
    text: `You can sit with us, girlie!

Thanks for becoming a GPE member, {{firstName}}.
Your membership helps make room for Black + Brown femmes to lead this climate and environmental justice movement.

Join the group chat:
{{hubUrl}}

Bring somebody with you:
{{invitePageUrl}}

${OFFICIAL_FOOTER}`
  },
  {
    key: "existing-member-hub-invite",
    status: ["ready", "needs trigger"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "An active Neon member does not have a linked Supabase Auth account.",
    idempotency: "existing-member-hub-invite:{neon_account_id}:{recipient_email}",
    variables: ["firstName", "email", "hubInviteUrl"],
    subject: "Girl, the group chat is open 👀",
    preview: "You’re already a GPE member. Set up your Hub account.",
    heroSymbol: "👀",
    heroHeading: "DON’T MISS THE GROUP CHAT",
    heroText: "You’re already a GPE member. Now come join us in the Hub.",
    eyebrow: "Member invite",
    contentHeading: "YOUR HUB ACCOUNT IS READY",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
You’re already one of us, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Set up your Hub account to find your next mission and see what the community is talking about.
</p>`,
    primaryCta: { label: "Set Up My Hub Account", url: "{{hubInviteUrl}}" },
    secondaryHtml: `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:18px;">
  <p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    ${OFFICIAL_HUB_DESCRIPTION}
  </p>
</div>`,
    closingNote: "This private account link was sent to {{email}}. Do not forward it.",
    text: `Girl, the group chat is open.

You’re already one of us, {{firstName}}.
Set up your Hub account to find your next mission and see what the community is talking about.

Set up your Hub account:
{{hubInviteUrl}}

This private account link was sent to {{email}}. Do not forward it.

${OFFICIAL_FOOTER}`
  },
  {
    key: "hub-user-nonmember",
    status: ["ready", "needs trigger", "needs preference rule"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "A valid Hub account exists but Neon confirms there is no active membership. Cooldown required.",
    idempotency: "hub-user-nonmember:{user_id}:{cooldown_window}",
    variables: ["firstName", "membershipUrl", "membershipHelpUrl"],
    subject: "Okayyy, you found the Hub 💖",
    preview: "You have a Hub account. Here’s how to become a GPE member too.",
    heroSymbol: "🌎",
    heroHeading: "YOU FOUND THE HUB",
    heroText: "Now let’s make sure you know what membership means.",
    eyebrow: "Membership check",
    contentHeading: "COME ALL THE WAY IN",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
You already have a GPE Hub account, {{firstName}}.
</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#000000;">
Your Hub account lets you see public opportunities and community updates.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
A GPE membership helps make this space possible and gives eligible members access to the full community.
</p>`,
    primaryCta: { label: "Become a GPE Member", url: "{{membershipUrl}}" },
    secondaryHtml: `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:18px;">
  <p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    Already a member under another email? Use the membership help link so we can connect your account.
  </p>
  <p style="margin:12px 0 0;font-size:13px;line-height:1.6;">
    <a href="{{membershipHelpUrl}}" style="font-weight:700;color:#000000;text-decoration:underline;">
      Get membership help →
    </a>
  </p>
</div>`,
    closingNote: "Come make space with us.",
    footerLinksHtml,
    text: `Okayyy, you found the Hub.

You already have a GPE Hub account, {{firstName}}.
Your Hub account lets you see public opportunities and community updates.
A GPE membership helps make this space possible and gives eligible members access to the full community.

Become a GPE Member:
{{membershipUrl}}

Membership help:
{{membershipHelpUrl}}

${OFFICIAL_FOOTER}`
  },
  {
    key: "hub-activated",
    status: ["ready", "needs trigger"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "A user completes Hub account activation for the first time.",
    idempotency: "hub-activated:{user_id}",
    variables: ["firstName", "hubUrl"],
    subject: "You’re in the group chat 💬",
    preview: "Your GPE Hub account is ready.",
    heroSymbol: "💬",
    heroHeading: "YOU’RE IN",
    heroText: "Your GPE Hub account is officially ready.",
    eyebrow: "Account activated",
    contentHeading: "COME FIND YOUR NEXT MOVE",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Welcome in, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Start with the mission board. See what is happening. Then jump into the group chat when you’re ready.
</p>`,
    primaryCta: { label: "Open the Hub", url: "{{hubUrl}}" },
    secondaryHtml: `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:18px;">
  <p style="margin:0 0 12px;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    First things first:
  </p>
  <p style="margin:0;font-size:13px;line-height:1.8;color:#000000;">
    Complete your profile.<br>
    Check the mission board.<br>
    Say hey in the group chat.
  </p>
</div>`,
    closingNote: "For the girlies. For our communities. For climate justice.",
    text: `You’re in the group chat.

Welcome in, {{firstName}}.
Start with the mission board. See what is happening. Then jump into the group chat when you’re ready.

Open the Hub:
{{hubUrl}}

First things first:
Complete your profile.
Check the mission board.
Say hey in the group chat.

${OFFICIAL_FOOTER}`
  },
  {
    key: "pending-points",
    status: ["ready", "needs trigger", "needs preference rule"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "A verified action earns points but no linked Hub user can claim them yet.",
    idempotency: "pending-points:{pending_award_id}",
    variables: ["points", "actionName", "claimUrl", "recipientEmail", "pendingAwardId"],
    subject: "Your points are waiting 👀",
    preview: "You took action. We saved the points.",
    heroSymbol: "🏆",
    heroHeading: "POINTS PENDING",
    heroText: "You took action. We saved the points for you.",
    eyebrow: "{{points}} points",
    contentHeading: "CLAIM WHAT’S YOURS",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Girl, you earned {{points}} points for {{actionName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Connect or create your Hub account with this email so we know where to put them.
</p>`,
    primaryCta: { label: "Claim My Points", url: "{{claimUrl}}" },
    secondaryHtml: `<div style="background-color:#fde68a;border:3px solid #000000;border-radius:20px;padding:18px;">
  <p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    Use {{recipientEmail}} when you set up or connect your account.
  </p>
</div>`,
    closingNote: "Already have an account under another email? Use the account help link instead.",
    footerLinksHtml,
    text: `Your points are waiting.

Girl, you earned {{points}} points for {{actionName}}.
Connect or create your Hub account with this email so we know where to put them.

Claim my points:
{{claimUrl}}

Use {{recipientEmail}} when you set up or connect your account.

${OFFICIAL_FOOTER}`
  },
  {
    key: "points-earned",
    status: ["ready", "needs trigger", "needs preference rule"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "A verified Hub action awards points. Use only for campaign-significant actions or milestones.",
    idempotency: "points-earned:{point_event_id}",
    variables: ["points", "actionName", "totalPoints", "pointsUrl", "nextActionUrl", "pointEventId"],
    subject: "Girl, you got the points 🏆",
    preview: "{{points}} points just hit your GPE Hub account.",
    heroSymbol: "🏆",
    heroHeading: "POINTS ADDED",
    heroText: "That action counted.",
    eyebrow: "+{{points}} points",
    contentHeading: "LOOK AT YOU GO",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
You earned {{points}} points for {{actionName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Your new total is {{totalPoints}}.
</p>`,
    primaryCta: { label: "See My Points", url: "{{pointsUrl}}" },
    secondaryHtml: `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:18px;">
  <p style="margin:0 0 12px;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    Want more?
  </p>
  <a href="{{nextActionUrl}}" style="font-weight:700;color:#000000;text-decoration:underline;">
    Find another action →
  </a>
</div>`,
    closingNote: "Keep that same energy.",
    footerLinksHtml,
    text: `Girl, you got the points.

You earned {{points}} points for {{actionName}}.
Your new total is {{totalPoints}}.

See my points:
{{pointsUrl}}

Find another action:
{{nextActionUrl}}

${OFFICIAL_FOOTER}`
  },
  {
    key: "challenge-completed",
    status: ["ready", "needs trigger", "needs preference rule"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "A seasonal challenge submission is approved or automatically verified.",
    idempotency: "challenge-completed:{submission_id}",
    variables: ["challengeTitle", "points", "totalPoints", "nextChallengeUrl", "cabinRank", "personalRank", "submissionId"],
    subject: "Mission complete, girlie! 🎉",
    preview: "Your challenge counted and your points are in.",
    heroSymbol: "🎉",
    heroHeading: "MISSION COMPLETE",
    heroText: "You did the challenge. We counted it.",
    eyebrow: "Challenge complete",
    contentHeading: "YOU UNDERSTOOD THE ASSIGNMENT",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
{{challengeTitle}} is officially complete.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
You earned {{points}} points. Your new total is {{totalPoints}}.
</p>`,
    primaryCta: { label: "Find My Next Mission", url: "{{nextChallengeUrl}}" },
    secondaryHtml: `{{#if cabinRank}}<div style="background-color:#fde68a;border:3px solid #000000;border-radius:20px;padding:18px;">
  <p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    Cabin rank: {{cabinRank}}<br>
    Personal rank: {{personalRank}}
  </p>
</div>{{/if}}`,
    closingNote: "No crafts. Just content, stories, signatures, and action.",
    footerLinksHtml,
    text: `Mission complete, girlie!

{{challengeTitle}} is officially complete.
You earned {{points}} points. Your new total is {{totalPoints}}.

Find my next mission:
{{nextChallengeUrl}}

{{#if cabinRank}}Cabin rank: {{cabinRank}}
Personal rank: {{personalRank}}

{{/if}}${OFFICIAL_FOOTER}`
  },
  {
    key: "invite-friend",
    status: ["ready", "needs URL", "needs trigger", "needs preference rule"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "A signed-in Hub member submits the invite form.",
    idempotency: "invite-friend:{invitation_id}",
    variables: ["inviterName", "personalNote", "inviteLandingUrl", "invitationId"],
    subject: "{{inviterName}} saved you a seat 💖",
    preview: "You’ve been invited to check out Girl Plus Environment.",
    heroSymbol: "💌",
    heroHeading: "A SEAT WITH YOUR NAME ON IT",
    heroText: "{{inviterName}} thinks you should know about GPE.",
    eyebrow: "Friend invite",
    contentHeading: "COME SEE WHAT WE’RE BUILDING",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
{{inviterName}} invited you to check out the Girl Plus Environment community.
</p>
{{#if personalNote}}<div style="background-color:#fde68a;border:3px solid #000000;border-radius:20px;padding:18px;margin:0 0 24px;">
  <p style="margin:0;font-size:14px;line-height:1.7;color:#000000;">
    “{{personalNote}}”
  </p>
</div>{{/if}}
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
We make space for Black + Brown femmes to find opportunities and lead in climate.
</p>`,
    primaryCta: { label: "See the GPE Hub", url: "{{inviteLandingUrl}}" },
    secondaryHtml: `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:18px;">
  <p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    ${OFFICIAL_HUB_DESCRIPTION}
  </p>
</div>`,
    closingNote: "Know your people. Bring your people.",
    footerLinksHtml,
    text: `{{inviterName}} saved you a seat.

{{inviterName}} invited you to check out the Girl Plus Environment community.

{{#if personalNote}}“{{personalNote}}”

{{/if}}We make space for Black + Brown femmes to find opportunities and lead in climate.

See the GPE Hub:
{{inviteLandingUrl}}

${OFFICIAL_HUB_DESCRIPTION}

${OFFICIAL_FOOTER}`
  },
  {
    key: "invited-friend-joined",
    status: ["ready", "needs trigger", "needs preference rule"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "An invited person completes an eligible Hub registration or membership registration.",
    idempotency: "invited-friend-joined:{invitation_id}:{joined_user_id}",
    variables: ["friendFirstName", "inviterFirstName", "hubUrl", "invitationId", "joinedUserId"],
    subject: "Your invite worked 💖",
    preview: "{{friendFirstName}} joined the GPE community.",
    heroSymbol: "💖",
    heroHeading: "LOOK WHO PULLED UP",
    heroText: "Your invite brought somebody new into the community.",
    eyebrow: "Invite accepted",
    contentHeading: "{{friendFirstName}} JOINED",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Your invite worked, {{inviterFirstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
{{friendFirstName}} joined the GPE community.
</p>`,
    primaryCta: { label: "Open the Hub", url: "{{hubUrl}}" },
    secondaryHtml: `<div style="background-color:#fde68a;border:3px solid #000000;border-radius:20px;padding:18px;">
  <p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    Climate has a people problem. You just helped us fix it.
  </p>
</div>`,
    closingNote: "Keep making space.",
    footerLinksHtml,
    text: `Your invite worked.

Your invite worked, {{inviterFirstName}}.
{{friendFirstName}} joined the GPE community.

Open the Hub:
{{hubUrl}}

Climate has a people problem. You just helped us fix it.

${OFFICIAL_FOOTER}`
  },
  {
    key: "post-event-follow-up",
    status: ["ready", "needs trigger", "needs Neon mapping", "needs preference rule"],
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger: "Attendance is confirmed after a Neon event. Neon remains responsible for registration and reminders.",
    idempotency: "post-event-follow-up:{event_id}:{attendee_id}",
    variables: ["eventName", "firstName", "discussionUrl", "points", "eventId", "attendeeId"],
    subject: "Thanks for pulling up 💖",
    preview: "Keep the conversation going in the GPE Hub.",
    heroSymbol: "🎤",
    heroHeading: "THANKS FOR PULLING UP",
    heroText: "You came through for {{eventName}}.",
    eyebrow: "Event complete",
    contentHeading: "KEEP THE CONVERSATION GOING",
    bodyHtml: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Thanks for joining us, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
The event is over. The conversation does not have to be.
</p>`,
    primaryCta: { label: "Join the Hub Conversation", url: "{{discussionUrl}}" },
    secondaryHtml: `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:20px;margin-bottom:18px;">
  <p style="margin:0 0 12px;font-family:Arial Black,Arial,sans-serif;font-size:16px;line-height:1.3;text-transform:uppercase;color:#000000;">
    Keep up with the event
  </p>
  <p style="margin:0;font-size:13px;line-height:1.8;color:#000000;">
    Render available event links only in the sending function.
  </p>
</div>
{{#if points}}<div style="background-color:#fde68a;border:3px solid #000000;border-radius:20px;padding:18px;">
  <p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    You earned {{points}} points for showing up.
  </p>
</div>{{/if}}`,
    closingNote: "Because awareness is only the beginning.",
    footerLinksHtml,
    text: `Thanks for pulling up.

Thanks for joining us, {{firstName}}.
The event is over. The conversation does not have to be.

Join the Hub conversation:
{{discussionUrl}}

{{#if points}}You earned {{points}} points for showing up.

{{/if}}${OFFICIAL_FOOTER}`
  }
];

function makeLifecycleTemplate({
  key,
  status = ["ready", "needs trigger", "needs preference rule"],
  trigger,
  idempotency,
  variables,
  subject,
  preview,
  heroSymbol,
  heroHeading,
  heroText,
  eyebrow,
  contentHeading,
  body,
  ctaLabel,
  ctaUrl,
  secondaryTitle,
  secondaryBody,
  closingNote,
  text
}) {
  return {
    key,
    status,
    sender: SENDER,
    replyToEnv: "GPE_EMAIL_REPLY_TO",
    trigger,
    idempotency,
    variables,
    subject,
    preview,
    heroSymbol,
    heroHeading,
    heroText,
    eyebrow,
    contentHeading,
    bodyHtml: body,
    primaryCta: ctaLabel && ctaUrl ? { label: ctaLabel, url: ctaUrl } : null,
    secondaryHtml: secondaryTitle || secondaryBody ? `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:18px;">
  ${secondaryTitle ? `<p style="margin:0 0 10px;font-family:Arial Black,Arial,sans-serif;font-size:16px;line-height:1.3;text-transform:uppercase;color:#000000;">${secondaryTitle}</p>` : ""}
  <p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    ${secondaryBody || OFFICIAL_HUB_DESCRIPTION}
  </p>
</div>` : "",
    closingNote,
    footerLinksHtml,
    text
  };
}

resendTemplates.push(
  makeLifecycleTemplate({
    key: "petition-thank-you",
    trigger: "A verified petition is completed outside Action Network or from a generic advocacy source.",
    idempotency: "petition-thank-you:{source_type}:{source_id}",
    variables: ["firstName", "petitionName", "campaignName", "hubUrl", "takeActionUrl"],
    subject: "That signature looks good on you 💖",
    preview: "Your petition was received by Girl Plus Environment.",
    heroSymbol: "✍️",
    heroHeading: "ACTION RECEIVED",
    heroText: "Thanks for speaking up for your community.",
    eyebrow: "{{campaignName}}",
    contentHeading: "THAT SIGNATURE COUNTS",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Thanks for signing {{petitionName}}, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
We saved your action and connected it to your GPE record when we could.
</p>`,
    ctaLabel: "Open the Hub",
    ctaUrl: "{{hubUrl}}",
    secondaryTitle: "More action",
    secondaryBody: `Bestie, there is more where that came from. Visit the action center when you are ready.`,
    closingNote: "Learn, share, act.",
    text: `Your petition was received.

Thanks for signing {{petitionName}}, {{firstName}}.
We saved your action and connected it to your GPE record when we could.

Open the Hub:
{{hubUrl}}

More action:
{{takeActionUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "action-network-petition-thank-you",
    trigger: "Action Network petition completion is verified by the Supabase bridge or webhook.",
    idempotency: "action-network-petition-thank-you:{petition_slug}:{recipient_email}",
    variables: ["firstName", "petitionName", "campaignName", "awardedPoints", "pendingPoints", "hubUrl"],
    subject: "Girl, you did that 💖",
    preview: "Your Action Network petition was verified.",
    heroSymbol: "📣",
    heroHeading: "ACTION COMPLETE",
    heroText: "Your petition signature was verified.",
    eyebrow: "{{campaignName}}",
    contentHeading: "THANKS FOR SPEAKING UP",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Your signature for {{petitionName}} is in, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
If points were earned, the Hub will show whether they were added or saved for later.
</p>`,
    ctaLabel: "Check My Points",
    ctaUrl: "{{hubUrl}}/leaderboard",
    secondaryTitle: "Points status",
    secondaryBody: `Awarded: {{awardedPoints}}. Saved for later: {{pendingPoints}}.`,
    closingNote: "That signature looks good on you.",
    text: `Action complete.

Your signature for {{petitionName}} is in, {{firstName}}.
Awarded points: {{awardedPoints}}
Saved points: {{pendingPoints}}

Check your points:
{{hubUrl}}/leaderboard

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "event-follow-up",
    trigger: "A public event follow-up is sent after attendance or event participation is verified.",
    idempotency: "event-follow-up:{event_id}:{recipient_email}",
    variables: ["firstName", "eventName", "discussionUrl", "hubUrl"],
    subject: "Thanks for pulling up 💖",
    preview: "Keep the conversation going after the event.",
    heroSymbol: "🎤",
    heroHeading: "THANKS FOR PULLING UP",
    heroText: "You came through for {{eventName}}.",
    eyebrow: "Event follow-up",
    contentHeading: "KEEP TALKING WITH US",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Thanks for joining us, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
The event is over. The conversation does not have to be.
</p>`,
    ctaLabel: "Open the Conversation",
    ctaUrl: "{{discussionUrl}}",
    secondaryTitle: "Your Hub",
    secondaryBody: OFFICIAL_HUB_DESCRIPTION,
    closingNote: "Because awareness is only the beginning.",
    text: `Thanks for pulling up.

Thanks for joining us, {{firstName}}.
The event is over. The conversation does not have to be.

Open the conversation:
{{discussionUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "survey-thank-you",
    trigger: "A public survey submission is accepted.",
    idempotency: "survey-thank-you:{submission_id}",
    variables: ["firstName", "surveyName", "communityResourcesUrl", "hubUrl"],
    subject: "We got your survey 💖",
    preview: "Thanks for sharing what is happening in your community.",
    heroSymbol: "🌦️",
    heroHeading: "SURVEY RECEIVED",
    heroText: "The weather outside has been acting up.",
    eyebrow: "Survey complete",
    contentHeading: "THANKS FOR TELLING US",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Thanks for completing {{surveyName}}, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Your response helps us understand what our communities are dealing with right now.
</p>`,
    ctaLabel: "View Resources",
    ctaUrl: "{{communityResourcesUrl}}",
    secondaryTitle: "The Hub",
    secondaryBody: OFFICIAL_HUB_DESCRIPTION,
    closingNote: "Real environmental action led by us and for us.",
    text: `We got your survey.

Thanks for completing {{surveyName}}, {{firstName}}.
Your response helps us understand what our communities are dealing with right now.

View resources:
{{communityResourcesUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "volunteer-interest",
    trigger: "A volunteer interest or volunteer form follow-up should be sent outside Neon transactional confirmation.",
    idempotency: "volunteer-interest:{submission_id}",
    variables: ["firstName", "hubUrl", "websiteUrl"],
    subject: "We got your volunteer interest 💖",
    preview: "Thanks for raising your hand with GPE.",
    heroSymbol: "🙋🏽‍♀️",
    heroHeading: "FORM RECEIVED",
    heroText: "Thanks for raising your hand.",
    eyebrow: "Volunteer interest",
    contentHeading: "WE WILL BE IN TOUCH",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Thanks for reaching out, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Team GPE will review your volunteer interest and follow up when there is a good fit.
</p>`,
    ctaLabel: "Visit GPE",
    ctaUrl: "{{websiteUrl}}",
    secondaryTitle: "While you wait",
    secondaryBody: `Come find your next move in the Hub.`,
    closingNote: "Black + Brown femmes belong in the room.",
    text: `We got your volunteer interest.

Thanks for reaching out, {{firstName}}.
Team GPE will review your volunteer interest and follow up when there is a good fit.

Visit GPE:
{{websiteUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "camp-gpe-submission",
    trigger: "A Camp GPE registration or submission is saved.",
    idempotency: "camp-gpe-submission:{submission_id}",
    variables: ["firstName", "submissionName", "campUrl"],
    subject: "Camp GPE got your submission 💖",
    preview: "Your Camp GPE submission was saved.",
    heroSymbol: "🏕️",
    heroHeading: "CAMP RECEIVED",
    heroText: "Your Camp GPE submission is in.",
    eyebrow: "Camp GPE",
    contentHeading: "WE GOT IT",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Thanks, {{firstName}}. We saved your {{submissionName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
If this action earns points, the Hub will show them after verification.
</p>`,
    ctaLabel: "Open Camp GPE",
    ctaUrl: "{{campUrl}}",
    secondaryTitle: "For the girlies",
    secondaryBody: `No crafts. Just content, stories, signatures, and action.`,
    closingNote: "Camp GPE runs on verified action.",
    text: `Camp GPE got your submission.

Thanks, {{firstName}}. We saved your {{submissionName}}.
If this action earns points, the Hub will show them after verification.

Open Camp GPE:
{{campUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "graduate-highlight-submission",
    trigger: "A Grad Highlight submission is saved.",
    idempotency: "graduate-highlight-submission:{submission_id}",
    variables: ["firstName", "hubUrl", "communityResourcesUrl"],
    subject: "We got your Grad Highlight 💖",
    preview: "Your Grad Highlight submission was saved.",
    heroSymbol: "🎓",
    heroHeading: "HIGHLIGHT RECEIVED",
    heroText: "Your Grad Highlight is in.",
    eyebrow: "Grad Highlight",
    contentHeading: "GIRL, YOU DID THAT",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Thanks for sharing your Grad Highlight, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Team GPE has your submission. If you joined as a member, that record will be connected too.
</p>`,
    ctaLabel: "Open the Hub",
    ctaUrl: "{{hubUrl}}",
    secondaryTitle: "Resources",
    secondaryBody: `Find climate tools, community support, and resources you can use right now.`,
    closingNote: "Come find your next move.",
    text: `We got your Grad Highlight.

Thanks for sharing your Grad Highlight, {{firstName}}.
Team GPE has your submission. If you joined as a member, that record will be connected too.

Open the Hub:
{{hubUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "hub-welcome",
    trigger: "A Hub account is created or activated for the first time.",
    idempotency: "hub-welcome:{user_id}",
    variables: ["firstName", "hubUrl", "profileUrl"],
    subject: "You’re in the group chat 💬",
    preview: "Your GPE Hub account is ready.",
    heroSymbol: "💬",
    heroHeading: "YOU ARE IN",
    heroText: "Your GPE Hub account is ready.",
    eyebrow: "Hub welcome",
    contentHeading: "COME FIND YOUR NEXT MOVE",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Welcome in, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Start with your profile. Then check what is open on the mission board.
</p>`,
    ctaLabel: "Open the Hub",
    ctaUrl: "{{hubUrl}}",
    secondaryTitle: "First things first",
    secondaryBody: `Complete your profile. Check the mission board. Say hey in the group chat.`,
    closingNote: "For the girlies. For our communities. For climate justice.",
    text: `You are in the group chat.

Welcome in, {{firstName}}.
Start with your profile. Then check what is open on the mission board.

Open the Hub:
{{hubUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "complete-your-profile",
    trigger: "A Hub user has an incomplete profile after account activation.",
    idempotency: "complete-your-profile:{user_id}:{cooldown_window}",
    variables: ["firstName", "profileUrl"],
    subject: "Come finish your profile 💖",
    preview: "Help the Hub know how to show up for you.",
    heroSymbol: "🪪",
    heroHeading: "PROFILE CHECK",
    heroText: "Help the Hub know how to show up for you.",
    eyebrow: "Hub setup",
    contentHeading: "FINISH YOUR PROFILE",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Hey {{firstName}}, your Hub profile could use a little love.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Add the details you want the community to know.
</p>`,
    ctaLabel: "Complete My Profile",
    ctaUrl: "{{profileUrl}}",
    secondaryTitle: "Why it matters",
    secondaryBody: `Black + Brown femmes belong in the room. Your profile helps people find you there.`,
    closingNote: "The group chat is open.",
    text: `Come finish your profile.

Hey {{firstName}}, your Hub profile could use a little love.
Add the details you want the community to know.

Complete your profile:
{{profileUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "first-badge",
    trigger: "A Hub member earns their first badge.",
    idempotency: "first-badge:{user_id}:{badge_id}",
    variables: ["firstName", "badgeName", "badgesUrl"],
    subject: "First badge secured 🏆",
    preview: "{{badgeName}} just hit your Hub profile.",
    heroSymbol: "🏆",
    heroHeading: "FIRST BADGE",
    heroText: "Your first Hub badge is here.",
    eyebrow: "{{badgeName}}",
    contentHeading: "LOOK AT YOU GO",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
You earned {{badgeName}}, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
That first badge looks good on your profile.
</p>`,
    ctaLabel: "See My Badges",
    ctaUrl: "{{badgesUrl}}",
    secondaryTitle: "Keep going",
    secondaryBody: `Bestie, there is more where that came from.`,
    closingNote: "Keep that same energy.",
    text: `First badge secured.

You earned {{badgeName}}, {{firstName}}.
That first badge looks good on your profile.

See your badges:
{{badgesUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "badge-unlocked",
    trigger: "A Hub member earns a badge after the first badge.",
    idempotency: "badge-unlocked:{user_id}:{badge_id}",
    variables: ["firstName", "badgeName", "badgesUrl"],
    subject: "Badge unlocked 🏆",
    preview: "{{badgeName}} was added to your Hub profile.",
    heroSymbol: "🏆",
    heroHeading: "BADGE UNLOCKED",
    heroText: "{{badgeName}} was added to your Hub profile.",
    eyebrow: "Badge earned",
    contentHeading: "YOU DID THAT",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
{{badgeName}} is yours, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Your Hub profile has the receipt.
</p>`,
    ctaLabel: "View Badge",
    ctaUrl: "{{badgesUrl}}",
    secondaryTitle: "What counted",
    secondaryBody: `This badge was created from verified Hub activity.`,
    closingNote: "Girl, you did that.",
    text: `Badge unlocked.

{{badgeName}} is yours, {{firstName}}.
Your Hub profile has the receipt.

View badge:
{{badgesUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "weekly-progress",
    trigger: "Weekly Hub progress summary for opted-in users.",
    idempotency: "weekly-progress:{user_id}:{week_start}",
    variables: ["firstName", "weeklyPoints", "hubUrl", "campUrl"],
    subject: "Your week in the Hub 💖",
    preview: "Here is what counted this week.",
    heroSymbol: "📈",
    heroHeading: "WEEKLY PROGRESS",
    heroText: "Here is what counted this week.",
    eyebrow: "+{{weeklyPoints}} points",
    contentHeading: "THE MATH IS MATHING",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
You earned {{weeklyPoints}} points this week, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Check your Hub for actions, challenges, and conversations you may have missed.
</p>`,
    ctaLabel: "Open the Hub",
    ctaUrl: "{{hubUrl}}",
    secondaryTitle: "Camp GPE",
    secondaryBody: `Seasonal challenges are still waiting when Camp is active.`,
    closingNote: "Keep that same energy.",
    text: `Your week in the Hub.

You earned {{weeklyPoints}} points this week, {{firstName}}.
Check your Hub for actions, challenges, and conversations you may have missed.

Open the Hub:
{{hubUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "monthly-digest",
    trigger: "Monthly Hub digest for opted-in users.",
    idempotency: "monthly-digest:{recipient_email}:{month}",
    variables: ["firstName", "monthlyHighlights", "hubUrl"],
    subject: "Your GPE month in one place 💖",
    preview: "A quick look at what happened around the Hub.",
    heroSymbol: "🗓️",
    heroHeading: "MONTHLY DIGEST",
    heroText: "A quick look at what happened around the Hub.",
    eyebrow: "Hub digest",
    contentHeading: "HERE IS THE RECAP",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Hey {{firstName}}, here is what happened around the Hub.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
{{monthlyHighlights}}
</p>`,
    ctaLabel: "Open the Hub",
    ctaUrl: "{{hubUrl}}",
    secondaryTitle: "Your Hub",
    secondaryBody: OFFICIAL_HUB_DESCRIPTION,
    closingNote: "Come find your next move.",
    text: `Your GPE month in one place.

Hey {{firstName}}, here is what happened around the Hub.
{{monthlyHighlights}}

Open the Hub:
{{hubUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "leaderboard-update",
    trigger: "A user reaches a leaderboard milestone or admin-selected ranking notification.",
    idempotency: "leaderboard-update:{user_id}:{leaderboard_window}",
    variables: ["firstName", "leaderboardPosition", "pointsUrl"],
    subject: "Leaderboard check 👀",
    preview: "Your Hub ranking has an update.",
    heroSymbol: "⚡",
    heroHeading: "LEADERBOARD CHECK",
    heroText: "Your Hub ranking has an update.",
    eyebrow: "Rank {{leaderboardPosition}}",
    contentHeading: "YOU ARE ON THE BOARD",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Hey {{firstName}}, you are ranked {{leaderboardPosition}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
The leaderboard updates from verified Hub actions.
</p>`,
    ctaLabel: "View Leaderboard",
    ctaUrl: "{{pointsUrl}}",
    secondaryTitle: "More points",
    secondaryBody: `Find another action when you are ready.`,
    closingNote: "The math is not mathing until Black + Brown femmes are leading.",
    text: `Leaderboard check.

Hey {{firstName}}, you are ranked {{leaderboardPosition}}.
The leaderboard updates from verified Hub actions.

View leaderboard:
{{pointsUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "camp-reminder",
    trigger: "Camp GPE reminder for opted-in participants.",
    idempotency: "camp-reminder:{season_id}:{recipient_email}:{reminder_key}",
    variables: ["firstName", "campUrl", "challengeTitle"],
    subject: "Camp GPE reminder 🏕️",
    preview: "A Camp GPE action is waiting.",
    heroSymbol: "🏕️",
    heroHeading: "CAMP CHECK",
    heroText: "A Camp GPE action is waiting.",
    eyebrow: "Camp GPE",
    contentHeading: "DO NOT MISS THIS ONE",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Hey {{firstName}}, {{challengeTitle}} is still open.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Complete it while the challenge is active so it can count.
</p>`,
    ctaLabel: "Open Camp GPE",
    ctaUrl: "{{campUrl}}",
    secondaryTitle: "Camp points",
    secondaryBody: `Verified actions flow into your Camp ledger automatically when eligible.`,
    closingNote: "No crafts. Just content, stories, signatures, and action.",
    text: `Camp GPE reminder.

Hey {{firstName}}, {{challengeTitle}} is still open.
Complete it while the challenge is active so it can count.

Open Camp GPE:
{{campUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "become-a-member",
    trigger: "Known contact or Hub user is invited to become a GPE member.",
    idempotency: "become-a-member:{recipient_email}:{cooldown_window}",
    variables: ["firstName", "membershipUrl", "membershipHelpUrl"],
    subject: "Come all the way in 💖",
    preview: "Here is how to become a GPE member.",
    heroSymbol: "💖",
    heroHeading: "COME ALL THE WAY IN",
    heroText: "Here is how to become a GPE member.",
    eyebrow: "Membership",
    contentHeading: "MAKE IT OFFICIAL",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Hey {{firstName}}, GPE membership is free and open when you are eligible.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Membership helps make room for Black + Brown femmes to lead in climate.
</p>`,
    ctaLabel: "Become a Member",
    ctaUrl: "{{membershipUrl}}",
    secondaryTitle: "Already a member?",
    secondaryBody: `Use the membership help link so Team GPE can connect your record.`,
    closingNote: "You can sit with us, girlie!",
    text: `Come all the way in.

Hey {{firstName}}, GPE membership is free and open when you are eligible.
Membership helps make room for Black + Brown femmes to lead in climate.

Become a member:
{{membershipUrl}}

Membership help:
{{membershipHelpUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "member-anniversary",
    trigger: "Member reaches an anniversary milestone.",
    idempotency: "member-anniversary:{membership_id}:{anniversary_year}",
    variables: ["firstName", "anniversaryYear", "hubUrl"],
    subject: "Still sitting with us 💖",
    preview: "Your GPE membership anniversary is here.",
    heroSymbol: "🎂",
    heroHeading: "MEMBER ANNIVERSARY",
    heroText: "Your GPE membership anniversary is here.",
    eyebrow: "Year {{anniversaryYear}}",
    contentHeading: "GLAD YOU ARE HERE",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
{{firstName}}, you have been a GPE member for {{anniversaryYear}} year.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Thanks for continuing to make space with us.
</p>`,
    ctaLabel: "Open the Hub",
    ctaUrl: "{{hubUrl}}",
    secondaryTitle: "Your membership",
    secondaryBody: `Black + Brown femmes belong in the room.`,
    closingNote: "Still sitting with us.",
    text: `Still sitting with us.

{{firstName}}, you have been a GPE member for {{anniversaryYear}} year.
Thanks for continuing to make space with us.

Open the Hub:
{{hubUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "renewal-reminder",
    trigger: "Hub-specific renewal reminder when Neon renewal ownership is not enough.",
    idempotency: "renewal-reminder:{membership_id}:{reminder_key}",
    variables: ["firstName", "renewalUrl"],
    subject: "Keep your seat with GPE 💖",
    preview: "Your GPE membership renewal needs attention.",
    heroSymbol: "💖",
    heroHeading: "MEMBERSHIP CHECK",
    heroText: "Your GPE membership renewal needs attention.",
    eyebrow: "Renewal",
    contentHeading: "STAY WITH US",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Hey {{firstName}}, your membership is ready for renewal.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Renew below to keep your GPE membership active.
</p>`,
    ctaLabel: "Renew Membership",
    ctaUrl: "{{renewalUrl}}",
    secondaryTitle: "Neon owns payment records",
    secondaryBody: `Your payment confirmation and receipt still come from Neon CRM.`,
    closingNote: "Come back to the table.",
    text: `Keep your seat with GPE.

Hey {{firstName}}, your membership is ready for renewal.
Renew below to keep your GPE membership active.

Renew membership:
{{renewalUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "win-back",
    trigger: "A lapsed or inactive member enters a reactivation journey.",
    idempotency: "win-back:{recipient_email}:{campaign_id}",
    variables: ["firstName", "membershipUrl", "hubUrl"],
    subject: "Come back to the table 💖",
    preview: "Your GPE seat is still here.",
    heroSymbol: "👀",
    heroHeading: "COME BACK",
    heroText: "Your GPE seat is still here.",
    eyebrow: "Membership",
    contentHeading: "WE SAVED YOUR SEAT",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Hey {{firstName}}, if you have been meaning to come back, this is your sign.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Renew or restart your membership when you are ready.
</p>`,
    ctaLabel: "Return to GPE",
    ctaUrl: "{{membershipUrl}}",
    secondaryTitle: "The Hub",
    secondaryBody: OFFICIAL_HUB_DESCRIPTION,
    closingNote: "The group chat is open.",
    text: `Come back to the table.

Hey {{firstName}}, if you have been meaning to come back, this is your sign.
Renew or restart your membership when you are ready.

Return to GPE:
{{membershipUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "resource-released",
    trigger: "A new public or member resource is released.",
    idempotency: "resource-released:{resource_id}:{recipient_email}",
    variables: ["firstName", "resourceTitle", "resourceUrl"],
    subject: "New resource just dropped 💖",
    preview: "{{resourceTitle}} is ready.",
    heroSymbol: "📌",
    heroHeading: "RESOURCE DROP",
    heroText: "{{resourceTitle}} is ready.",
    eyebrow: "New resource",
    contentHeading: "COME GET THIS",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Hey {{firstName}}, {{resourceTitle}} is ready.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
We keep useful climate + environmental justice resources close.
</p>`,
    ctaLabel: "Open Resource",
    ctaUrl: "{{resourceUrl}}",
    secondaryTitle: "For the girlies",
    secondaryBody: `Good resources should not be hard to find.`,
    closingNote: "Come find your next move.",
    text: `New resource just dropped.

Hey {{firstName}}, {{resourceTitle}} is ready.
We keep useful climate + environmental justice resources close.

Open resource:
{{resourceUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "jobs-digest",
    trigger: "Jobs digest for opted-in Hub users.",
    idempotency: "jobs-digest:{recipient_email}:{digest_window}",
    variables: ["firstName", "jobsUrl"],
    subject: "Those good jobs are waiting 💖",
    preview: "Fresh climate opportunities from the GPE Hub.",
    heroSymbol: "💼",
    heroHeading: "JOBS DIGEST",
    heroText: "Fresh climate opportunities from the GPE Hub.",
    eyebrow: "Jobs",
    contentHeading: "COME FIND YOUR NEXT MOVE",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Hey {{firstName}}, new opportunities are waiting in the Hub.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
We keep those good jobs close for Black + Brown femmes in climate.
</p>`,
    ctaLabel: "Browse Jobs",
    ctaUrl: "{{jobsUrl}}",
    secondaryTitle: "Good jobs",
    secondaryBody: `Jobs, resources, funding + mentors belong where our community can actually find them.`,
    closingNote: "Come find your next move.",
    text: `Those good jobs are waiting.

Hey {{firstName}}, new opportunities are waiting in the Hub.
We keep those good jobs close for Black + Brown femmes in climate.

Browse jobs:
{{jobsUrl}}

${OFFICIAL_FOOTER}`
  }),
  makeLifecycleTemplate({
    key: "newsletter",
    trigger: "Newsletter or community announcement for opted-in recipients.",
    idempotency: "newsletter:{campaign_id}:{recipient_email}",
    variables: ["firstName", "newsletterUrl"],
    subject: "GPE community update 💖",
    preview: "A note from Girl Plus Environment.",
    heroSymbol: "💌",
    heroHeading: "COMMUNITY UPDATE",
    heroText: "A note from Girl Plus Environment.",
    eyebrow: "GPE update",
    contentHeading: "HERE IS WHAT IS NEW",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Hey {{firstName}}, here is the latest from GPE.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Real environmental action led by us and for us.
</p>`,
    ctaLabel: "Visit GPE",
    ctaUrl: "{{newsletterUrl}}",
    secondaryTitle: "The Hub",
    secondaryBody: OFFICIAL_HUB_DESCRIPTION,
    closingNote: "Learn, share, act.",
    text: `GPE community update.

Hey {{firstName}}, here is the latest from GPE.
Real environmental action led by us and for us.

Visit GPE:
{{newsletterUrl}}

${OFFICIAL_FOOTER}`
  })
);
