import { escapeHtml } from "./email.ts";

type MembershipRequiredEmailInput = {
  firstName: string;
  recipientEmail: string;
  daysRemaining: number;
  deadlineLabel: string;
  membershipUrl: string;
  hubUrl: string;
  finalNotice: boolean;
};

// Source design: emails/neon/membership/membership-required.html
export function renderMembershipRequiredEmail(input: MembershipRequiredEmailInput) {
  const firstName = escapeHtml(input.firstName || "there");
  const recipientEmail = escapeHtml(input.recipientEmail);
  const daysRemaining = escapeHtml(String(input.daysRemaining));
  const deadlineLabel = escapeHtml(input.deadlineLabel);
  const membershipUrl = escapeHtml(input.membershipUrl);
  const hubUrl = escapeHtml(input.hubUrl);
  const finalNotice = input.finalNotice;
  const preview = finalNotice
    ? "Final notice: confirm your GPE membership to keep Hub access."
    : "Confirm your GPE membership to keep Hub access.";
  const noticeCopy = finalNotice
    ? "This is your final membership notice. Please create your GPE membership today. If we are unable to confirm your membership, your Hub account will be scheduled for deletion."
    : `Please create your GPE membership by ${deadlineLabel}. You have ${daysRemaining} days remaining before your Hub access is scheduled for removal.`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="width=device-width" name="viewport"/><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/><meta content="IE=edge" http-equiv="X-UA-Compatible"/><meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"/><title>Confirm Your GPE Membership</title><style>@media (prefers-color-scheme: dark){li::marker{color:#c4c4c4}}</style></head><body dir="ltr" lang="en" style="margin:0;padding:0;background-color:#fbd3d3;color:#000000;font-family:'Courier New',Courier,monospace;"><div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;color:transparent;" data-skip-in-text="true">${escapeHtml(preview)}</div><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center" style="width:100%;background-color:#fbd3d3;"><tbody><tr><td align="center" style="padding:40px 16px;"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:620px;"><tbody><tr><td align="center" style="padding:40px 28px;background-color:#000000;border:3px solid #000000;border-radius:32px 32px 0 0;"><div style="font-size:58px;line-height:1;margin-bottom:16px;color:#ffffff;"><p style="margin:0;padding:0">★</p></div><div style="font-family:Arial Black,Arial,sans-serif;font-size:38px;line-height:1.05;font-weight:900;text-transform:uppercase;color:#ffffff;"><p style="margin:0;padding:0">${finalNotice ? "Final Notice" : "One More Step"}</p></div><p style="margin:20px auto 0;max-width:490px;font-size:17px;line-height:1.6;font-weight:700;color:#ffffff;">Thank you for creating your Girl + Environment Community Hub account.</p></td></tr><tr><td style="padding:42px 36px;background-color:#ffffff;border:3px solid #000000;border-top:0;border-radius:0 0 32px 32px;box-shadow:8px 8px 0 #000000;"><div style="display:inline-block;background-color:#f9a8d4;border:3px solid #000000;border-radius:999px;padding:7px 14px;font-size:12px;line-height:1;font-weight:700;text-transform:uppercase;"><p style="margin:0;padding:0">Membership required</p></div><h1 style="margin:24px 0 16px;font-family:Arial Black,Arial,sans-serif;font-size:34px;line-height:1.1;font-weight:900;text-transform:uppercase;color:#000000;">Keep Your Hub Access</h1><p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">Hi ${firstName}, GPE Hub accounts are available to active Girl + Environment members.</p><p style="margin:0 0 18px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">We could not confirm an active membership connected to ${recipientEmail}.</p><p style="margin:0 0 28px;font-size:16px;line-height:1.7;font-weight:700;color:#000000;">${noticeCopy}</p><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 30px;"><tbody><tr><td align="center" style="background-color:#000000;border:3px solid #000000;border-radius:999px;box-shadow:5px 5px 0 #d53f8c;"><p style="margin:0;padding:0"><a href="${membershipUrl}" rel="noopener noreferrer nofollow" style="color:#ffffff;text-decoration:none;display:block;padding:16px 24px;font-family:Arial Black,Arial,sans-serif;font-size:17px;line-height:1.2;text-transform:uppercase;" target="_blank">Become a GPE Member →</a></p></td></tr></tbody></table><div style="margin:0;padding:20px;background-color:#dcfce7;border:3px solid #000000;border-radius:20px;"><p style="margin:0 0 10px;font-size:14px;line-height:1.6;font-weight:700;color:#000000;">Already a GPE member?</p><p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">Make sure your membership uses the same email address as your Hub account. You can return to the Hub at <a href="${hubUrl}" rel="noopener noreferrer nofollow" style="color:#000000;text-decoration:underline;font-weight:900;" target="_blank">members.girlplusenvironment.org</a>.</p></div><p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#555555;">If you believe you received this message by mistake or already have an active membership under another email address, please contact the Girl + Environment team before the deadline.</p></td></tr><tr><td align="center" style="padding:28px 16px 0;"><p style="margin:0 0 8px;font-size:11px;line-height:1.6;font-weight:700;text-transform:uppercase;color:#000000;">Girl + Environment Community Hub</p><p style="margin:0;font-size:11px;line-height:1.6;color:#000000;"><a href="${hubUrl}" rel="noopener noreferrer nofollow" style="color:#000000;text-decoration:underline;" target="_blank">Visit the GPE Hub</a></p></td></tr></tbody></table></td></tr></tbody></table></body></html>`;

  const text = `${finalNotice ? "Final membership notice" : "Confirm your GPE membership"}

Hi ${input.firstName || "there"},

GPE Hub accounts are available to active Girl + Environment members.
We could not confirm an active membership connected to ${input.recipientEmail}.

${finalNotice ? "This is your final membership notice. Please create your GPE membership today. If we are unable to confirm your membership, your Hub account will be scheduled for deletion." : `Please create your GPE membership by ${input.deadlineLabel}. You have ${input.daysRemaining} days remaining before your Hub access is scheduled for removal.`}

Become a GPE member:
${input.membershipUrl}

Hub account email:
${input.recipientEmail}

Visit the Hub:
${input.hubUrl}`;

  return {
    subject: finalNotice ? "Final notice: confirm your GPE membership" : "Confirm your GPE membership",
    preview,
    html,
    text,
  };
}
