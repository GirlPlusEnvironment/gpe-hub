import { type Json, getEnv, neonFetch } from "./neon-membership.ts";
import { sanitizeText } from "./validation.ts";

type ActivityStatusKind = "completed" | "open";

type IdNamePair = {
  id: string;
  name: string;
  status?: string;
};

let cachedCompletedStatus: IdNamePair | null = null;
let cachedOpenStatus: IdNamePair | null = null;
let cachedTimeZone: IdNamePair | null = null;
let cachedSystemUserId: string | null = null;

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function idNamePair(value: unknown): IdNamePair | null {
  const record = asRecord(value);
  const id = text(record.id || record.value);
  const name = text(record.name || record.displayName || record.label || record.timeZone || record.zoneName || record.description);
  if (!id) return null;
  return { id, name, status: text(record.status) || undefined };
}

function extractPairs(value: unknown): IdNamePair[] {
  if (Array.isArray(value)) return value.map(idNamePair).filter(Boolean) as IdNamePair[];
  const record = asRecord(value);
  const candidates = [
    record.activityStatuses,
    record.systemTimezones,
    record.systemTimeZones,
    record.timezones,
    record.results,
    record.data,
    record.items,
    asRecord(record._embedded).items,
  ];
  for (const candidate of candidates) {
    const rows = extractPairs(candidate);
    if (rows.length > 0) return rows;
  }
  const pair = idNamePair(record);
  return pair ? [pair] : [];
}

function pairFromEnv(idKey: string, nameKey?: string): IdNamePair | null {
  const id = getEnv(idKey, false);
  if (!id) return null;
  return { id, name: nameKey ? getEnv(nameKey, false) : "" };
}

function activeFirst(options: IdNamePair[]) {
  const active = options.filter((option) => !option.status || option.status.toUpperCase() === "ACTIVE");
  return active.length > 0 ? active : options;
}

function pickStatus(options: IdNamePair[], kind: ActivityStatusKind): IdNamePair | null {
  const candidates = activeFirst(options);
  const preferred = kind === "completed"
    ? [/^completed?$/i, /complete|done|closed/i]
    : [/^open$/i, /open|pending|scheduled|not started|in progress/i];
  for (const pattern of preferred) {
    const match = candidates.find((option) => pattern.test(option.name));
    if (match) return match;
  }
  return candidates[0] || null;
}

function pickTimeZone(options: IdNamePair[]): IdNamePair | null {
  const candidates = activeFirst(options);
  const configuredName = getEnv("NEON_ACTIVITY_TIMEZONE_NAME", false)
    || getEnv("GPE_ACTIVITY_TIMEZONE_NAME", false)
    || getEnv("TZ", false);
  const names = [
    configuredName,
    "America/Chicago",
    "US/Central",
    "Central Time",
    "Central",
    "Chicago",
  ].filter(Boolean);
  for (const name of names) {
    const needle = name.toLowerCase();
    const match = candidates.find((option) => option.name.toLowerCase().includes(needle));
    if (match) return match;
  }
  return candidates[0] || null;
}

async function activityStatus(kind: ActivityStatusKind): Promise<IdNamePair> {
  if (kind === "completed" && cachedCompletedStatus) return cachedCompletedStatus;
  if (kind === "open" && cachedOpenStatus) return cachedOpenStatus;

  const explicit = kind === "completed"
    ? pairFromEnv("NEON_ACTIVITY_COMPLETED_STATUS_ID", "NEON_ACTIVITY_COMPLETED_STATUS_NAME")
      || pairFromEnv("NEON_ACTIVITY_STATUS_ID", "NEON_ACTIVITY_STATUS_NAME")
    : pairFromEnv("NEON_ACTIVITY_OPEN_STATUS_ID", "NEON_ACTIVITY_OPEN_STATUS_NAME")
      || pairFromEnv("NEON_ACTIVITY_STATUS_ID", "NEON_ACTIVITY_STATUS_NAME");
  if (explicit) {
    if (kind === "completed") cachedCompletedStatus = explicit;
    else cachedOpenStatus = explicit;
    return explicit;
  }

  const result = await neonFetch("/properties/activityStatuses", { method: "GET" }, "activity_status_lookup");
  const selected = pickStatus(extractPairs(result), kind);
  if (!selected) throw new Error(`Neon did not return an activity status for ${kind} activities.`);
  if (kind === "completed") cachedCompletedStatus = selected;
  else cachedOpenStatus = selected;
  return selected;
}

async function activityTimeZone(): Promise<IdNamePair> {
  if (cachedTimeZone) return cachedTimeZone;
  const explicit = pairFromEnv("NEON_ACTIVITY_TIMEZONE_ID", "NEON_ACTIVITY_TIMEZONE_NAME")
    || pairFromEnv("NEON_SYSTEM_TIMEZONE_ID", "NEON_SYSTEM_TIMEZONE_NAME");
  if (explicit) {
    cachedTimeZone = explicit;
    return explicit;
  }
  const result = await neonFetch("/properties/systemTimezones", { method: "GET" }, "activity_timezone_lookup");
  const selected = pickTimeZone(extractPairs(result));
  if (!selected) throw new Error("Neon did not return an activity timezone.");
  cachedTimeZone = selected;
  return selected;
}

async function currentSystemUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId;
  const explicit = getEnv("NEON_ACTIVITY_SYSTEM_USER_ID", false) || getEnv("NEON_SYSTEM_USER_ID", false);
  if (explicit) {
    cachedSystemUserId = explicit;
    return explicit;
  }
  const result = await neonFetch("/properties/currentSystemUser", { method: "GET" }, "current_system_user_lookup");
  const id = text(asRecord(result).id);
  if (!id) throw new Error("Neon did not return a current system user ID.");
  cachedSystemUserId = id;
  return id;
}

function activityId(result: unknown): string {
  const record = asRecord(result);
  return text(record.id || record.activityId);
}

export async function createActivity(args: {
  neonAccountId: string;
  subject: string;
  type?: string;
  note: Json;
  statusKind?: ActivityStatusKind;
}) {
  const now = new Date().toISOString();
  const status = await activityStatus(args.statusKind || "completed");
  const timeZone = await activityTimeZone();
  const systemUserId = await currentSystemUserId();
  const result = await neonFetch("/activities", {
    method: "POST",
    body: JSON.stringify({
      subject: sanitizeText(args.subject, 200),
      note: JSON.stringify(args.note).slice(0, 20_000),
      activityDates: {
        startDate: now,
        endDate: now,
        timeZone: { id: timeZone.id, name: timeZone.name || undefined }
      },
      clientAccount: [{ accountId: args.neonAccountId }],
      systemUserId: [systemUserId],
      status: { id: status.id, name: status.name || undefined },
      priority: "Normal"
    })
  }, "activity_create");
  const id = activityId(result);
  if (!id) throw new Error("Neon Activity was created but no activity ID was returned.");
  await neonFetch(`/activities/${encodeURIComponent(id)}`, { method: "GET" }, "activity_readback");
  return id;
}
