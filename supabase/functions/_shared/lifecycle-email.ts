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
  "We've got those good jobs, resources, funding + mentors for black + brown femmes in climate. This is our place to share and make space for each other to lead this climate and environmental justice movement.";

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
If points were earned, the Hub will show whether they were added or saved for later.
</p>`,
    ctaLabel: "Check My Points",
    ctaUrl: "{{hubUrl}}/leaderboard",
    secondaryTitle: "Points status",
    secondaryBody: "Awarded: {{awardedPoints}}. Saved for later: {{pendingPoints}}.",
    closingNote: "That signature looks good on you.",
    text: `Action complete.

Your signature for {{petitionName}} is in, {{firstName}}.
Awarded points: {{awardedPoints}}
Saved points: {{pendingPoints}}

Check your points:
{{hubUrl}}/leaderboard

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
    secondaryBody: "A playful mission board for environmental justice opportunities, seasonal challenges, community conversations, and member connection.",
    closingNote: "Real environmental action led by us and for us.",
    text: `We got your survey.

Thanks for completing {{surveyName}}, {{firstName}}.
Your response helps us understand what our communities are dealing with right now.

View resources:
{{communityResourcesUrl}}

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
    subject: "You can sit with us, girlie! 💖",
    preview: "You’re officially a GPE member. Now join the group chat.",
    heroSymbol: "💖",
    heroHeading: "YOU CAN SIT WITH US",
    heroText: "Thanks for becoming a Girl Plus Environment member.",
    eyebrow: "Membership confirmed",
    contentHeading: "WELCOME TO GPE",
    body: `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">
You can sit with us, girlie!
</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#000000;">
Thanks for becoming a GPE member, {{firstName}}.
</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#000000;">
Your membership helps make room for Black + Brown femmes to lead this climate and environmental justice movement.
</p>`,
    ctaLabel: "Join the Group Chat",
    ctaUrl: "{{hubUrl}}",
    secondaryTitle: "Your Hub is ready",
    secondaryBody: "A playful mission board for environmental justice opportunities, seasonal challenges, community conversations, and member connection.",
    closingNote: "Black + Brown femmes belong in the room.",
    text: `You can sit with us, girlie!

Thanks for becoming a GPE member, {{firstName}}.
Your membership helps make room for Black + Brown femmes to lead this climate and environmental justice movement.

Join the group chat:
{{hubUrl}}

${OFFICIAL_FOOTER}`
  }
} satisfies Record<string, TemplateDefinition>;

function env(name: string) {
  return Deno.env.get(name) || "";
}

function render(value: string, variables: Record<string, unknown>) {
  return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => escapeHtml(variables[key] ?? ""));
}

function renderHtml(template: TemplateDefinition, variables: Record<string, unknown>) {
  const cta = template.ctaLabel && template.ctaUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 30px;"><tr><td align="center" bgcolor="#d53f8c" style="background-color:#d53f8c;border:3px solid #000000;border-radius:999px;box-shadow:5px 5px 0 #000000;"><a href="${render(template.ctaUrl, variables)}" style="display:inline-block;padding:16px 28px;font-family:Arial Black,Arial,sans-serif;font-size:17px;line-height:1;text-transform:uppercase;text-decoration:none;color:#ffffff;">${escapeHtml(template.ctaLabel)} →</a></td></tr></table>`
    : "";
  const secondary = template.secondaryTitle || template.secondaryBody
    ? `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:18px;">${template.secondaryTitle ? `<p style="margin:0 0 10px;font-family:Arial Black,Arial,sans-serif;font-size:16px;line-height:1.3;text-transform:uppercase;color:#000000;">${escapeHtml(template.secondaryTitle)}</p>` : ""}<p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">${render(template.secondaryBody || "", variables)}</p></div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${render(template.subject, variables)}</title></head><body style="margin:0;padding:0;background-color:#fbd3d3;color:#000000;font-family:'Courier New',Courier,monospace;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(template.preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#fbd3d3;"><tr><td align="center" style="padding:40px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;"><tr><td align="center" bgcolor="#000000" style="background-color:#000000;border:3px solid #000000;border-radius:32px 32px 0 0;padding:40px 28px;"><div style="font-size:58px;line-height:1;margin-bottom:16px;color:#ffffff;">${escapeHtml(template.heroSymbol)}</div><div style="font-family:Arial Black,Arial,sans-serif;font-size:38px;line-height:1.05;font-weight:900;text-transform:uppercase;color:#ffffff;">${escapeHtml(template.heroHeading)}</div><p style="max-width:470px;margin:20px auto 0;font-size:17px;line-height:1.6;font-weight:700;color:#ffffff;">${render(template.heroText, variables)}</p></td></tr><tr><td bgcolor="#ffffff" style="background-color:#ffffff;border:3px solid #000000;border-top:0;border-radius:0 0 32px 32px;padding:42px 36px;box-shadow:8px 8px 0 #000000;"><div style="display:inline-block;background-color:#67e8f9;border:3px solid #000000;border-radius:999px;padding:7px 14px;font-size:12px;line-height:1;font-weight:700;text-transform:uppercase;">${render(template.eyebrow, variables)}</div><h1 style="margin:24px 0 16px;font-family:Arial Black,Arial,sans-serif;font-size:34px;line-height:1.1;font-weight:900;text-transform:uppercase;color:#000000;">${render(template.contentHeading, variables)}</h1>${render(template.body, variables)}${cta}${secondary}<p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#555555;">${render(template.closingNote, variables)}</p></td></tr><tr><td align="center" style="padding:28px 16px 0;"><p style="margin:0 0 12px;font-size:13px;line-height:1.7;font-weight:700;color:#000000;">${escapeHtml(OFFICIAL_FOOTER)}</p><p style="margin:0;font-size:11px;line-height:1.6;font-weight:700;text-transform:uppercase;color:#000000;">Girl + Environment Community Hub</p></td></tr></table></td></tr></table></body></html>`;
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
