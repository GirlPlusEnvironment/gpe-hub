import { existsSync, readFileSync } from "node:fs";

for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2").trim();
  }
}

const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

const missing = required.filter((key) => !String(process.env[key] || "").trim());

if (missing.length > 0) {
  console.error(
    [
      "Missing required Vite environment variables:",
      ...missing.map((key) => `- ${key}`),
      "",
      "Set these in .env.local for local builds and in GitHub repository secrets for Pages deploys.",
      "Without them the app boots to a blank page before the login or membership check can run.",
    ].join("\n"),
  );
  process.exit(1);
}

try {
  new URL(process.env.VITE_SUPABASE_URL);
} catch {
  console.error("VITE_SUPABASE_URL must be a valid URL.");
  process.exit(1);
}
