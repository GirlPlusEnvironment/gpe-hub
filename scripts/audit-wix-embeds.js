#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const gpeRoot = join(repoRoot, "..");
const extensions = new Set([".html", ".js", ".ts", ".tsx", ".jsx", ".css", ".json", ".md", ".sql", ".toml", ".yml", ".yaml"]);
const ignoredDirs = new Set(["node_modules", "dist", ".git", ".DS_Store"]);

function extname(file) {
  const match = file.match(/(\.[^.]+)$/);
  return match ? match[1] : "";
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) yield* walk(path);
    else if (extensions.has(extname(path))) yield path;
  }
}

const badBytes = [
  "\u00e2\u20ac\u201d",
  "\u00e2\u20ac\u201c",
  "\u00e2\u20ac\u2122",
  "\u00e2\u20ac\u0153",
  "\u00e2\u20ac",
  "\u00e2\u20ac\u00a6",
  "\u00c2",
  "\u00c3",
  "\u00f0\u0178",
  "\u00e2\u0153",
  "\ufffd",
];

const checks = [
  ...badBytes.map((value) => ({ name: "mojibake", needle: value, blocking: true })),
  { name: "hash-only link", needle: "href=" + "\"#\"", blocking: true },
  { name: "prototype page switcher", needle: "show" + "Page(", blocking: true },
  { name: "wix component id", needle: "com" + "p-", blocking: true },
  { name: "wix generated gallery", needle: "Pro" + "Gallery", blocking: true },
  { name: "temporary instagram cdn", needle: "cdn" + "instagram.com", blocking: true },
  { name: "visible todo", needle: "TO" + "DO", blocking: false },
  { name: "visible placeholder", needle: "PLACE" + "HOLDER", blocking: false },
  { name: "service role in frontend", needle: "SUPABASE_" + "SERVICE_ROLE_KEY", blocking: true },
  { name: "secret marker", needle: "service_" + "role", blocking: true },
  { name: "neon credential marker", needle: "NEON_" + "API_KEY", blocking: true },
];

const embedHtml = /gpe-mirror\/(?!old-).*\.html$/;
const findings = [];

function isDocumentedPatternReference(rel, line) {
  if (rel !== "gpe-hub/docs/gpe-website-production-readiness-audit.md") return false;
  return (
    line.includes("Production target scan") ||
    line.includes("verified clean") ||
    line.includes("no matches") ||
    line.includes("No scraped Instagram")
  );
}

for (const file of walk(gpeRoot)) {
  const rel = relative(gpeRoot, file);
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const isReferenceForm = /gpe-mirror\/(?:.*-form|neon-form-survey)\.html$/.test(rel);
  const isEmbed = embedHtml.test(rel) && !isReferenceForm;
  const isRawWixExport = extname(file) === ".html" && /wix-viewer-model|wix-warmup-data|SITE_CONTAINER|thunderbolt/i.test(text);
  if (isRawWixExport) {
    findings.push({
      name: "raw wix export",
      blocking: false,
      file: rel,
      line: 1,
      text: "Contains Wix runtime export markup; do not treat as a cleaned standalone embed without extraction.",
    });
    continue;
  }
  for (const check of checks) {
    lines.forEach((line, index) => {
      if (line.includes(check.needle)) {
        if (isDocumentedPatternReference(rel, line)) return;
        if (check.name.includes("service role") && !/gpe-mirror|src\//.test(rel)) return;
        if (check.name.includes("neon credential") && !/gpe-mirror|src\//.test(rel)) return;
        findings.push({ ...check, file: rel, line: index + 1, text: line.trim().slice(0, 220) });
      }
    });
  }
  if (isEmbed) {
    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      if ((lower.includes("<nav") || lower.includes("<footer")) && !/creator-contract|contract|camp-gpe-toolkit/.test(rel)) {
        findings.push({ name: "possible embedded global shell", blocking: true, file: rel, line: index + 1, text: line.trim().slice(0, 220) });
      }
    });
  }
}

for (const finding of findings) {
  console.log(`${finding.blocking ? "BLOCK" : "WARN"} ${finding.name}: ${finding.file}:${finding.line}: ${finding.text}`);
}

if (findings.some((finding) => finding.blocking)) {
  process.exitCode = 1;
}
