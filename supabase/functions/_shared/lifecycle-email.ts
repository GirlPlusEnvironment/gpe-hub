import { escapeHtml } from "./email.ts";
import { safeError } from "./neon-membership.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
};

type TemplateDefinition = {
  subject: string;
  preview: string;
  heroSymbol: string;
  heroHeading: string;
  heroText: string;
  eyebrow: string;
  contentHeading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  standardCtaBlock?: boolean;
  secondaryTitle?: string;
  secondaryBody?: string;
  closingNote: string;
  text: string;
};

type LifecycleEmailInput = {
  templateKey: keyof typeof TEMPLATES;
  recipientEmail: string;
  recipientUserId?: string | null;
  neonAccountId?: string | null;
  eventType: string;
  sourceType: string;
  sourceId?: string | null;
  idempotencyKey: string;
  category: string;
  variables: Record<string, unknown>;
};

const OFFICIAL_FOOTER =
  "Girl Plus Environment\nEmail preferences: {{preferencesUrl}}";

const HUB_SUPPORTING_COPY =
  "The GPE Community Hub brings together jobs, resources, funding opportunities, mentors, events, and community for Black + Brown femmes in climate.";

const TEMPLATES = {
  "action-network-petition-thank-you": {
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
{{petitionFollowupCopy}}
</p>`,
    ctaLabel: "Explore More Actions",
    ctaUrl: "{{moreActionsUrl}}",
    standardCtaBlock: true,
    secondaryTitle: "Keep taking action",
    secondaryBody: `Your voice matters beyond this one petition. <a href="{{resourcesUrl}}" style="color:#000000;text-decoration:underline;">View Resources</a> for campaign context and community tools.`,
    closingNote: "That signature looks good on you.",
    text: `Action complete.

Your signature for {{petitionName}} is in, {{firstName}}.
Awarded points: {{awardedPoints}}
Saved points: {{pendingPoints}}

{{petitionFollowupCopy}}

{{primaryCtaLabel}}:
{{primaryCtaUrl}}

Explore More Actions:
{{moreActionsUrl}}

View Resources:
{{resourcesUrl}}

Become a Member:
{{membershipUrl}}

Invite a Member:
{{invitePageUrl}}

Enter the Hub:
{{hubUrl}}

${OFFICIAL_FOOTER}`
  },
  "graduate-highlight-submission": {
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
    secondaryBody: "Find climate tools, community support, and resources you can use right now.",
    closingNote: "Come find your next move.",
    text: `We got your Grad Highlight.

Thanks for sharing your Grad Highlight, {{firstName}}.
Team GPE has your submission. If you joined as a member, that record will be connected too.

Open the Hub:
{{hubUrl}}

${OFFICIAL_FOOTER}`
  },
  "survey-thank-you": {
    subject: "We got your survey 💖",
    preview: "Thanks for sharing what is happening in your community.",
    heroSymbol: "🌦️",
    heroHeading: "SURVEY RECEIVED",
    heroText: "Thank you for sharing your perspective with Girl Plus Environment.",
    eyebrow: "Survey complete",
    contentHeading: "THANK YOU",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Thanks for completing {{surveyName}}, {{firstName}}.
</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#000000;">
Your response helps us understand what our communities are dealing with right now.
</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#000000;">
{{resultTitle}}
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
{{resultSummary}}
</p>`,
    standardCtaBlock: true,
    secondaryTitle: "Continue your impact",
    secondaryBody: HUB_SUPPORTING_COPY,
    closingNote: "Real environmental action led by us and for us.",
    text: `We got your survey.

Thanks for completing {{surveyName}}, {{firstName}}.
Your response helps us understand what our communities are dealing with right now.

{{resultTitle}}
{{resultSummary}}

Become a Member:
{{membershipUrl}}

Invite a Member:
{{invitePageUrl}}

Enter the Hub:
{{hubUrl}}

${OFFICIAL_FOOTER}`
  },
  "camp-gpe-submission": {
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
    secondaryBody: "No crafts. Just content, stories, signatures, and action.",
    closingNote: "Camp GPE runs on verified action.",
    text: `Camp GPE got your submission.

Thanks, {{firstName}}. We saved your {{submissionName}}.
If this action earns points, the Hub will show them after verification.

Open Camp GPE:
{{campUrl}}

${OFFICIAL_FOOTER}`
  },
  "member-welcome": {
    subject: "🎉 Welcome to Girl Plus Environment!",
    preview: "Your GPE membership is confirmed.",
    heroSymbol: "💖",
    heroHeading: "MEMBERSHIP CONFIRMED",
    heroText: "Welcome to Girl Plus Environment.",
    eyebrow: "Membership confirmed",
    contentHeading: "WELCOME TO GPE",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Your membership is active, {{firstName}}.
</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#000000;">
Membership includes access to opportunities, resources, funding, events, mentors, and community through the GPE Community Hub.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
We are preparing your Hub account now. You will receive another email as soon as your Hub account is ready.
</p>`,
    secondaryTitle: "What membership includes",
    secondaryBody: "Jobs, resources, funding opportunities, mentors, events, and community for Black + Brown femmes leading climate and environmental justice.",
    closingNote: "Black + Brown femmes belong in the room.",
    text: `Welcome to Girl Plus Environment.

Your membership is active, {{firstName}}.
Membership includes access to opportunities, resources, funding, events, mentors, and community through the GPE Community Hub.
We are preparing your Hub account now. You will receive another email as soon as your Hub account is ready.

If you have not received your Hub access email within 24 hours, contact hello@girlplusenvironment.org.

${OFFICIAL_FOOTER}`
  },
  "hub-welcome": {
    subject: "Your GPE Community Hub is Ready 🌱",
    preview: "Your GPE Community Hub account is ready.",
    heroSymbol: "🌱",
    heroHeading: "HUB READY",
    heroText: "Your GPE Community Hub account is ready.",
    eyebrow: "Hub access",
    contentHeading: "COME FIND YOUR NEXT MOVE",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Your account is ready, {{firstName}}.
</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#000000;">
Sign in with the same email you used for membership. Then complete your profile, start earning points, join Camp GPE, and browse jobs and resources.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
{{hubAccessInstructions}}
</p>`,
    ctaLabel: "Enter the Hub",
    ctaUrl: "{{hubUrl}}",
    secondaryTitle: "Start here",
    secondaryBody: "Complete your profile, check Camp GPE, browse jobs and resources, and connect with community.",
    closingNote: "For the girlies. For our communities. For climate justice.",
    text: `Your GPE Community Hub is Ready.

Your account is ready, {{firstName}}.
Sign in with the same email you used for membership. Then complete your profile, start earning points, join Camp GPE, and browse jobs and resources.

{{hubAccessInstructions}}

Enter the Hub:
{{hubUrl}}

${OFFICIAL_FOOTER}`
  },
  "donation-confirmation": {
    subject: "We got your donation pledge 💖",
    preview: "Your donation information was received.",
    heroSymbol: "💚",
    heroHeading: "DONATION RECEIVED",
    heroText: "Your support helps Black + Brown femmes lead in climate.",
    eyebrow: "Donation",
    contentHeading: "THANK YOU FOR SUPPORTING GPE",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Thanks for supporting Girl Plus Environment, {{firstName}}.
</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#000000;">
We received your donation information for {{donationAmount}} {{donationFrequency}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
If payment is still needed, use the secure payment link below. No card details were stored by the Hub.
</p>`,
    ctaLabel: "Complete Donation",
    ctaUrl: "{{paymentUrl}}",
    secondaryTitle: "Community Hub",
    secondaryBody: HUB_SUPPORTING_COPY,
    closingNote: "Thank you for helping make more room in climate.",
    text: `We got your donation information.

Thanks for supporting Girl Plus Environment, {{firstName}}.
Donation: {{donationAmount}} {{donationFrequency}}

Complete donation:
{{paymentUrl}}

${OFFICIAL_FOOTER}`
  },
  "hub-user-nonmember": {
    subject: "Okayyy, you found the Hub 💖",
    preview: "You have a Hub account. Here’s how to become a GPE member too.",
    heroSymbol: "🌎",
    heroHeading: "YOU FOUND THE HUB",
    heroText: "Now let’s make sure you know what membership means.",
    eyebrow: "Membership check",
    contentHeading: "COME ALL THE WAY IN",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
You already have a GPE Hub account, {{firstName}}.
</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#000000;">
Membership is required to keep long-term Hub access.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
You have {{daysRemaining}} days left in your grace period. Become a member with this same email so we can connect your account.
</p>`,
    ctaLabel: "Become a GPE Member",
    ctaUrl: "{{membershipUrl}}",
    secondaryTitle: "Already a member?",
    secondaryBody: "Use the membership help link so Team GPE can connect your account.",
    closingNote: "Come make space with us.",
    text: `Okayyy, you found the Hub.

You already have a GPE Hub account, {{firstName}}.
Membership is required to keep long-term Hub access.
You have {{daysRemaining}} days left in your grace period.

Become a GPE member:
{{membershipUrl}}

Already a member? Get membership help:
{{membershipHelpUrl}}

${OFFICIAL_FOOTER}`
  },
  "win-back": {
    subject: "Girl, your Hub access needs attention 👀",
    preview: "Membership is required to keep using the GPE Hub.",
    heroSymbol: "👀",
    heroHeading: "HUB ACCESS CHECK",
    heroText: "Your membership grace period has ended.",
    eyebrow: "Membership required",
    contentHeading: "COME BACK TO THE TABLE",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
Your GPE Hub grace period has ended, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Become a GPE member with this same email to restore long-term Hub access.
</p>`,
    ctaLabel: "Become a GPE Member",
    ctaUrl: "{{membershipUrl}}",
    secondaryTitle: "Need help?",
    secondaryBody: "If your membership uses another email, Team GPE can help connect it.",
    closingNote: "The group chat will be here when your membership is connected.",
    text: `Your Hub access needs attention.

Your GPE Hub grace period has ended, {{firstName}}.
Become a GPE member with this same email to restore long-term Hub access.

Become a GPE member:
{{membershipUrl}}

Membership help:
{{membershipHelpUrl}}

${OFFICIAL_FOOTER}`
  }
} satisfies Record<string, TemplateDefinition>;

function env(name: string) {
  return Deno.env.get(name) || "";
}

function render(value: string, variables: Record<string, unknown>) {
  return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => escapeHtml(variables[key] ?? ""));
}

function renderStandardCtaBlock(variables: Record<string, unknown>) {
  const membershipUrl = render("{{membershipUrl}}", variables);
  const invitePageUrl = render("{{invitePageUrl}}", variables);
  const hubUrl = render("{{hubUrl}}", variables);
  const buttonStyle = "display:block;padding:15px 16px;font-family:Arial Black,Arial,sans-serif;font-size:14px;line-height:1.15;text-transform:uppercase;text-decoration:none;color:#000000;";
  const cellStyle = "background-color:#fde68a;border:3px solid #000000;border-radius:18px;box-shadow:4px 4px 0 #000000;text-align:center;";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 28px;">
  <tr>
    <td width="50%" style="width:50%;padding:0 6px 12px 0;"><div style="${cellStyle}"><a href="${membershipUrl}" style="${buttonStyle}">Become a Member</a></div></td>
    <td width="50%" style="width:50%;padding:0 0 12px 6px;"><div style="${cellStyle}"><a href="${invitePageUrl}" style="${buttonStyle}">Invite a Member</a></div></td>
  </tr>
  <tr>
    <td colspan="2" style="padding:0;"><div style="background-color:#67e8f9;border:3px solid #000000;border-radius:18px;box-shadow:4px 4px 0 #000000;text-align:center;"><a href="${hubUrl}" style="${buttonStyle}">Enter the Hub</a></div></td>
  </tr>
</table>`;
}

function renderHtml(template: TemplateDefinition, variables: Record<string, unknown>) {
  const cta = template.ctaLabel && template.ctaUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 30px;"><tr><td align="center" bgcolor="#d53f8c" style="background-color:#d53f8c;border:3px solid #000000;border-radius:999px;box-shadow:5px 5px 0 #000000;"><a href="${render(template.ctaUrl, variables)}" style="display:inline-block;padding:16px 28px;font-family:Arial Black,Arial,sans-serif;font-size:17px;line-height:1;text-transform:uppercase;text-decoration:none;color:#ffffff;">${render(template.ctaLabel, variables)} →</a></td></tr></table>`
    : "";
  const standardCtas = template.standardCtaBlock ? renderStandardCtaBlock(variables) : "";
  const secondary = template.secondaryTitle || template.secondaryBody
    ? `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:18px;">${template.secondaryTitle ? `<p style="margin:0 0 10px;font-family:Arial Black,Arial,sans-serif;font-size:16px;line-height:1.3;text-transform:uppercase;color:#000000;">${escapeHtml(template.secondaryTitle)}</p>` : ""}<p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">${render(template.secondaryBody || "", variables)}</p></div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${render(template.subject, variables)}</title></head><body style="margin:0;padding:0;background-color:#fbd3d3;color:#000000;font-family:'Courier New',Courier,monospace;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(template.preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#fbd3d3;"><tr><td align="center" style="padding:40px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;"><tr><td align="center" bgcolor="#000000" style="background-color:#000000;border:3px solid #000000;border-radius:32px 32px 0 0;padding:40px 28px;"><div style="font-size:58px;line-height:1;margin-bottom:16px;color:#ffffff;">${escapeHtml(template.heroSymbol)}</div><div style="font-family:Arial Black,Arial,sans-serif;font-size:38px;line-height:1.05;font-weight:900;text-transform:uppercase;color:#ffffff;">${escapeHtml(template.heroHeading)}</div><p style="max-width:470px;margin:20px auto 0;font-size:17px;line-height:1.6;font-weight:700;color:#ffffff;">${render(template.heroText, variables)}</p></td></tr><tr><td bgcolor="#ffffff" style="background-color:#ffffff;border:3px solid #000000;border-top:0;border-radius:0 0 32px 32px;padding:42px 36px;box-shadow:8px 8px 0 #000000;"><div style="display:inline-block;background-color:#67e8f9;border:3px solid #000000;border-radius:999px;padding:7px 14px;font-size:12px;line-height:1;font-weight:700;text-transform:uppercase;">${render(template.eyebrow, variables)}</div><h1 style="margin:24px 0 16px;font-family:Arial Black,Arial,sans-serif;font-size:34px;line-height:1.1;font-weight:900;text-transform:uppercase;color:#000000;">${render(template.contentHeading, variables)}</h1>${render(template.body, variables)}${cta}${standardCtas}${secondary}<p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#555555;">${render(template.closingNote, variables)}</p></td></tr><tr><td align="center" style="padding:28px 16px 0;"><p style="margin:0;font-size:11px;line-height:1.6;font-weight:700;text-transform:uppercase;color:#000000;">Girl Plus Environment</p></td></tr></table></td></tr></table></body></html>`;
}

export async function sendLifecycleEmail(input: LifecycleEmailInput) {
  const template = TEMPLATES[input.templateKey];
  const supabaseUrl = (env("GPE_SUPABASE_URL") || env("SUPABASE_URL")).replace(/\/$/, "");
  const secret = env("GPE_EMAIL_SERVICE_SECRET");
  if (!template || !supabaseUrl || !secret) {
    return { ok: false, status: "not_configured" };
  }
  try {
    const variables = {
      hubUrl: env("GPE_HUB_LOGIN_URL")?.replace(/\/login\/?$/, "") || "https://members.girlplusenvironment.org",
      communityResourcesUrl: "https://www.girlplusenvironment.org/resources",
      membershipUrl: "https://www.girlplusenvironment.org/become-a-member",
      invitePageUrl: "https://members.girlplusenvironment.org/invite",
      moreActionsUrl: "https://www.girlplusenvironment.org/take-action",
      resourcesUrl: "https://www.girlplusenvironment.org/resources",
      preferencesUrl: "https://members.girlplusenvironment.org/email-preferences",
      campUrl: "https://members.girlplusenvironment.org/camp-gpe",
      ...input.variables
    };
    const res = await fetch(`${supabaseUrl}/functions/v1/gpe-lifecycle-email-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`
      },
      body: JSON.stringify({
        templateKey: input.templateKey,
        recipientEmail: input.recipientEmail,
        recipientUserId: input.recipientUserId || null,
        neonAccountId: input.neonAccountId || null,
        eventType: input.eventType,
        sourceType: input.sourceType,
        sourceId: input.sourceId || null,
        idempotencyKey: input.idempotencyKey,
        category: input.category,
        subject: render(template.subject, variables),
        html: renderHtml(template, variables),
        text: render(template.text, variables),
        variables
      })
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: String(body.status || res.status), deliveryId: body.deliveryId ? String(body.deliveryId) : null };
  } catch (error) {
    return { ok: false, status: "failed", errorSummary: safeError(error) };
  }
}
