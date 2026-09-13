import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { neonFetch, safeError, supabaseFetch } from "../_shared/neon-membership.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function decodeJwtPayload(token: string): Json {
  const [, payload] = token.split(".");
  if (!payload) return {};
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch (_) {
    return {};
  }
}

function bearerToken(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

async function authenticatedUser(req: Request) {
  const token = bearerToken(req);
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (payload.role === "service_role") return { id: "service_role", serviceRole: true };

  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !serviceKey) throw new Error("Supabase Auth verification is not configured.");
  const res = await fetch(`${base}/auth/v1/user`, {
    method: "GET",
    headers: { apikey: serviceKey, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null) as { id?: string } | null;
  return user?.id ? { id: user.id, serviceRole: false } : null;
}

async function isAdmin(userId: string) {
  const res = await supabaseFetch("rpc/is_admin", {
    method: "POST",
    body: JSON.stringify({ check_user_id: userId }),
  });
  if (!res.ok) return false;
  return Boolean(await res.json().catch(() => false));
}

function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact);
  const record = asRecord(value);
  if (!Object.keys(record).length) return value;
  const result: Json = {};
  for (const key of [
    "id",
    "name",
    "displayName",
    "label",
    "status",
    "type",
    "category",
    "dataType",
    "fieldType",
    "fieldName",
    "fieldDisplayName",
    "description",
    "values",
    "options",
    "fieldOptions",
    "customFieldOptions",
  ]) {
    if (record[key] !== undefined) result[key] = compact(record[key]);
  }
  return result;
}

async function optionalNeon(path: string, operation: string) {
  try {
    return { ok: true, data: compact(await neonFetch(path, { method: "GET" }, operation)) };
  } catch (error) {
    return { ok: false, error: safeError(error) };
  }
}

async function customFieldDetail(id: string) {
  return await optionalNeon(`/customFields/${encodeURIComponent(id)}`, `admin_neon_discovery_custom_field_${id}`);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  assertAllowedOrigin(origin);
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

  try {
    const user = await authenticatedUser(req);
    if (!user || (!user.serviceRole && !(await isAdmin(user.id)))) {
      return jsonResponse({ message: "Admin access required." }, 403, origin);
    }

    const [
      activityStatuses,
      systemTimezones,
      currentSystemUser,
      accountCustomFields,
      individualCustomFields,
      membershipCustomFields,
    ] = await Promise.all([
      optionalNeon("/properties/activityStatuses", "admin_neon_discovery_activity_statuses"),
      optionalNeon("/properties/systemTimezones", "admin_neon_discovery_system_timezones"),
      optionalNeon("/properties/currentSystemUser", "admin_neon_discovery_current_system_user"),
      optionalNeon("/customFields?category=Account", "admin_neon_discovery_account_custom_fields"),
      optionalNeon("/customFields?category=Individual", "admin_neon_discovery_individual_custom_fields"),
      optionalNeon("/customFields?category=Membership", "admin_neon_discovery_membership_custom_fields"),
    ]);
    const discoveredFields = [
      ...((Array.isArray(accountCustomFields.data) ? accountCustomFields.data : []) as Json[]),
      ...((Array.isArray(individualCustomFields.data) ? individualCustomFields.data : []) as Json[]),
      ...((Array.isArray(membershipCustomFields.data) ? membershipCustomFields.data : []) as Json[]),
    ];
    const relevantFieldIds = [...new Set(discoveredFields
      .filter((field) => /age|race|ethnic|gender|climate|interest|office|communication|preference|sms|consent|referral|source|affiliation|occupation/i.test(JSON.stringify(field)))
      .map((field) => text(field.id))
      .filter(Boolean))]
      .slice(0, 20);
    const customFieldDetails: Json = {};
    for (const id of relevantFieldIds) {
      await wait(350);
      customFieldDetails[id] = await customFieldDetail(id);
    }

    return jsonResponse({
      checkedAt: new Date().toISOString(),
      activityStatuses,
      systemTimezones,
      currentSystemUser,
      accountCustomFields,
      individualCustomFields,
      membershipCustomFields,
      customFieldDetails,
    }, 200, origin);
  } catch (error) {
    console.error("admin-neon-discovery", safeError(error));
    return jsonResponse({ message: "Neon discovery could not be completed.", error: safeError(error) }, 500, origin);
  }
});
