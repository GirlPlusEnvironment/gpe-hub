import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { safeError, supabaseFetch } from "../_shared/neon-membership.ts";
import { readJson, sanitizeText, ValidationError } from "../_shared/validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

async function activeSeasonSlug(body: Record<string, unknown>) {
  const configured = sanitizeText(
    body.seasonSlug || Deno.env.get("ACTIVE_SEASON_SLUG") || Deno.env.get("ACTIVE_CAMP_SEASON_SLUG") || "",
    120
  );
  if (configured) return configured;

  const res = await supabaseFetch("gpe_seasons?select=slug&status=eq.active&is_visible=eq.true&order=starts_at.desc&limit=1");
  if (!res.ok) throw new Error("Could not load active seasonal challenge.");
  const rows = await res.json();
  if (!rows[0]?.slug) throw new ValidationError("No active seasonal challenge is configured.");
  return String(rows[0].slug);
}

function canonicalCampActionUrl(url: unknown) {
  const value = String(url || "");
  if (!value) return null;
  if (/actionnetwork\.org\/letters\/tell-congress-we-need-relief-from-high-energy-bills-partner/i.test(value)) {
    return "https://www.girlplusenvironment.org/high-energy-bills-action";
  }
  if (/actionnetwork\.org\/petitions\/stop-trumps-700-million-coal-slush-fund-partner/i.test(value)) {
    return "https://www.girlplusenvironment.org/coal-slush-fund-action";
  }
  if (/actionnetwork\.org\/letters\/extreme-weather-puts-our-communities-at-risk-its-time-for-bold-climate-action-2/i.test(value)) {
    return "https://www.girlplusenvironment.org/extreme-weather-action";
  }
  return value;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

    const body = await readJson(req, 10_000);
    const seasonSlug = await activeSeasonSlug(body);
    const path = [
      "gpe_public_camp_challenges",
      "?select=id,season_id,season_slug,slug,title,short_description,instructions,category,point_value,starts_at,ends_at,requires_proof,allow_multiple_submissions,max_completions_per_member,display_order,action_url,action_type_slug,action_type_label",
      `&season_slug=eq.${encodeURIComponent(seasonSlug)}`,
      "&order=display_order.asc,title.asc"
    ].join("");
    const res = await supabaseFetch(path);
    if (!res.ok) throw new Error("Could not load seasonal challenges.");
    const rows = await res.json();
    const challenges = Array.isArray(rows)
      ? rows.map((challenge) => ({
          ...challenge,
          action_url: canonicalCampActionUrl(challenge.action_url),
        }))
      : [];
    return jsonResponse({ ok: true, seasonSlug, challenges }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("camp-gpe-challenges", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Seasonal challenges could not be loaded." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
