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
function nowMs() {
  return performance.now();
}

function elapsedSince(start: number) {
  return Math.max(0, Math.round(nowMs() - start));
}

async function readBody(req: Request): Promise<Json> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) throw new Error("Content-Type must be application/json.");
  const body = await req.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  return JSON.parse(body);
}

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      authorization,
    },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null) as Json | null;
  const id = typeof user?.id === "string" ? user.id : null;
  if (!id) return null;
  return {
    id,
    email: typeof user?.email === "string" ? user.email : null,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  assertAllowedOrigin(origin);
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

  const startedAt = nowMs();
  const timings: Record<string, number> = {};
  const traceTimings = new Map<string, number>();
  const mark = (key: string, start: number) => {
    timings[key] = (timings[key] || 0) + elapsedSince(start);
  };
  const traceCollector = (step: string) => {
    const current = nowMs();
    const previous = traceTimings.get("last") || startedAt;
    const delta = Math.max(0, Math.round(current - previous));
    traceTimings.set("last", current);
    const bucket =
      step.startsWith("hub_profile") || step.startsWith("membership_access") || step.startsWith("profile_membership") || step.startsWith("local_membership")
        ? "supabaseLookupMs"
        : step.startsWith("neon_account") || step.startsWith("neon_constituent")
        ? "neonAccountLookupMs"
        : step.startsWith("neon_membership") || step.startsWith("eligibility")
        ? "neonMembershipLookupMs"
        : "resolverOtherMs";
    timings[bucket] = (timings[bucket] || 0) + delta;
  };

  try {
    const validationStarted = nowMs();
    const body = await readBody(req);
    mark("requestValidationMs", validationStarted);
    const authStarted = nowMs();
    const user = await authenticatedUser(req);
    mark("supabaseAuthMs", authStarted);
    const result = await resolveMembership({
      email: sanitizeText(body.email, 320),
      firstName: sanitizeText(body.firstName, 120),
      lastName: sanitizeText(body.lastName, 120),
      authenticatedUserId: user?.id,
      authenticatedEmail: user?.email || undefined,
      traceCollector
    });

    const serializationStarted = nowMs();
    const responseBody = {
      lookupTimings: {
        totalMs: 0,
        requestValidationMs: timings.requestValidationMs || 0,
        supabaseAuthMs: timings.supabaseAuthMs || 0,
        supabaseLookupMs: timings.supabaseLookupMs || 0,
        neonAccountLookupMs: timings.neonAccountLookupMs || 0,
        neonMembershipLookupMs: timings.neonMembershipLookupMs || 0,
        resolverOtherMs: timings.resolverOtherMs || 0,
        responseSerializationMs: 0
      },
      lookupSource: result.lookupSource || "neon_live",
      cacheAgeSeconds: result.cacheAgeSeconds,
      authenticatedUserLinked: Boolean(user?.id),
      matched: result.matched,
      isActiveMember: result.isActiveMember,
      membershipStatus: result.membershipStatus,
      membershipLevel: result.membershipLevel,
      membershipStartAt: result.membershipStartAt,
      membershipEndAt: result.membershipEndAt,
      hubAccess: result.hubAccess,
      hubUserLinked: result.hubUserLinked,
      publicState: result.publicState,
      outcome: result.outcome,
      requiresManualReview: result.requiresManualReview,
      neonAccountLinked: Boolean(result.neonAccountId),
      failureReason: result.outcome === "lookup_failed" ? result.reason : undefined
    };
    responseBody.lookupTimings.responseSerializationMs = elapsedSince(serializationStarted);
    responseBody.lookupTimings.totalMs = elapsedSince(startedAt);
    return jsonResponse({
      ...responseBody
    }, result.outcome === "lookup_failed" ? 502 : 200, origin);
  } catch (error) {
    console.error("neon-membership-check", safeError(error));
    return jsonResponse({
      message: "Membership lookup could not be completed.",
      outcome: "lookup_failed",
      lookupTimings: {
        totalMs: elapsedSince(startedAt),
        requestValidationMs: timings.requestValidationMs || 0,
        supabaseAuthMs: timings.supabaseAuthMs || 0,
        supabaseLookupMs: timings.supabaseLookupMs || 0,
        neonAccountLookupMs: timings.neonAccountLookupMs || 0,
        neonMembershipLookupMs: timings.neonMembershipLookupMs || 0,
        resolverOtherMs: timings.resolverOtherMs || 0,
        responseSerializationMs: 0
      }
    }, 400, origin);
  }
});
