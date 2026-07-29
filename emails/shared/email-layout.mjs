import { OFFICIAL_FOOTER } from "./email-tokens.mjs";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTemplateString(value, variables = {}) {
  return String(value ?? "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    return escapeHtml(variables[key] ?? `{{${key}}}`);
  });
}

export function renderOptionalBlocks(html, variables = {}) {
  return String(html || "")
    .replace(/\{\{#if ([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, block) => {
      return variables[key] ? block : "";
    });
}

export function renderEmailHtml(template, variables = {}) {
  const primaryCta = template.primaryCta
    ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 30px;">
                <tr>
                  <td
                    align="center"
                    bgcolor="#d53f8c"
                    style="background-color:#d53f8c;border:3px solid #000000;border-radius:999px;box-shadow:5px 5px 0 #000000;"
                  >
                    <a
                      href="${renderTemplateString(template.primaryCta.url, variables)}"
                      style="display:inline-block;padding:16px 28px;font-family:Arial Black,Arial,sans-serif;font-size:17px;line-height:1;text-transform:uppercase;text-decoration:none;color:#ffffff;"
                    >
                      ${escapeHtml(template.primaryCta.label)} →
                    </a>
                  </td>
                </tr>
              </table>`
    : "";

  const bodyHtml = renderOptionalBlocks(renderTemplateString(template.bodyHtml, variables), variables);
  const secondaryHtml = renderOptionalBlocks(renderTemplateString(template.secondaryHtml || "", variables), variables);
  const footerLinks = template.footerLinksHtml
    ? renderTemplateString(template.footerLinksHtml, variables)
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${renderTemplateString(template.subject, variables)}</title>
</head>
<body style="margin:0;padding:0;background-color:#fbd3d3;color:#000000;font-family:'Courier New',Courier,monospace;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(template.preview)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#fbd3d3;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;">
          <tr>
            <td
              align="center"
              bgcolor="#000000"
              style="background-color:#000000;border:3px solid #000000;border-radius:32px 32px 0 0;padding:40px 28px;"
            >
              <div style="font-size:58px;line-height:1;margin-bottom:16px;color:#ffffff;">
                ${escapeHtml(template.heroSymbol)}
              </div>
              <div
                style="font-family:Arial Black,Arial,sans-serif;font-size:38px;line-height:1.05;font-weight:900;text-transform:uppercase;color:#ffffff;"
              >
                ${escapeHtml(template.heroHeading)}
              </div>
              <p style="max-width:470px;margin:20px auto 0;font-size:17px;line-height:1.6;font-weight:700;color:#ffffff;">
                ${renderTemplateString(template.heroText, variables)}
              </p>
            </td>
          </tr>
          <tr>
            <td
              bgcolor="#ffffff"
              style="background-color:#ffffff;border:3px solid #000000;border-top:0;border-radius:0 0 32px 32px;padding:42px 36px;box-shadow:8px 8px 0 #000000;"
            >
              <div
                style="display:inline-block;background-color:#67e8f9;border:3px solid #000000;border-radius:999px;padding:7px 14px;font-size:12px;line-height:1;font-weight:700;text-transform:uppercase;"
              >
                ${renderTemplateString(template.eyebrow, variables)}
              </div>
              <h1
                style="margin:24px 0 16px;font-family:Arial Black,Arial,sans-serif;font-size:34px;line-height:1.1;font-weight:900;text-transform:uppercase;color:#000000;"
              >
                ${renderTemplateString(template.contentHeading, variables)}
              </h1>
              ${bodyHtml}
              ${primaryCta}
              ${secondaryHtml}
              <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#555555;">
                ${renderTemplateString(template.closingNote, variables)}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 16px 0;">
              <p style="margin:0 0 12px;font-size:13px;line-height:1.7;font-weight:700;color:#000000;">
                ${escapeHtml(OFFICIAL_FOOTER)}
              </p>
              <p style="margin:0;font-size:11px;line-height:1.6;font-weight:700;text-transform:uppercase;color:#000000;">
                Girl + Environment Community Hub
              </p>
              ${footerLinks}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderText(template, variables = {}) {
  return renderOptionalBlocks(renderTemplateString(template.text, variables), variables);
}
