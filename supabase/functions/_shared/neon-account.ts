import { type Json, extractAccountId, findNeonAccountsByEmail, neonFetch, resolveAccountMatch } from "./neon-membership.ts";
import { normalizeEmail, sanitizeText } from "./validation.ts";

export async function resolveOrCreateAccount(args: {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  zip?: string;
  allowCreate: boolean;
}) {
  const email = normalizeEmail(args.email);
  const matches = await findNeonAccountsByEmail(email);
  const match = resolveAccountMatch(matches, args.firstName, args.lastName);
  if (match.status === "ambiguous") return { status: "ambiguous" as const, neonAccountId: null };
  if (match.status === "matched") return { status: "matched" as const, neonAccountId: match.neonAccountId || "" };
  if (!args.allowCreate) return { status: "none" as const, neonAccountId: null };

  const payload: Json = {
    individualAccount: {
      primaryContact: {
        firstName: sanitizeText(args.firstName, 120) || "GPE",
        lastName: sanitizeText(args.lastName, 120) || "Supporter",
        email1: email,
        phone1: sanitizeText(args.phone, 80)
      },
      addresses: [{
        city: sanitizeText(args.city, 120),
        stateProvince: sanitizeText(args.state, 20),
        zipCode: sanitizeText(args.zip, 30),
        addressType: "Home"
      }]
    }
  };
  const result = await neonFetch("/accounts", { method: "POST", body: JSON.stringify(payload) });
  return { status: "created" as const, neonAccountId: extractAccountId(result as Json) };
}
