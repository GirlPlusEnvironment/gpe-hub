import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { neonFetch, safeError, supabaseFetch } from "../_shared/neon-membership.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type CheckStatus = "pass" | "warn" | "fail";

type ConfigCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  required: boolean;
  category: "neon" | "membership" | "activities" | "automations" | "hub" | "action_network";
  message: string;
};

function envPresent(name: string) {
  return Boolean(Deno.env.get(name)?.trim());
}

function configCheck(args: {
  key: string;
  label: string;
  present: boolean;
  required: boolean;
  category: ConfigCheck["category"];
  passMessage: string;
  missingMessage: string;
}): ConfigCheck {
  return {
    key: args.key,
    label: args.label,
    status: args.present ? "pass" : args.required ? "fail" : "warn",
    required: args.required,
    category: args.category,
    message: args.present ? args.passMessage : args.missingMessage,
  };
}

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return null;

  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !serviceKey) throw new Error("Supabase Auth verification is not configured.");

  const res = await fetch(`${base}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null) as { id?: string; email?: string } | null;
  if (!user?.id) return null;
  return user;
}

async function isAdmin(userId: string) {
  const res = await supabaseFetch("rpc/is_admin", {
    method: "POST",
    body: JSON.stringify({ check_user_id: userId }),
  });
  if (!res.ok) return false;
  return Boolean(await res.json().catch(() => false));
}

async function neonApiHealth(): Promise<ConfigCheck> {
  if (!envPresent("NEON_ORG_ID") || !envPresent("NEON_API_KEY")) {
    return {
      key: "NEON_API_CONNECTED",
      label: "Neon API connected",
      status: "fail",
      required: true,
      category: "neon",
      message: "Missing NEON_ORG_ID or NEON_API_KEY.",
    };
  }
  try {
    await neonFetch("/accounts/search/searchFields?searchKey=email", { method: "GET" }, "crm_configuration_neon_health");
    return {
      key: "NEON_API_CONNECTED",
      label: "Neon API connected",
      status: "pass",
      required: true,
      category: "neon",
      message: "Neon API accepted the configured credentials.",
    };
  } catch (error) {
    return {
      key: "NEON_API_CONNECTED",
      label: "Neon API connected",
      status: "fail",
      required: true,
      category: "neon",
      message: safeError(error),
    };
  }
}

function buildChecks(apiHealth: ConfigCheck): ConfigCheck[] {
  const activityStatusPresent = envPresent("NEON_ACTIVITY_STATUS_ID") || envPresent("NEON_ACTIVITY_COMPLETED_STATUS_ID");
  const activityOpenPresent = envPresent("NEON_ACTIVITY_OPEN_STATUS_ID") || envPresent("NEON_ACTIVITY_STATUS_ID");
  const actionNetworkPresent = envPresent("ACTION_NETWORK_WEBHOOK_SECRET") || envPresent("GPE_ACTION_NETWORK_WEBHOOK_SECRET");
  const officeHoursPresent = envPresent("NEON_OFFICE_HOURS_FIELD_ID") && envPresent("NEON_OFFICE_HOURS_OPTION_ID");

  return [
    apiHealth,
    configCheck({
      key: "DEFAULT_MEMBERSHIP_LEVEL_ID",
      label: "Membership level",
      present: envPresent("DEFAULT_MEMBERSHIP_LEVEL_ID"),
      required: true,
      category: "membership",
      passMessage: "Membership creation has a configured Neon level.",
      missingMessage: "Missing DEFAULT_MEMBERSHIP_LEVEL_ID. Membership creation is disabled.",
    }),
    configCheck({
      key: "DEFAULT_MEMBERSHIP_TERM_ID",
      label: "Membership term",
      present: envPresent("DEFAULT_MEMBERSHIP_TERM_ID"),
      required: true,
      category: "membership",
      passMessage: "Membership creation has a configured Neon term.",
      missingMessage: "Missing DEFAULT_MEMBERSHIP_TERM_ID. Membership creation is disabled.",
    }),
    configCheck({
      key: "NEON_ACTIVITY_TIMEZONE_ID",
      label: "Activity timezone",
      present: envPresent("NEON_ACTIVITY_TIMEZONE_ID"),
      required: true,
      category: "activities",
      passMessage: "Activity records have a Neon timezone ID.",
      missingMessage: "Missing NEON_ACTIVITY_TIMEZONE_ID. Neon activity writes are disabled.",
    }),
    {
      key: "NEON_ACTIVITY_STATUS_ID",
      label: "Completed activity status",
      status: activityStatusPresent ? "pass" : "fail",
      required: true,
      category: "activities",
      message: activityStatusPresent
        ? "Completed activity records have a configured status ID."
        : "Missing NEON_ACTIVITY_STATUS_ID or NEON_ACTIVITY_COMPLETED_STATUS_ID.",
    },
    {
      key: "NEON_ACTIVITY_OPEN_STATUS_ID",
      label: "Open activity status",
      status: activityOpenPresent ? "pass" : "warn",
      required: false,
      category: "activities",
      message: activityOpenPresent
        ? "Open membership request activity records have a configured status ID."
        : "Missing NEON_ACTIVITY_OPEN_STATUS_ID. The shared activity status can be used, but a specific open status is preferred.",
    },
    {
      key: "NEON_OFFICE_HOURS_FIELD_ID",
      label: "Office Hours automation field",
      status: officeHoursPresent ? "pass" : "fail",
      required: true,
      category: "automations",
      message: officeHoursPresent
        ? "Office Hours custom field and option IDs are configured."
        : "Missing NEON_OFFICE_HOURS_FIELD_ID and/or NEON_OFFICE_HOURS_OPTION_ID. Office Hours automation parity is not certified.",
    },
    configCheck({
      key: "HUB_INVITATION_FUNCTION_URL",
      label: "Hub invite handoff",
      present: envPresent("HUB_INVITATION_FUNCTION_URL"),
      required: true,
      category: "hub",
      passMessage: "Hub invitation handoff URL is configured.",
      missingMessage: "Missing HUB_INVITATION_FUNCTION_URL. Confirmed members cannot be invited automatically.",
    }),
    {
      key: "ACTION_NETWORK_WEBHOOK_SECRET",
      label: "Action Network webhook secret",
      status: actionNetworkPresent ? "pass" : "warn",
      required: false,
      category: "action_network",
      message: actionNetworkPresent
        ? "Action Network webhook verification secret is configured."
        : "Missing Action Network webhook secret. Petition webhook certification is still pending.",
    },
  ];
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  assertAllowedOrigin(origin);
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

  try {
    const user = await authenticatedUser(req);
    if (!user?.id || !(await isAdmin(user.id))) {
      return jsonResponse({ message: "Admin access required." }, 403, origin);
    }

    const checks = buildChecks(await neonApiHealth());
    const failingRequired = checks.filter((check) => check.required && check.status === "fail");
    const warnings = checks.filter((check) => check.status === "warn");

    return jsonResponse({
      ok: failingRequired.length === 0,
      status: failingRequired.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
      membershipCreationEnabled: !failingRequired.some((check) =>
        ["DEFAULT_MEMBERSHIP_LEVEL_ID", "DEFAULT_MEMBERSHIP_TERM_ID"].includes(check.key)
      ),
      activityLoggingEnabled: !failingRequired.some((check) =>
        ["NEON_ACTIVITY_TIMEZONE_ID", "NEON_ACTIVITY_STATUS_ID"].includes(check.key)
      ),
      officeHoursAutomationReady: !failingRequired.some((check) => check.key === "NEON_OFFICE_HOURS_FIELD_ID"),
      checkedAt: new Date().toISOString(),
      checks,
      blockers: failingRequired.map((check) => check.message),
    }, 200, origin);
  } catch (error) {
    console.error("admin-crm-configuration", safeError(error));
    return jsonResponse({ message: "CRM configuration check could not be completed." }, 500, origin);
  }
});
