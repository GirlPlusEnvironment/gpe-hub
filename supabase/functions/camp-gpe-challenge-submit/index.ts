import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, logSync, publicConfig, updateFormSubmission } from "../_shared/form-submission.ts";
import { createActivity } from "../_shared/neon-activity.ts";
import { resolveMembership, safeError, supabaseFetch } from "../_shared/neon-membership.ts";
import { readJson, sanitizeText, validateFields, validateIdempotencyKey, ValidationError } from "../_shared/validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const FORM_KEY = "camp_gpe_challenge";
const CHALLENGE_FIELDS = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email", required: true, type: "email" as const },
  { key: "challengeIds", label: "Completed Camp challenges", type: "checkbox" as const },
  {
    key: "actions",
    label: "Which actions did you take?",
    type: "checkbox" as const,
    allowed: ["petition", "share_petition", "feed_post", "shared_friend", "other"]
  },
  { key: "otherAction", label: "Other action" },
  { key: "screenshotLinks", label: "Upload screenshot(s)", type: "textarea" as const },
  { key: "instagram", label: "Instagram Handle" },
  { key: "linkedin", label: "LinkedIn URL" },
  { key: "tiktok", label: "TikTok Handle" },
  { key: "socialLinks", label: "Share Links to Social Media Posts", type: "textarea" as const },
  { key: "notes", label: "Notes", type: "textarea" as const }
];

type AuthUser = {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
};

function unauthorized(origin: string | null, message = "Sign in to the GPE Hub before submitting a Camp challenge."): Response {
  return jsonResponse({ ok: false, message }, 401, origin);
}

async function requireAuthenticatedUser(req: Request, origin: string | null): Promise<AuthUser> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) throw unauthorized(origin);

  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !serviceKey) throw new Error("Supabase Auth verification is not configured.");

  const res = await fetch(`${base}/auth/v1/user`, {
    method: "GET",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${token}`
    }
  });
  if (!res.ok) throw unauthorized(origin);
  const user = await res.json().catch(() => null) as AuthUser | null;
  if (!user?.id || !user.email) throw unauthorized(origin);
  return { ...user, email: user.email.toLowerCase() };
}

async function activeSeason() {
  const slug = Deno.env.get("ACTIVE_CAMP_SEASON_SLUG") || "camp-gpe-2026";
  const res = await supabaseFetch(`gpe_seasons?select=id,slug,name&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  if (!res.ok) throw new Error("Could not load active Camp GPE season.");
  const rows = await res.json();
  if (!rows[0]) throw new Error("Active Camp GPE season is not configured.");
  return rows[0] as { id: string; slug: string; name: string };
}

async function profileByUserId(userId: string) {
  const res = await supabaseFetch(`profiles?select=id,email,first_name,last_name,neon_account_id,member_status&id=eq.${encodeURIComponent(userId)}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] as { id: string; email: string | null; first_name: string | null; last_name: string | null; neon_account_id: string | null; member_status: string | null } | undefined || null;
}

async function seasonMember(seasonId: string, userId: string, email: string, neonAccountId: string | null) {
  const byUser = await supabaseFetch(`gpe_season_members?select=*&season_id=eq.${seasonId}&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  if (byUser.ok) {
    const rows = await byUser.json();
    if (rows[0]) return rows[0] as { id: string; user_id: string | null };
  }

  const lookup = await supabaseFetch(`gpe_season_members?select=*&season_id=eq.${seasonId}&contact_email=eq.${encodeURIComponent(email)}&limit=1`);
  if (lookup.ok) {
    const rows = await lookup.json();
    if (rows[0]) {
      if (rows[0].user_id && rows[0].user_id !== userId) {
        throw new ValidationError("This Camp registration is linked to a different Hub account. Contact Team GPE for help.");
      }
      const update = await supabaseFetch(`gpe_season_members?id=eq.${encodeURIComponent(rows[0].id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          user_id: userId,
          neon_account_id: neonAccountId || rows[0].neon_account_id || null,
          status: rows[0].status || "registered"
        })
      });
      if (!update.ok) throw new Error("Could not link Camp GPE season member.");
      const updatedRows = await update.json();
      return updatedRows[0] as { id: string; user_id: string | null };
    }
  }
  const insert = await supabaseFetch("gpe_season_members?on_conflict=season_id,contact_email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      season_id: seasonId,
      user_id: userId,
      neon_account_id: neonAccountId,
      contact_email: email,
      status: "registered"
    })
  });
  if (!insert.ok) throw new Error("Could not link Camp GPE season member.");
  const rows = await insert.json();
  return rows[0] as { id: string; user_id: string | null };
}

function proofLinks(fields: Record<string, unknown>) {
  return [fields.screenshotLinks, fields.socialLinks]
    .flatMap((value) => String(value || "").split(/\s+/))
    .map((value) => value.trim())
    .filter((value) => /^https?:\/\//i.test(value));
}

type ChallengeRow = {
  id: string;
  season_id: string;
  action_type_id: string | null;
  slug: string;
  title: string;
  point_value: number | null;
  requires_proof: boolean;
  requires_review: boolean;
  auto_approve: boolean;
  allow_multiple_submissions: boolean;
  max_completions_per_member: number;
};

async function loadChallenges(seasonId: string, challengeIds: string[]) {
  const cleanIds = challengeIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (cleanIds.length === 0) return [] as ChallengeRow[];
  const res = await supabaseFetch([
    "gpe_challenges",
    "?select=id,season_id,action_type_id,slug,title,point_value,requires_proof,requires_review,auto_approve,allow_multiple_submissions,max_completions_per_member",
    `&season_id=eq.${encodeURIComponent(seasonId)}`,
    `&id=in.(${cleanIds.map(encodeURIComponent).join(",")})`,
    "&is_active=eq.true"
  ].join(""));
  if (!res.ok) throw new Error("Could not load selected Camp GPE challenges.");
  return await res.json() as ChallengeRow[];
}

async function completionCount(params: { seasonMemberId: string; challengeId: string }) {
  const res = await supabaseFetch([
    "gpe_camp_points_ledger",
    "?select=id,gpe_camp_submission_actions!inner(challenge_id)",
    `&season_member_id=eq.${encodeURIComponent(params.seasonMemberId)}`,
    "&entry_type=eq.challenge_award",
    "&reversed_entry_id=is.null",
    "&reversed_at=is.null",
    `&gpe_camp_submission_actions.challenge_id=eq.${encodeURIComponent(params.challengeId)}`
  ].join(""));
  if (!res.ok) return 0;
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

async function createReviewSubmission(params: {
  formSubmissionId: string;
  seasonId: string;
  seasonMemberId: string;
  userId: string | null;
  neonAccountId: string | null;
  email: string;
  fields: Record<string, unknown>;
}) {
  const res = await supabaseFetch("gpe_camp_challenge_submissions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      form_submission_id: params.formSubmissionId,
      season_id: params.seasonId,
      season_member_id: params.seasonMemberId,
      user_id: params.userId,
      neon_account_id: params.neonAccountId,
      contact_email: params.email,
      challenge_key: "multi_action",
      submitted_payload: { fields: params.fields },
      proof_links: proofLinks(params.fields),
      review_status: "pending"
    })
  });
  if (!res.ok) throw new Error("Could not save Camp GPE challenge for review.");
  const rows = await res.json();
  return rows[0] || null;
}

async function createSubmissionAction(params: {
  submissionId: string;
  challenge: ChallengeRow | null;
  otherDescription?: string;
  proofUrls: string[];
  status: "pending" | "duplicate";
}) {
  const requestedPoints = params.challenge?.point_value ?? null;
  const res = await supabaseFetch("gpe_camp_submission_actions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      submission_id: params.submissionId,
      challenge_id: params.challenge?.id || null,
      action_type_id: params.challenge?.action_type_id || null,
      other_description: params.otherDescription || null,
      proof_urls: params.proofUrls,
      requested_points: requestedPoints,
      review_status: params.status
    })
  });
  if (!res.ok) throw new Error("Could not save Camp GPE submission action.");
  const rows = await res.json();
  return rows[0] as { id: string; review_status: string; requested_points: number | null };
}

async function autoApproveAction(actionId: string) {
  const res = await supabaseFetch("rpc/auto_approve_camp_submission_action", {
    method: "POST",
    body: JSON.stringify({ p_action_id: actionId })
  });
  if (!res.ok) throw new Error("Automatic point award failed.");
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

function preferredName(fields: Record<string, unknown>, profile: Awaited<ReturnType<typeof profileByUserId>>, authUser: AuthUser, key: "firstName" | "lastName") {
  const fieldValue = sanitizeText(fields[key], 120);
  if (fieldValue) return fieldValue;
  const profileKey = key === "firstName" ? "first_name" : "last_name";
  const profileValue = sanitizeText(profile?.[profileKey], 120);
  if (profileValue) return profileValue;
  const metaKey = key === "firstName" ? "first_name" : "last_name";
  return sanitizeText(authUser.user_metadata?.[metaKey], 120);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);
    const authUser = await requireAuthenticatedUser(req, origin);

    const body = await readJson(req);
    const idempotencyKey = validateIdempotencyKey(req.headers.get("idempotency-key") || body.idempotencyKey);
    const fields = validateFields((body.fields || {}) as Record<string, unknown>, CHALLENGE_FIELDS);
    const submittedEmail = String(fields.email).toLowerCase();
    const email = authUser.email;
    if (submittedEmail && submittedEmail !== email) {
      throw new ValidationError("Sign in with the same email used on the challenge form.");
    }
    const selectedChallengeIds = Array.isArray(fields.challengeIds) ? fields.challengeIds.map(String) : [];
    const wantsOther = Array.isArray(fields.actions) && fields.actions.includes("other");
    const otherDescription = String(fields.otherAction || "").trim();
    if (wantsOther && !otherDescription) throw new ValidationError("Please describe your other action.");
    if (selectedChallengeIds.length === 0 && !wantsOther) throw new ValidationError("Select at least one challenge or describe an other action.");

    const { submission, duplicate } = await createFormSubmission({
      idempotencyKey,
      formKey: FORM_KEY,
      email,
      payload: { fields },
      membershipRequest: null,
      honeypot: sanitizeText(body.website, 250)
    });
    if (duplicate) return jsonResponse({ duplicate: true, submissionId: submission.id, ...publicConfig() }, 200, origin);

    const profile = await profileByUserId(authUser.id);
    const firstName = preferredName(fields, profile, authUser, "firstName");
    const lastName = preferredName(fields, profile, authUser, "lastName");
    const membership = await resolveMembership({
      email,
      firstName,
      lastName,
      neonAccountId: profile?.neon_account_id || undefined
    });
    if (membership.outcome === "ambiguous_account" || membership.requiresManualReview) {
      await updateFormSubmission(String(submission.id), { submission_status: "requires_manual_review", membership_outcome: "ambiguous_account" });
      return jsonResponse({ ok: false, submissionId: submission.id, membershipOutcome: "ambiguous_account", message: "Team GPE needs to review your membership connection before this challenge can affect points.", ...publicConfig() }, 409, origin);
    }
    if (!membership.isActiveMember || !membership.neonAccountId) {
      await updateFormSubmission(String(submission.id), { submission_status: "rejected", membership_outcome: membership.outcome });
      return jsonResponse({ ok: false, submissionId: submission.id, membershipOutcome: membership.outcome, message: "An active GPE membership connected to your Hub account is required before submitting a Camp challenge.", ...publicConfig() }, 403, origin);
    }

    await createActivity({
      neonAccountId: membership.neonAccountId,
      subject: "Camp GPE Challenge Submission",
      type: "Camp GPE",
      note: { formKey: FORM_KEY, fields }
    });
    await logSync({ submissionId: String(submission.id), integration: "neon", operation: "camp_gpe_challenge_activity", success: true });

    const season = await activeSeason();
    const member = await seasonMember(season.id, authUser.id, email, membership.neonAccountId);
    const challenges = await loadChallenges(season.id, selectedChallengeIds);
    if (challenges.length !== selectedChallengeIds.length) throw new ValidationError("One or more selected challenges are unavailable.");
    const submittedProofLinks = proofLinks(fields);
    const missingProof = challenges.find((challenge) => challenge.requires_proof && submittedProofLinks.length === 0);
    if (missingProof) throw new ValidationError(`Proof is required for ${missingProof.title}.`);

    const reviewSubmission = await createReviewSubmission({
      formSubmissionId: String(submission.id),
      seasonId: season.id,
      seasonMemberId: member.id,
      userId: member.user_id,
      neonAccountId: membership.neonAccountId,
      email,
      fields
    });
    const actionResults: Array<{ id: string; status: string; points?: number }> = [];
    let awardedPoints = 0;
    let approvedActions = 0;
    let pendingActions = 0;

    for (const challenge of challenges) {
      const completed = await completionCount({ seasonMemberId: member.id, challengeId: challenge.id });
      const limitReached = completed >= challenge.max_completions_per_member || (!challenge.allow_multiple_submissions && completed > 0);
      const action = await createSubmissionAction({
        submissionId: reviewSubmission.id,
        challenge,
        proofUrls: submittedProofLinks,
        status: limitReached ? "duplicate" : "pending"
      });
      if (limitReached) {
        actionResults.push({ id: action.id, status: "duplicate" });
        continue;
      }
      if (challenge.auto_approve && !challenge.requires_review && !challenge.requires_proof && challenge.point_value !== null) {
        try {
          await autoApproveAction(action.id);
          awardedPoints += challenge.point_value;
          approvedActions += 1;
          actionResults.push({ id: action.id, status: "approved", points: challenge.point_value });
        } catch (error) {
          pendingActions += 1;
          await logSync({ submissionId: String(submission.id), integration: "camp", operation: "auto_approve", success: false, errorSummary: safeError(error) });
          actionResults.push({ id: action.id, status: "pending" });
        }
      } else {
        pendingActions += 1;
        actionResults.push({ id: action.id, status: "pending" });
      }
    }

    if (wantsOther) {
      const action = await createSubmissionAction({
        submissionId: reviewSubmission.id,
        challenge: null,
        otherDescription,
        proofUrls: submittedProofLinks,
        status: "pending"
      });
      pendingActions += 1;
      actionResults.push({ id: action.id, status: "pending" });
    }

    await updateFormSubmission(String(submission.id), {
      submission_status: pendingActions > 0 && approvedActions > 0 ? "partial_failure" : "completed",
      neon_sync_status: "succeeded",
      neon_account_id: membership.neonAccountId,
      membership_outcome: membership.outcome
    });
    return jsonResponse({
      ok: true,
      submissionId: submission.id,
      reviewSubmissionId: reviewSubmission?.id,
      status: approvedActions > 0 && pendingActions > 0 ? "partial" : approvedActions > 0 ? "approved" : "pending",
      awardedPoints,
      pendingActions,
      approvedActions,
      actions: actionResults,
      memberLinked: Boolean(member.id),
      membershipOutcome: membership.outcome,
      partialSuccess: pendingActions > 0 && approvedActions > 0,
      leaderboardUrl: "https://members.girlplusenvironment.org/leaderboard",
      message: approvedActions > 0 && pendingActions > 0
        ? `You earned ${awardedPoints} points, and ${pendingActions} action${pendingActions === 1 ? " is" : "s are"} still under review.`
        : approvedActions > 0
          ? `Challenge approved! You earned ${awardedPoints} points.`
          : "Your challenge was submitted for Team GPE review.",
      ...publicConfig()
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("camp-gpe-challenge-submit", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Camp GPE challenge submission could not be completed." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
