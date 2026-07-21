import { type Json, neonFetch } from "./neon-membership.ts";
import { sanitizeText } from "./validation.ts";

export async function createActivity(args: {
  neonAccountId: string;
  subject: string;
  type?: string;
  note: Json;
}) {
  const result = await neonFetch("/activities", {
    method: "POST",
    body: JSON.stringify({
      accountId: args.neonAccountId,
      subject: sanitizeText(args.subject, 200),
      type: args.type || "Form Submission",
      status: "Completed",
      priority: "Normal",
      note: JSON.stringify(args.note).slice(0, 20_000),
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10)
    })
  });
  const data = result as Json;
  return String(data.id || data.activityId || "");
}
