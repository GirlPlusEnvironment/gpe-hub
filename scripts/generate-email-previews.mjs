import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderEmailHtml, renderText } from "../emails/shared/email-layout.mjs";
import { resendTemplates, sampleVariables } from "../emails/shared/resend-templates.mjs";

const root = process.cwd();

async function ensureDirs() {
  await mkdir(join(root, "emails", "resend"), { recursive: true });
  await mkdir(join(root, "emails", "plain-text"), { recursive: true });
  await mkdir(join(root, "emails", "previews"), { recursive: true });
}

function previewShell(template, html, text, variables) {
  const mobileHtml = renderEmailHtml(template, {
    ...variables,
    firstName: "Alexandria-Cassandra-Monique",
    actionName: "A very long public action title that should wrap without breaking the card",
    eventName: "A very long event title for checking mobile wrapping and Outlook-friendly tables",
    personalNote: "<script>alert('nope')</script> Please come through."
  });
  const optionalHtml = renderEmailHtml(template, {
    ...variables,
    personalNote: "",
    points: "",
    cabinRank: "",
    personalRank: ""
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.key} preview</title>
  <style>
    body { margin: 0; background: #f4f4f4; color: #111; font-family: Arial, sans-serif; }
    main { max-width: 1320px; margin: 0 auto; padding: 24px; }
    h1, h2 { font-family: Arial Black, Arial, sans-serif; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 390px; gap: 24px; align-items: start; }
    iframe { width: 100%; height: 980px; border: 3px solid #000; background: white; }
    .mobile iframe { width: 390px; }
    pre { white-space: pre-wrap; background: #fff; border: 3px solid #000; padding: 16px; overflow: auto; }
  </style>
</head>
<body>
  <main>
    <h1>${template.key}</h1>
    <div class="grid">
      <section>
        <h2>Desktop</h2>
        <iframe title="${template.key} desktop" srcdoc="${html.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></iframe>
        <h2>Missing Optional Variables</h2>
        <iframe title="${template.key} optional" srcdoc="${optionalHtml.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></iframe>
      </section>
      <section class="mobile">
        <h2>Mobile</h2>
        <iframe title="${template.key} mobile" srcdoc="${mobileHtml.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></iframe>
        <h2>Plain Text</h2>
        <pre>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
      </section>
    </div>
  </main>
</body>
</html>`;
}

async function main() {
  await ensureDirs();
  const indexLinks = [];

  for (const template of resendTemplates) {
    const html = renderEmailHtml(template, sampleVariables);
    const text = renderText(template, sampleVariables);
    const fileName = `${template.key}.html`;
    const textName = `${template.key}.txt`;

    await writeFile(join(root, "emails", "resend", fileName), html);
    await writeFile(join(root, "emails", "plain-text", textName), text);
    await writeFile(join(root, "emails", "previews", fileName), previewShell(template, html, text, sampleVariables));
    indexLinks.push(`<li><a href="./${fileName}">${template.key}</a></li>`);
  }

  await writeFile(join(root, "emails", "previews", "index.html"), `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>GPE Email Previews</title></head>
<body style="font-family:Arial,sans-serif;background:#fbd3d3;color:#000;padding:32px;">
  <h1 style="font-family:Arial Black,Arial,sans-serif;text-transform:uppercase;">GPE Resend Email Previews</h1>
  <ul>${indexLinks.join("")}</ul>
</body>
</html>`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
