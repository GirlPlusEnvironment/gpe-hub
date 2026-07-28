import { type Json, getEnv, neonFetch } from "./neon-membership.ts";
import { sanitizeText } from "./validation.ts";

export async function createActivity(args: {
  neonAccountId: string;
  subject: string;
  type?: string;
  note: Json;
}) {
  const now = new Date().toISOString();
  const statusId = getEnv("NEON_ACTIVITY_COMPLETED_STATUS_ID", false) || getEnv("NEON_ACTIVITY_STATUS_ID", false);
  const timeZoneId = getEnv("NEON_ACTIVITY_TIMEZONE_ID", false);
  if (!statusId || !timeZoneId) {
    throw new Error("Neon activity status/timezone IDs are not configured.");
  }
  const result = await neonFetch("/activities", {
    method: "POST",
    body: JSON.stringify({
      subject: sanitizeText(args.subject, 200),
      note: JSON.stringify(args.note).slice(0, 20_000),
      activityDates: {
        startDate: now,
        endDate: now,
        timeZone: { id: timeZoneId }
      },
      clientAccount: [{ accountId: args.neonAccountId }],
      status: { id: statusId },
      priority: "Normal"
    })
  });
  const data = result as Json;
  return String(data.id || data.activityId || "");
}
