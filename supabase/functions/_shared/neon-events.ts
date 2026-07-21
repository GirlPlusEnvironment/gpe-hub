import { type Json, getEnv, neonFetch, safeError, supabaseFetch } from "./neon-membership.ts";
import { sanitizeText } from "./validation.ts";

declare const Deno: { env: { get(name: string): string | undefined } };

export type PublicEvent = {
  id?: string;
  neon_event_id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  event_type: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  location_name: string | null;
  location_address: string | null;
  is_virtual: boolean;
  virtual_url: string | null;
  image_url: string | null;
  capacity: number | null;
  registration_count: number | null;
  registration_status: string | null;
  pricing_summary: string | null;
  member_pricing_summary: string | null;
  public_url: string | null;
  neon_calendar_url: string | null;
  neon_registration_url: string | null;
  constituent_portal_url: string | null;
  impact_points: number | null;
  points_requires_attendance: boolean;
  points_auto_award: boolean;
  tags: string[];
  last_synced_at?: string | null;
};

function rows(result: unknown): Json[] {
  const data = result as Json;
  const candidates = [data.events, data.searchResults, data.results, data.data, data.items, data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Json[];
  }
  return [];
}

function value(...items: unknown[]): string {
  for (const item of items) {
    const text = sanitizeText(item, 1000);
    if (text) return text;
  }
  return "";
}

function toNumber(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(event: Json, key: string): string | null {
  const dates = (event.eventDates || event.dates || event.date || {}) as Json;
  const direct = value(event[key], event[`${key}DateTime`]);
  const nested = value(dates[key], dates[`${key}DateTime`]);
  return direct || nested || null;
}

function slugify(input: string, fallback: string) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return slug || `event-${fallback}`;
}

function configuredUrl(templateName: string, eventId: string, slug: string) {
  const template = Deno.env.get(templateName);
  if (!template) return null;
  return template.replaceAll("{eventId}", encodeURIComponent(eventId)).replaceAll("{slug}", encodeURIComponent(slug));
}

export function normalizeNeonEvent(event: Json): PublicEvent | null {
  const id = value(event.id, event.eventId, event["Event ID"]);
  const title = value(event.name, event.eventName, event.title, event["Event Name"]);
  if (!id || !title) return null;

  const location = (event.location || event.eventLocation || {}) as Json;
  const slug = slugify(value(event.slug, event.uri, title), id);
  const isVirtual = Boolean(event.isVirtual || event.onlineEvent || value(event.eventAttendanceMode).toLowerCase().includes("online"));
  const tags = [event.category, event.categoryName, event.topic, event.topicName, event.eventType]
    .map((item) => sanitizeText(item, 80))
    .filter(Boolean);

  return {
    neon_event_id: id,
    slug,
    title,
    summary: value(event.summary, event.shortDescription, event.descriptionPreview) || null,
    description: value(event.description, event.eventDescription) || null,
    event_type: value(event.eventType, event.categoryName, event.category, event.topicName) || null,
    starts_at: dateValue(event, "start") || value(event.startDate, event.eventStartDate) || null,
    ends_at: dateValue(event, "end") || value(event.endDate, event.eventEndDate) || null,
    timezone: value(event.timezone, event.timeZone, event.eventTimezone) || null,
    location_name: value(location.name, event.locationName, event.venueName) || null,
    location_address: value(location.address, event.locationAddress, event.address) || null,
    is_virtual: isVirtual,
    virtual_url: value(event.virtualUrl, event.webinarUrl, event.onlineEventUrl) || null,
    image_url: value(event.imageUrl, event.eventImageUrl, event.thumbnailUrl) || null,
    capacity: toNumber(event.capacity || event.maxAttendees),
    registration_count: toNumber(event.registrationCount || event.attendeeCount),
    registration_status: value(event.registrationStatus, event.status) || null,
    pricing_summary: value(event.pricingSummary, event.fee, event.registrationFee) || null,
    member_pricing_summary: value(event.memberPricingSummary, event.memberFee) || null,
    public_url: configuredUrl("GPE_EVENT_PAGE_URL_TEMPLATE", id, slug),
    neon_calendar_url: configuredUrl("NEON_EVENT_CALENDAR_URL_TEMPLATE", id, slug) || getEnv("NEON_EVENT_CALENDAR_URL", false) || null,
    neon_registration_url: configuredUrl("NEON_EVENT_REGISTRATION_URL_TEMPLATE", id, slug),
    constituent_portal_url: getEnv("NEON_CONSTITUENT_PORTAL_URL", false) || null,
    impact_points: toNumber(Deno.env.get("DEFAULT_EVENT_IMPACT_POINTS")),
    points_requires_attendance: (Deno.env.get("EVENT_POINTS_REQUIRE_ATTENDANCE") || "true").toLowerCase() !== "false",
    points_auto_award: (Deno.env.get("EVENT_POINTS_AUTO_AWARD") || "false").toLowerCase() === "true",
    tags: Array.from(new Set(tags))
  };
}

export async function fetchNeonEvents(): Promise<PublicEvent[]> {
  const path = Deno.env.get("NEON_EVENTS_LIST_PATH") || "/events";
  const result = await neonFetch(path, { method: "GET" });
  return rows(result).map(normalizeNeonEvent).filter(Boolean) as PublicEvent[];
}

export async function cacheEvents(events: PublicEvent[]) {
  if (events.length === 0) return [];
  const now = new Date().toISOString();
  const rowsToSave = events.map((event) => ({
    ...event,
    sync_status: "synced",
    last_synced_at: now,
    raw_neon_payload: { syncedFrom: "neon_api_v2", neonEventId: event.neon_event_id }
  }));
  const res = await supabaseFetch("gpe_event_cache?on_conflict=neon_event_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rowsToSave)
  });
  if (!res.ok) throw new Error("Could not cache Neon events.");
  return await res.json();
}

export async function loadCachedEvents() {
  const res = await supabaseFetch([
    "gpe_public_events",
    "?select=*",
    "&order=starts_at.asc.nullslast,title.asc"
  ].join(""));
  if (!res.ok) throw new Error("Could not load cached events.");
  return await res.json() as PublicEvent[];
}

export async function logEventSync(args: {
  eventId?: string | null;
  registrationIntentId?: string | null;
  integration: string;
  operation: string;
  success: boolean;
  statusCode?: number;
  responseSummary?: string;
  errorSummary?: string;
  durationMs?: number;
}) {
  await supabaseFetch("gpe_event_sync_logs", {
    method: "POST",
    body: JSON.stringify({
      event_id: args.eventId || null,
      registration_intent_id: args.registrationIntentId || null,
      integration: args.integration,
      operation: args.operation,
      success: args.success,
      status_code: args.statusCode || null,
      response_summary: args.responseSummary ? sanitizeText(args.responseSummary, 500) : null,
      error_summary: args.errorSummary ? sanitizeText(args.errorSummary, 500) : null,
      duration_ms: args.durationMs || null
    })
  }).catch((error) => console.error("gpe-event-sync-log", safeError(error)));
}
