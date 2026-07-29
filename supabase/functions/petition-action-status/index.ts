import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { type Json, safeError, supabaseFetch } from "../_shared/neon-membership.ts";
import { normalizeEmail, readJson, sanitizeText, ValidationError } from "../_shared/validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type AwardSummary = {
  rule: string;
  eventType?: string;
  points: number;
  status: string;
  pointEventId?: string;
  pendingAwardId?: string;
  transactionId?: string;
  ledgerId?: string;
};

function safeNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusFromPending(status: string) {
  if (status === "claimed") return "awarded";
  if (status === "pending") return "pending";
  return status || "not_applicable";
}

function eventAward(row: Json): AwardSummary {
  const result = (row.points_result && typeof row.points_result === "object" && !Array.isArray(row.points_result))
    ? row.points_result as Json
    : {};
  return {
    rule: String(row.rule_action_type || result.rule || ""),
    eventType: String(row.event_type || result.eventType || ""),
    points: safeNumber(result.points),
    status: String(result.status || row.points_status || "not_applicable"),
    pointEventId: String(row.id || result.pointEventId || "") || undefined,
    pendingAwardId: String(row.pending_award_id || result.pendingAwardId || "") || undefined,
    transactionId: String(row.point_transaction_id || result.transactionId || "") || undefined,
    ledgerId: String(row.camp_ledger_id || result.ledgerId || "") || undefined
  };
}

function pendingAward(row: Json): AwardSummary {
  return {
    rule: String(row.rule_action_type || ""),
    points: safeNumber(row.points),
    status: statusFromPending(String(row.status || "")),
    pendingAwardId: String(row.id || "") || undefined,
    transactionId: String(row.point_transaction_id || "") || undefined,
    ledgerId: String(row.camp_ledger_id || "") || undefined
  };
}

function summarizeAwards(awards: AwardSummary[]) {
  return awards.reduce((summary, award) => {
    if (award.status === "awarded" || award.status === "claimed") {
      summary.awardedPoints += award.points;
    } else if (award.status === "pending" || award.status === "pending_identity") {
      summary.pendingPoints += award.points;
    }
    return summary;
  }, { awardedPoints: 0, pendingPoints: 0 });
}

async function rows<T = Json>(path: string): Promise<T[]> {
  const res = await supabaseFetch(path);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Supabase query failed.");
  }
  return await res.json();
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    if (origin) assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

    const body = await readJson(req, 20_000) as Json;
    const email = normalizeEmail(body.email);
    const actionSlug = sanitizeText(body.actionSlug || body.action_slug, 240);
    if (!email) throw new ValidationError("Email is required.");
    if (!actionSlug) throw new ValidationError("Petition action is required.");

    const leadRows = await rows<Json>(
      `constituent_leads?select=id&email_normalized=eq.${encodeURIComponent(email)}&limit=1`
    );
    const lead = leadRows[0];
    if (!lead?.id) {
      return jsonResponse({
        ok: true,
        completed: false,
        status: "pending",
        awardedPoints: 0,
        pendingPoints: 0,
        awards: [],
        message: "Petition verification is still pending."
      }, 200, origin);
    }

    const actionRows = await rows<Json>(
      [
        "lead_actions?select=id,action_slug,campaign_slug,points_status,points_result,completed_at,occurred_at,user_id,challenge_id,pipeline_status",
        `lead_id=eq.${encodeURIComponent(String(lead.id))}`,
        "provider=in.(action_network,action_network_dom)",
        "action_type=eq.petition_signature",
        `action_slug=eq.${encodeURIComponent(actionSlug)}`,
        "order=occurred_at.desc",
        "limit=1"
      ].join("&")
    );
    const action = actionRows[0];
    if (!action?.id) {
      return jsonResponse({
        ok: true,
        completed: false,
        status: "pending",
        awardedPoints: 0,
        pendingPoints: 0,
        awards: [],
        message: "Petition verification is still pending."
      }, 200, origin);
    }

    const eventRows = await rows<Json>(
      [
        "gpe_point_events?select=id,event_type,rule_action_type,points_status,points_result,pending_award_id,point_transaction_id,camp_ledger_id,occurred_at",
        `lead_action_id=eq.${encodeURIComponent(String(action.id))}`,
        "order=occurred_at.asc"
      ].join("&")
    );
    let awards = eventRows.map(eventAward).filter((award) => award.rule && award.points > 0);

    if (awards.length === 0) {
      const pendingRows = await rows<Json>(
        [
          "gpe_pending_point_awards?select=id,rule_action_type,points,status,point_transaction_id,camp_ledger_id,occurred_at",
          `lead_action_id=eq.${encodeURIComponent(String(action.id))}`,
          "order=occurred_at.asc"
        ].join("&")
      );
      awards = pendingRows.map(pendingAward).filter((award) => award.rule && award.points > 0);
    }

    const profileRows = action.user_id
      ? await rows<Json>(`profiles?select=id,points&id=eq.${encodeURIComponent(String(action.user_id))}&limit=1`).catch(() => [])
      : [];
    const profile = profileRows[0] || null;
    const totals = summarizeAwards(awards);
    const result = (action.points_result && typeof action.points_result === "object" && !Array.isArray(action.points_result))
      ? action.points_result as Json
      : {};
    const awardedPoints = safeNumber(result.awardedPoints) || totals.awardedPoints;
    const pendingPoints = safeNumber(result.pendingPoints) || totals.pendingPoints;

    return jsonResponse({
      ok: true,
      success: true,
      completed: true,
      status: String(action.points_status || "completed"),
      actionSlug: String(action.action_slug || actionSlug),
      campaign: String(action.campaign_slug || ""),
      challengeMatched: Boolean(action.challenge_id),
      memberLinked: Boolean(action.user_id),
      completedAt: String(action.completed_at || action.occurred_at || new Date().toISOString()),
      awardedPoints,
      pendingPoints,
      leaderboard: profile
        ? {
          profileId: String(profile.id || action.user_id),
          currentPoints: safeNumber(profile.points),
          updated: awardedPoints > 0
        }
        : null,
      diagnostics: {
        petition: "success",
        webhook: "success",
        hubMatch: action.user_id ? "success" : "pending",
        pointEvents: eventRows.length,
        ledgerIds: awards.map((award) => award.ledgerId).filter(Boolean),
        transactionIds: awards.map((award) => award.transactionId).filter(Boolean),
        pendingAwardIds: awards.map((award) => award.pendingAwardId).filter(Boolean)
      },
      awards,
      message: "Submission Complete"
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("petition-action-status", safeError(error));
    return jsonResponse({
      message: error instanceof ValidationError ? error.message : "Petition status could not be checked."
    }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
