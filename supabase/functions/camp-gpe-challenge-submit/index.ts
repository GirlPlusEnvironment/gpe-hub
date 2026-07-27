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
  { key: "challengeIds", label: "Completed seasonal challenges", type: "checkbox" as const },
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

function unauthorized(origin: string | null, message = "Sign in to the GPE Hub before submitting a seasonal challenge."): Response {
  return jsonResponse({ ok: false, message }, 401, origin);
}

async function authenticatedUser(req: Request, origin: string | null): Promise<AuthUser | null> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return null;

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
  const slug = Deno.env.get("ACTIVE_SEASON_SLUG") || Deno.env.get("ACTIVE_CAMP_SEASON_SLUG") || "";
  const path = slug
    ? `gpe_seasons?select=id,slug,name&slug=eq.${encodeURIComponent(slug)}&limit=1`
    : "gpe_seasons?select=id,slug,name&status=eq.active&is_visible=eq.true&order=starts_at.desc&limit=1";
  const res = await supabaseFetch(path);
  if (!res.ok) throw new Error("Could not load active seasonal challenge.");
  const rows = await res.json();
  if (!rows[0]) throw new Error("No active seasonal challenge is configured.");
  return rows[0] as { id: string; slug: string; name: string };
}

async function profileByUserId(userId: string) {
  const res = await supabaseFetch(`profiles?select=id,email,first_name,last_name,neon_account_id,member_status,membership_access_state&id=eq.${encodeURIComponent(userId)}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] as {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    neon_account_id: string | null;
    member_status: string | null;
    membership_access_state: string | null;
  } | undefined || null;
}

async function profileHasActiveMembership(userId: string) {
  const res = await supabaseFetch("rpc/profile_has_active_membership", {
    method: "POST",
    body: JSON.stringify({ p_profile_id: userId })
  });
  if (!res.ok) return false;
  return Boolean(await res.json().catch(() => false));
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
      if (!update.ok) throw new Error("Could not link seasonal member.");
      const updatedRows = await update.json();
      return updatedRows[0] as { id: string; user_id: string | null };
    }
  }

  if (neonAccountId) {
    const byNeon = await supabaseFetch(`gpe_season_members?select=*&season_id=eq.${seasonId}&neon_account_id=eq.${encodeURIComponent(neonAccountId)}&limit=1`);
    if (byNeon.ok) {
      const rows = await byNeon.json();
      if (rows[0]) {
        if (rows[0].user_id && rows[0].user_id !== userId) {
          throw new ValidationError("This Camp registration is linked to a different Hub account. Contact Team GPE for help.");
        }
        const update = await supabaseFetch(`gpe_season_members?id=eq.${encodeURIComponent(rows[0].id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            user_id: userId,
            contact_email: rows[0].contact_email || email,
            status: rows[0].status || "registered"
          })
        });
        if (!update.ok) throw new Error("Could not link seasonal member.");
        const updatedRows = await update.json();
        return updatedRows[0] as { id: string; user_id: string | null };
      }
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
  if (!insert.ok) throw new Error("Could not link seasonal member.");
  const rows = await insert.json();
  return rows[0] as { id: string; user_id: string | null };
}

function proofLinks(fields: Record<string, unknown>) {
  const collect = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(collect);
    if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(collect);
    return String(value || "").split(/\s+/);
  };

  return [fields.screenshotLinks, fields.socialLinks, fields.submissionData]
    .flatMap(collect)
    .map((value) => value.trim())
    .filter((value) => /^https?:\/\//i.test(value));
}

type ChallengeRow = {
  id: string;
  season_id: string;
  action_type_id: string | null;
  slug: string;
  title: string;
  category: string | null;
  submission_type: string | null;
  point_value: number | null;
  requires_proof: boolean;
  requires_review: boolean;
  auto_approve: boolean;
  allow_multiple_submissions: boolean;
  max_completions_per_member: number;
  starts_at: string | null;
  ends_at: string | null;
  is_hub_visible: boolean;
  related_kind: string | null;
  metadata: Record<string, unknown>;
};

async function loadChallenges(seasonId: string, challengeIds: string[]) {
  const cleanIds = challengeIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (cleanIds.length === 0) return [] as ChallengeRow[];
  const res = await supabaseFetch([
    "gpe_challenges",
    "?select=id,season_id,action_type_id,slug,title,category,submission_type,point_value,requires_proof,requires_review,auto_approve,allow_multiple_submissions,max_completions_per_member,starts_at,ends_at,is_hub_visible,related_kind,metadata",
    `&season_id=eq.${encodeURIComponent(seasonId)}`,
    `&id=in.(${cleanIds.map(encodeURIComponent).join(",")})`,
    "&is_active=eq.true"
  ].join(""));
  if (!res.ok) throw new Error("Could not load selected seasonal challenges.");
  return await res.json() as ChallengeRow[];
}

async function loadChallengeBySlug(seasonId: string, slug: string) {
  if (!/^[a-z0-9-]{2,160}$/i.test(slug)) throw new ValidationError("Invalid challenge.");
  const res = await supabaseFetch([
    "gpe_challenges",
    "?select=id,season_id,action_type_id,slug,title,category,submission_type,point_value,requires_proof,requires_review,auto_approve,allow_multiple_submissions,max_completions_per_member,starts_at,ends_at,is_hub_visible,related_kind,metadata",
    `&season_id=eq.${encodeURIComponent(seasonId)}`,
    `&slug=eq.${encodeURIComponent(slug)}`,
    "&is_active=eq.true",
    "&limit=1"
  ].join(""));
  if (!res.ok) throw new Error("Could not load selected seasonal challenge.");
  const rows = await res.json();
  const challenge = rows[0] as ChallengeRow | undefined;
  if (!challenge || !challenge.is_hub_visible) throw new ValidationError("This challenge is not accepting submissions.");
  const now = Date.now();
  const start = challenge.starts_at ? new Date(challenge.starts_at).getTime() : null;
  const end = challenge.ends_at ? new Date(challenge.ends_at).getTime() : null;
  if (start && now < start) throw new ValidationError("This challenge has not opened yet.");
  if (end && now > end) throw new ValidationError("This challenge is closed.");
  return challenge;
}

function challengeDefinition(challenge: ChallengeRow) {
  const definition = challenge.metadata?.definition;
  return definition && typeof definition === "object" && !Array.isArray(definition)
    ? definition as {
      open_flow?: { kind?: string; type?: string };
      submission?: { enabled?: boolean; fields?: Array<Record<string, unknown>> };
    }
    : {};
}

function normalizedOpenFlowType(challenge: ChallengeRow) {
  const openFlow = challengeDefinition(challenge).open_flow || {};
  const raw = String(openFlow.kind || openFlow.type || "").trim().toLowerCase();
  if (raw === "external") return "external_action";
  if (raw === "external_action" || raw === "submission_form" || raw === "toolkit" || raw === "completion_page") return raw;
  const inferred = `${challenge.submission_type || ""} ${challenge.category || ""} ${challenge.related_kind || ""}`.toLowerCase();
  if (inferred.includes("petition")) return "external_action";
  if (inferred.includes("toolkit")) return "toolkit";
  return "submission_form";
}

function defaultFieldDefinitions(challenge: ChallengeRow) {
  const type = `${challenge.submission_type || ""} ${challenge.category || ""}`.toLowerCase();
  if (type.includes("petition")) {
    return [
      { id: "completed_petition", type: "checkbox", label: "I completed the petition", required: true, options: ["yes"] },
      { id: "proof", type: "image", label: "Screenshot or confirmation URL", required: Boolean(challenge.requires_proof) }
    ];
  }
  if (type.includes("video")) {
    return [
      { id: "video_url", type: "video_url", label: "Video URL", required: true },
      { id: "caption", type: "textarea", label: "Caption or description" },
      { id: "proof", type: "image", label: "Screenshot or proof URL", required: Boolean(challenge.requires_proof) }
    ];
  }
  if (type.includes("story") || type.includes("social")) {
    return [
      { id: "story_url", type: "url", label: "Story or post URL", required: true },
      { id: "proof", type: "image", label: "Screenshot URL", required: Boolean(challenge.requires_proof) },
      { id: "notes", type: "textarea", label: "Notes" }
    ];
  }
  if (type.includes("reflection")) {
    return [
      { id: "reflection", type: "textarea", label: "Reflection", required: true },
      { id: "image", type: "image", label: "Image URL", required: Boolean(challenge.requires_proof) }
    ];
  }
  return [
    { id: "proof", type: "url", label: "Proof URL", required: Boolean(challenge.requires_proof) },
    { id: "notes", type: "textarea", label: "Notes" }
  ];
}

function fieldSchemaForChallenge(challenge: ChallengeRow) {
  const submission = challengeDefinition(challenge).submission || {};
  const fields = Array.isArray(submission.fields) && submission.fields.length > 0
    ? submission.fields
    : defaultFieldDefinitions(challenge);
  return fields
    .map((field) => {
      const key = sanitizeText(field.id, 80);
      const label = sanitizeText(field.label, 160) || key;
      const rawType = sanitizeText(field.type, 40);
      const type = rawType === "video_url" ? "url" : rawType;
      const allowedTypes = ["text", "textarea", "url", "checkbox", "select", "file", "image"];
      if (!key || !allowedTypes.includes(type)) return null;
      return {
        key,
        label,
        required: Boolean(field.required),
        type: type as "text" | "textarea" | "url" | "checkbox" | "select" | "file" | "image",
        allowed: Array.isArray(field.options) ? field.options.map((option) => sanitizeText(option, 120)).filter(Boolean) : undefined,
        maxLength: type === "textarea" ? 5000 : 1000
      };
    })
    .filter(Boolean) as Array<{ key: string; label: string; required?: boolean; type?: "text" | "textarea" | "url" | "checkbox" | "select" | "file" | "image"; allowed?: string[]; maxLength?: number }>;
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

async function openSubmissionCount(params: { seasonMemberId: string; challengeId: string }) {
  const res = await supabaseFetch([
    "gpe_camp_submission_actions",
    "?select=id,gpe_camp_challenge_submissions!inner(season_member_id)",
    `&challenge_id=eq.${encodeURIComponent(params.challengeId)}`,
    "&review_status=in.(pending,needs_information,approved)",
    `&gpe_camp_challenge_submissions.season_member_id=eq.${encodeURIComponent(params.seasonMemberId)}`
  ].join(""));
  if (!res.ok) return 0;
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

async function createReviewSubmission(params: {
  formSubmissionId: string;
  seasonId: string;
  seasonMemberId: string | null;
  userId: string | null;
  neonAccountId: string | null;
  email: string;
  fields: Record<string, unknown>;
  authUserId: string | null;
  memberLinkStatus: "linked" | "pending_reconciliation";
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
      review_status: "pending",
      authenticated_user_id: params.authUserId,
      member_link_status: params.memberLinkStatus
    })
  });
  if (!res.ok) throw new Error("Could not save seasonal challenge for review.");
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
  if (!res.ok) throw new Error("Could not save seasonal submission action.");
  const rows = await res.json();
  return rows[0] as { id: string; review_status: string; requested_points: number | null };
}

function preferredName(fields: Record<string, unknown>, profile: Awaited<ReturnType<typeof profileByUserId>>, authUser: AuthUser | null, key: "firstName" | "lastName") {
  const fieldValue = sanitizeText(fields[key], 120);
  if (fieldValue) return fieldValue;
  const profileKey = key === "firstName" ? "first_name" : "last_name";
  const profileValue = sanitizeText(profile?.[profileKey], 120);
  if (profileValue) return profileValue;
  const metaKey = key === "firstName" ? "first_name" : "last_name";
  return sanitizeText(authUser?.user_metadata?.[metaKey], 120);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);
    const body = await readJson(req);
    const idempotencyKey = validateIdempotencyKey(req.headers.get("idempotency-key") || body.idempotencyKey);
    const rawFields = (body.fields || {}) as Record<string, unknown>;
    let fields = validateFields(rawFields, CHALLENGE_FIELDS);
    const challengeSlug = sanitizeText(body.challengeSlug || rawFields.challengeSlug, 160);
    const submittedEmail = String(fields.email).toLowerCase();
    const authUser = await authenticatedUser(req, origin);
    const email = authUser?.email || submittedEmail;
    let selectedChallengeIds = Array.isArray(fields.challengeIds) ? fields.challengeIds.map(String) : [];
    let wantsOther = Array.isArray(fields.actions) && fields.actions.includes("other");
    let otherDescription = String(fields.otherAction || "").trim();

    const profile = authUser ? await profileByUserId(authUser.id) : null;
    const firstName = preferredName(fields, profile, authUser, "firstName");
    const lastName = preferredName(fields, profile, authUser, "lastName");
    const season = await activeSeason();
    let dynamicChallenge: ChallengeRow | null = null;
    if (challengeSlug) {
      if (!authUser) throw new ValidationError("Sign in to submit this challenge.");
      dynamicChallenge = await loadChallengeBySlug(season.id, challengeSlug);
      const flowType = normalizedOpenFlowType(dynamicChallenge);
      console.info("camp-gpe-challenge-submit flow resolution", {
        challengeSlug,
        flowType,
        submissionEnabled: challengeDefinition(dynamicChallenge).submission?.enabled !== false
      });
      if (flowType !== "submission_form") {
        throw new ValidationError("This challenge is not configured for direct form submission.");
      }
      if (challengeDefinition(dynamicChallenge).submission?.enabled === false) {
        throw new ValidationError("This challenge is not accepting submissions.");
      }
      const submissionSchema = fieldSchemaForChallenge(dynamicChallenge);
      const rawSubmissionData = (body.submissionData || rawFields.submissionData || {}) as Record<string, unknown>;
      const submissionData = validateFields(rawSubmissionData, submissionSchema);
      fields = {
        ...fields,
        challengeSlug,
        challengeIds: [dynamicChallenge.id],
        submissionData,
        sourcePage: "dynamic_challenge_submission"
      };
      selectedChallengeIds = [dynamicChallenge.id];
      wantsOther = false;
      otherDescription = "";
    }

    const { submission, duplicate } = await createFormSubmission({
      idempotencyKey,
      formKey: FORM_KEY,
      email,
      payload: { fields },
      membershipRequest: null,
      honeypot: sanitizeText(body.website, 250)
    });
    if (duplicate) return jsonResponse({ duplicate: true, submissionId: submission.id, ...publicConfig() }, 200, origin);

    let membership: Awaited<ReturnType<typeof resolveMembership>> | null = null;
    try {
      membership = await resolveMembership({
        email,
        firstName,
        lastName,
        neonAccountId: profile?.neon_account_id || undefined
      });
      if (membership.neonAccountId) {
        await createActivity({
          neonAccountId: membership.neonAccountId,
          subject: `${season.name} Challenge Submission`,
          type: season.name,
          note: { formKey: FORM_KEY, fields }
        });
        await logSync({ submissionId: String(submission.id), integration: "neon", operation: "camp_gpe_challenge_activity", success: true });
      }
    } catch (error) {
      await logSync({ submissionId: String(submission.id), integration: "neon", operation: "camp_gpe_challenge_activity", success: false, errorSummary: safeError(error) });
    }

    const hubMembershipActive = authUser ? await profileHasActiveMembership(authUser.id) : false;
    const activeMembership = Boolean(membership?.isActiveMember || hubMembershipActive);
    const resolvedNeonAccountId = membership?.neonAccountId || profile?.neon_account_id || null;

    if (dynamicChallenge && !activeMembership) {
      await updateFormSubmission(String(submission.id), {
        submission_status: "requires_manual_review",
        membership_outcome: membership?.outcome || "inactive_member"
      });
      throw new ValidationError("Active membership is required to submit this challenge.");
    }

    let member: { id: string; user_id: string | null } | null = null;
    const canLinkMember = Boolean(authUser?.id && activeMembership);
    if (canLinkMember && authUser) {
      try {
        member = await seasonMember(season.id, authUser.id, email, resolvedNeonAccountId);
      } catch (error) {
        await logSync({ submissionId: String(submission.id), integration: "camp", operation: "season_member_link", success: false, errorSummary: safeError(error) });
      }
    }
    const challenges = await loadChallenges(season.id, selectedChallengeIds);
    const submittedProofLinks = proofLinks(fields);
    if (dynamicChallenge?.requires_proof && submittedProofLinks.length === 0) {
      throw new ValidationError("Proof is required for this challenge.");
    }

    const reviewSubmission = await createReviewSubmission({
      formSubmissionId: String(submission.id),
      seasonId: season.id,
      seasonMemberId: member?.id || null,
      userId: member?.user_id || authUser?.id || null,
      neonAccountId: membership?.neonAccountId || null,
      email,
      fields,
      authUserId: authUser?.id || null,
      memberLinkStatus: member?.id ? "linked" : "pending_reconciliation"
    });
    const actionResults: Array<{ id: string; status: string }> = [];
    let pendingActions = 0;

    for (const challenge of challenges) {
      const completed = member?.id ? await completionCount({ seasonMemberId: member.id, challengeId: challenge.id }) : 0;
      const openSubmissions = member?.id ? await openSubmissionCount({ seasonMemberId: member.id, challengeId: challenge.id }) : 0;
      const existingSubmissions = completed + openSubmissions;
      const limitReached = Boolean(member?.id) && (existingSubmissions >= challenge.max_completions_per_member || (!challenge.allow_multiple_submissions && existingSubmissions > 0));
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
      pendingActions += 1;
      actionResults.push({ id: action.id, status: "pending" });
    }

    if (wantsOther || challenges.length === 0) {
      const action = await createSubmissionAction({
        submissionId: reviewSubmission.id,
        challenge: null,
        otherDescription: otherDescription || "Unspecified member action",
        proofUrls: submittedProofLinks,
        status: "pending"
      });
      pendingActions += 1;
      actionResults.push({ id: action.id, status: "pending" });
    }

    await updateFormSubmission(String(submission.id), {
      submission_status: "requires_manual_review",
      neon_sync_status: membership?.neonAccountId ? "succeeded" : "skipped",
      neon_account_id: resolvedNeonAccountId,
      membership_outcome: membership?.outcome || (hubMembershipActive ? "hub_active_member" : "not_checked")
    });
    return jsonResponse({
      ok: true,
      submissionId: submission.id,
      reviewSubmissionId: reviewSubmission?.id,
      status: "pending",
      awardedPoints: 0,
      pendingActions,
      approvedActions: 0,
      actions: actionResults,
      memberLinked: Boolean(member?.id),
      membershipOutcome: membership?.outcome || (hubMembershipActive ? "hub_active_member" : "not_checked"),
      partialSuccess: false,
      leaderboardUrl: "https://members.girlplusenvironment.org/leaderboard",
      message: "Your submission has been received and will be reviewed by Team GPE. Approved actions will be added to your points.",
      ...publicConfig()
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("camp-gpe-challenge-submit", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Seasonal challenge submission could not be completed." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
