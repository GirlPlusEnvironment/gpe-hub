import {
  type Json,
  resolveMembership,
  safeError,
  sanitizeText
} from "../_shared/neon-membership.ts";
import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const MAX_BODY_BYTES = 20_000;
async function readBody(req: Request): Promise<Json> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) throw new Error("Content-Type must be application/json.");
  const body = await req.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  return JSON.parse(body);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  assertAllowedOrigin(origin);
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

  try {
    const body = await readBody(req);
    const result = await resolveMembership({
      email: sanitizeText(body.email, 320),
      firstName: sanitizeText(body.firstName, 120),
      lastName: sanitizeText(body.lastName, 120)
    });

    return jsonResponse({
      matched: result.matched,
      isActiveMember: result.isActiveMember,
      membershipStatus: result.membershipStatus,
      membershipLevel: result.membershipLevel,
      hubAccess: result.hubAccess,
      hubUserLinked: result.hubUserLinked,
      publicState: result.publicState,
      outcome: result.outcome,
      requiresManualReview: result.requiresManualReview,
      neonAccountLinked: Boolean(result.neonAccountId),
      failureReason: result.outcome === "lookup_failed" ? result.reason : undefined
    }, result.outcome === "lookup_failed" ? 502 : 200, origin);
  } catch (error) {
    console.error("neon-membership-check", safeError(error));
    return jsonResponse({ message: "Membership lookup could not be completed.", outcome: "lookup_failed" }, 400, origin);
  }
});
