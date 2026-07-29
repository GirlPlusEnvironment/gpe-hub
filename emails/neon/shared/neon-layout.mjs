import { NEON_FOOTER } from "./neon-email-tokens.mjs";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function replaceVars(value, variables = {}) {
  return String(value ?? "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    return escapeHtml(variables[key] ?? `{{${key}}}`);
  });
}

export function neonPlaceholder(label) {
  return `<div style="background-color:#fdf2f8;border:3px dashed #000000;border-radius:20px;padding:18px;margin:0 0 24px;">
  <p style="margin:0 0 8px;font-family:Arial Black,Arial,sans-serif;font-size:14px;line-height:1.3;text-transform:uppercase;color:#000000;">
    Neon token required
  </p>
  <p style="margin:0;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    ${escapeHtml(label)}
  </p>
</div>`;
}

export function renderNeonHtml(template, variables = {}) {
  const cta = template.button
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 30px;">
                <tr>
                  <td align="center" bgcolor="#d53f8c" style="background-color:#d53f8c;border:3px solid #000000;border-radius:999px;box-shadow:5px 5px 0 #000000;">
                    <a href="${replaceVars(template.button.url, variables)}" style="display:inline-block;padding:16px 28px;font-family:Arial Black,Arial,sans-serif;font-size:17px;line-height:1;text-transform:uppercase;text-decoration:none;color:#ffffff;">
                      ${escapeHtml(template.button.label)} →
                    </a>
                  </td>
                </tr>
              </table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(template.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#fbd3d3;color:#000000;font-family:'Courier New',Courier,monospace;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#fbd3d3;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;">
          <tr>
            <td align="center" bgcolor="#000000" style="background-color:#000000;border:3px solid #000000;border-radius:32px 32px 0 0;padding:40px 28px;">
              <div style="font-size:58px;line-height:1;margin-bottom:16px;color:#ffffff;">${escapeHtml(template.heroSymbol || "✦")}</div>
              <div style="font-family:Arial Black,Arial,sans-serif;font-size:38px;line-height:1.05;font-weight:900;text-transform:uppercase;color:#ffffff;">${escapeHtml(template.hero)}</div>
              <p style="max-width:470px;margin:20px auto 0;font-size:17px;line-height:1.6;font-weight:700;color:#ffffff;">${replaceVars(template.heroText, variables)}</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;border:3px solid #000000;border-top:0;border-radius:0 0 32px 32px;padding:42px 36px;box-shadow:8px 8px 0 #000000;">
              <div style="display:inline-block;background-color:#67e8f9;border:3px solid #000000;border-radius:999px;padding:7px 14px;font-size:12px;line-height:1;font-weight:700;text-transform:uppercase;">${escapeHtml(template.label)}</div>
              <h1 style="margin:24px 0 16px;font-family:Arial Black,Arial,sans-serif;font-size:34px;line-height:1.1;font-weight:900;text-transform:uppercase;color:#000000;">${escapeHtml(template.heading)}</h1>
              ${replaceVars(template.bodyHtml, variables)}
              ${template.requiredBlockLabel ? neonPlaceholder(template.requiredBlockLabel) : ""}
              ${cta}
              ${replaceVars(template.secondaryHtml || "", variables)}
              <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#555555;">${replaceVars(template.closing || "Keep this email for your records.", variables)}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 16px 0;">
              <p style="max-width:560px;margin:0 auto;font-size:13px;line-height:1.7;font-weight:700;color:#000000;">
                ${escapeHtml(NEON_FOOTER)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderNeonText(template, variables = {}) {
  return replaceVars(template.text, variables);
}
