declare const Deno: { env: { get(name: string): string | undefined } };

const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.girlplusenvironment.org",
  "https://girlplusenvironment.org",
  "https://www-girlplusenvironment-org.filesusr.com"
];

export function allowedOrigins() {
  const configured = (Deno.env.get("ALLOWED_FORM_ORIGINS") || Deno.env.get("ALLOWED_HUB_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return Array.from(new Set([...configured, ...DEFAULT_ALLOWED_ORIGINS]));
}

export function corsHeaders(origin: string | null): HeadersInit {
  const allowed = allowedOrigins();
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0] || "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key, Authorization",
    "Vary": "Origin"
  };
}

export function assertAllowedOrigin(origin: string | null) {
  const allowed = allowedOrigins();
  if (origin && !allowed.includes(origin)) {
    throw new Response(JSON.stringify({ message: "Origin is not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
    });
  }
}

export function jsonResponse(body: Record<string, unknown>, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
  });
}
