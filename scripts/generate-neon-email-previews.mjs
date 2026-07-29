import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderNeonHtml, renderNeonText } from "../emails/neon/shared/neon-layout.mjs";
import { SAMPLE_NEON } from "../emails/neon/shared/neon-email-tokens.mjs";
import { neonTemplates } from "../emails/neon/shared/neon-templates.mjs";

const root = process.cwd();

function escapedSrcdoc(html) {
  return html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function previewPage(template, html, text) {
  const longHtml = renderNeonHtml(template, {
    ...SAMPLE_NEON,
    firstName: "Alexandria-Cassandra-Monique",
    eventName: "A very long event title that should wrap correctly in the Neon email card"
  });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.file} preview</title>
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
    <h1>${template.group} / ${template.file}</h1>
    <p><strong>Subject:</strong> ${template.subject}</p>
    <p><strong>Required tokens:</strong> ${template.tokens.join(", ")}</p>
    <div class="grid">
      <section>
        <h2>Desktop</h2>
        <iframe title="${template.file} desktop" srcdoc="${escapedSrcdoc(html)}"></iframe>
      </section>
      <section class="mobile">
        <h2>Mobile Long Values</h2>
        <iframe title="${template.file} mobile" srcdoc="${escapedSrcdoc(longHtml)}"></iframe>
        <h2>Plain Text</h2>
        <pre>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
      </section>
    </div>
  </main>
</body>
</html>`;
}

async function main() {
  const links = [];
  for (const dir of ["membership", "events", "donations", "purchases", "volunteers", "plain-text", "previews"]) {
    await mkdir(join(root, "emails", "neon", dir), { recursive: true });
  }

  for (const template of neonTemplates) {
    const html = renderNeonHtml(template, SAMPLE_NEON);
    const text = renderNeonText(template, SAMPLE_NEON);
    await writeFile(join(root, "emails", "neon", template.group, `${template.file}.html`), html);
    await writeFile(join(root, "emails", "neon", "plain-text", `${template.file}.txt`), text);
    await writeFile(join(root, "emails", "neon", "previews", `${template.file}.html`), previewPage(template, html, text));
    links.push(`<li><a href="./${template.file}.html">${template.group} / ${template.file}</a></li>`);
  }

  await writeFile(join(root, "emails", "neon", "previews", "index.html"), `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Neon Email Previews</title></head>
<body style="font-family:Arial,sans-serif;background:#fbd3d3;color:#000;padding:32px;">
  <h1 style="font-family:Arial Black,Arial,sans-serif;text-transform:uppercase;">GPE Neon Email Previews</h1>
  <p>Replace bracketed placeholders with exact Neon merge tokens before publishing.</p>
  <ul>${links.join("")}</ul>
</body>
</html>`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
