import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { cacheEvents, fetchNeonEvents, loadCachedEvents, logEventSync, type PublicEvent } from "../_shared/neon-events.ts";
import { safeError } from "../_shared/neon-membership.ts";
import { readJson, sanitizeText, ValidationError } from "../_shared/validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

function filterEvents(events: PublicEvent[], body: Record<string, unknown>) {
  const mode = sanitizeText(body.mode || "upcoming", 40);
  const type = sanitizeText(body.type || "all", 80).toLowerCase();
  const search = sanitizeText(body.search || "", 120).toLowerCase();
  const now = Date.now();

  return events.filter((event) => {
    const startsAt = event.starts_at ? Date.parse(event.starts_at) : null;
    const isPast = startsAt ? startsAt < now : false;
    if (mode === "upcoming" && isPast) return false;
    if (mode === "past" && !isPast) return false;
    if (type !== "all" && String(event.event_type || "").toLowerCase() !== type) return false;
    if (search) {
      const haystack = [event.title, event.summary, event.description, event.location_name, event.tags?.join(" ")]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

    const body = await readJson(req, 12_000);
    const started = Date.now();
    let syncStatus = "cache";
    if ((Deno.env.get("NEON_EVENTS_DISABLE_LIVE_SYNC") || "").toLowerCase() !== "true") {
      try {
        const neonEvents = await fetchNeonEvents();
        await cacheEvents(neonEvents);
        await logEventSync({
          integration: "neon",
          operation: "events_list",
          success: true,
          responseSummary: `${neonEvents.length} events synced`,
          durationMs: Date.now() - started
        });
        syncStatus = "synced";
      } catch (error) {
        await logEventSync({
          integration: "neon",
          operation: "events_list",
          success: false,
          errorSummary: safeError(error),
          durationMs: Date.now() - started
        });
        syncStatus = "cache_fallback";
      }
    }

    const cached = await loadCachedEvents();
    const events = filterEvents(cached, body);
    const eventTypes = Array.from(new Set(cached.map((event) => event.event_type).filter(Boolean))).sort();
    return jsonResponse({ ok: true, syncStatus, events, eventTypes }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("neon-events-public", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Events could not be loaded." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
