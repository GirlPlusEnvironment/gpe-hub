import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { recordLeadAction } from "../_shared/form-submission.ts";
import { createActivity } from "../_shared/neon-activity.ts";
import { resolveOrCreateAccount } from "../_shared/neon-account.ts";
import { type Json, safeError, supabaseFetch } from "../_shared/neon-membership.ts";
import { normalizeEmail, readJson, sanitizeText } from "../_shared/validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type SubmissionRow = {
  id: string;
  form_key: string;
  email_normalized: string | null;
  neon_account_id: string | null;
  membership_choice?: string | null;
  neon_sync_status?: string | null;
  points_status?: string | null;
  submission_payload: Json;
  created_at: string;
};

type LeadActionRow = {
  id: string;
  lead_id: string;
  user_id: string | null;
  action_slug: string;
  provider: string;
  provider_action_id: string | null;
  provider_person_id: string | null;
  provider_signature_id: string | null;
  form_submission_id: string | null;
  campaign_slug: string | null;
  membership_choice: string;
  neon_sync_status: string;
  hub_identity_status: string;
  points_status: string;
  points_result: Json;
  raw_payload: Json;
  created_at: string;
  neon_activity_id?: string | null;
  invitation_status?: string | null;
  reconciliation_error?: string | null;
  reconciled_at?: string | null;
  constituent_leads?: {
    email_normalized: string;
    first_name: string | null;
    last_name: string | null;
    neon_account_id: string | null;
    hub_profile_id: string | null;
    membership_state: string | null;
    hub_access: string | null;
  } | null;
};

type PetitionCandidate = {
  submissionId: string | null;
  leadActionId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  zip: string;
  actionSlug: string;
  petitionTitle: string;
  campaignSlug: string | null;
  sourceUrl: string | null;
  providerActionId: string | null;
  providerPersonId: string | null;
  providerSignatureId: string;
  occurredAt: string;
  neonAccountId: string | null;
  hubProfileId: string | null;
  membershipStatus: string;
  hubIdentityStatus: string;
  neonSyncStatus: string;
  pointsStatus: string;
  invitationStatus: string;
  reconciliationError: string | null;
  rawPayload: Json;
};

function firstValue(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      const nested = firstValue(...value);
      if (nested) return nested;
    } else if (value && typeof value === "object") {
      const record = value as Json;
      const nested = firstValue(record.address, record.email, record.value, record.href, record.id, record.slug, record.title);
      if (nested) return nested;
    } else {
      const text = sanitizeText(value, 500);
      if (text) return text;
    }
  }
  return "";
}

function nestedRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function actionNetworkSlugFromUrl(value: unknown) {
  const text = sanitizeText(value, 800);
  const match = text.match(/actionnetwork\.org\/(?:petitions|letters)\/([^/?#]+)/i);
  return sanitizeText(match?.[1] || "", 180);
}

function providerIdFromSlug(slug: string) {
  return slug || null;
}

function extractPetition(rawPayload: Json, submission?: SubmissionRow | null) {
  const payload = nestedRecord(rawPayload.payload) || rawPayload;
  const fields = nestedRecord(rawPayload.fields) || nestedRecord(payload.fields);
  const person = nestedRecord(rawPayload.person || rawPayload.person_data || rawPayload.supporter || payload.person || payload.person_data || payload.supporter);
  const action = nestedRecord(rawPayload.action || payload.action);
  const petition = nestedRecord(rawPayload.petition || payload.petition);
  const form = nestedRecord(rawPayload.form || payload.form);
  const sourceUrl = firstValue(
    rawPayload.source_url,
    rawPayload.sourceUrl,
    fields.socialLinks,
    action.url,
    action.href,
    petition.url,
    petition.href,
    form.url,
    form.href,
    rawPayload.url,
    rawPayload.action_url,
    rawPayload.referrer,
  );
  const slug = actionNetworkSlugFromUrl(sourceUrl)
    || sanitizeText(firstValue(rawPayload.actionSlug, rawPayload.action_slug, rawPayload.petition_slug, action.slug, petition.slug, form.slug), 180)
    || sanitizeText(firstValue(fields.otherAction), 180).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const title = sanitizeText(firstValue(fields.otherAction, petition.title, action.title, form.title, slug), 220);
  const email = normalizeEmail(firstValue(submission?.email_normalized, rawPayload.email, fields.email, person.email, person.email_address, person.email_addresses));
  return {
    email,
    firstName: sanitizeText(firstValue(fields.firstName, rawPayload.firstName, rawPayload.first_name, person.first_name, person.firstName, person.given_name), 120),
    lastName: sanitizeText(firstValue(fields.lastName, rawPayload.lastName, rawPayload.last_name, person.last_name, person.lastName, person.family_name), 120),
    phone: sanitizeText(firstValue(fields.phone, rawPayload.phone, person.phone, person.phone_number), 80),
    zip: sanitizeText(firstValue(fields.zip, fields.postalCode, rawPayload.zip, rawPayload.postal_code, person.zip, person.postal_code), 40),
    actionSlug: slug,
    petitionTitle: title || slug || "Action Network petition",
    campaignSlug: sanitizeText(firstValue(rawPayload.campaignSlug, rawPayload.campaign_slug, fields.campaignSlug), 160) || null,
    sourceUrl: sourceUrl || null,
    providerActionId: providerIdFromSlug(slug),
    providerPersonId: sanitizeText(firstValue(rawPayload.person_id, rawPayload.personId, person.id, person.uuid, person.action_network_id), 180) || null,
    providerSignatureId: sanitizeText(firstValue(rawPayload.id, rawPayload.uuid, rawPayload.submission_id, rawPayload.signature_id, payload.id, payload.uuid), 180) || (submission?.id ? `form_submission:${submission.id}` : `${slug}:${email}`),
  };
}

function isActionNetworkSubmission(row: SubmissionRow) {
  const text = JSON.stringify(row.submission_payload || {}).toLowerCase();
  return row.form_key === "action_network_petition" || text.includes("actionnetwork.org") || text.includes("action_network");
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
    headers: { apikey: serviceKey, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null) as { id?: string; email?: string } | null;
  return user?.id ? user : null;
}

async function isAdmin(userId: string) {
  const res = await supabaseFetch("rpc/is_admin", {
    method: "POST",
    body: JSON.stringify({ check_user_id: userId }),
  });
  if (!res.ok) return false;
  return Boolean(await res.json().catch(() => false));
}

async function loadRegistry() {
  const res = await supabaseFetch("gpe_form_registry?select=slug,provider_action_id,campaign_slug,general_points,camp_points,title&provider=eq.action_network");
  if (!res.ok) return [];
  return await res.json() as Array<{ slug: string; provider_action_id: string | null; campaign_slug: string | null; general_points: number; camp_points: number; title: string }>;
}

function registryFor(registry: Awaited<ReturnType<typeof loadRegistry>>, candidate: Pick<PetitionCandidate, "actionSlug" | "sourceUrl">) {
  return registry.find((row) => row.provider_action_id === candidate.actionSlug || row.slug === candidate.actionSlug)
    || registry.find((row) => candidate.sourceUrl && row.provider_action_id && candidate.sourceUrl.includes(row.provider_action_id))
    || null;
}

async function findProfile(email: string, neonAccountId: string | null) {
  if (neonAccountId) {
    const byNeon = await supabaseFetch(`profiles?select=id,email,member_status,membership_access_state,neon_account_id&neon_account_id=eq.${encodeURIComponent(neonAccountId)}&limit=1`);
    if (byNeon.ok) {
      const rows = await byNeon.json();
      if (rows[0]) return rows[0] as { id: string; member_status: string | null; membership_access_state: string | null };
    }
  }
  const byEmail = await supabaseFetch(`profiles?select=id,email,member_status,membership_access_state,neon_account_id&email=eq.${encodeURIComponent(email)}&limit=1`);
  if (!byEmail.ok) return null;
  const rows = await byEmail.json();
  return rows[0] as { id: string; member_status: string | null; membership_access_state: string | null } | undefined || null;
}

function isActiveProfile(profile: { member_status: string | null; membership_access_state: string | null } | null) {
  return profile?.member_status === "active" || profile?.membership_access_state === "active";
}

async function patch(path: string, body: Json) {
  const res = await supabaseFetch(path, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function getLeadActionBySubmission(submissionId: string) {
  const res = await supabaseFetch(`lead_actions?select=*&form_submission_id=eq.${encodeURIComponent(submissionId)}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] as LeadActionRow | undefined || null;
}

async function getLeadActionBySignature(providerSignatureId: string) {
  const res = await supabaseFetch(`lead_actions?select=*&provider=eq.action_network&provider_signature_id=eq.${encodeURIComponent(providerSignatureId)}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] as LeadActionRow | undefined || null;
}

async function upsertLeadAction(candidate: PetitionCandidate, neonAccountId: string | null, hubProfileId: string | null) {
  const existing = candidate.submissionId ? await getLeadActionBySubmission(candidate.submissionId) : await getLeadActionBySignature(candidate.providerSignatureId);
  if (existing?.id) return existing;

  const result = await recordLeadAction({
    submissionId: candidate.submissionId,
    email: candidate.email,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    phone: candidate.phone,
    postalCode: candidate.zip,
    neonAccountId,
    actionType: "petition_signature",
    actionSlug: candidate.actionSlug,
    provider: "action_network",
    providerActionId: candidate.providerActionId,
    providerPersonId: candidate.providerPersonId,
    providerSignatureId: candidate.providerSignatureId,
    campaignSlug: candidate.campaignSlug,
    sourceUrl: candidate.sourceUrl,
    membershipRequest: null,
    rawPayload: candidate.rawPayload,
    neonSyncStatus: neonAccountId ? "succeeded" : "pending",
    hubIdentityStatus: hubProfileId ? "succeeded" : "pending",
    pointsStatus: hubProfileId ? "pending_membership" : "pending_identity",
  });
  const inserted = result?.action as LeadActionRow | null;
  if (inserted?.id) return inserted;
  return await getLeadActionBySignature(candidate.providerSignatureId);
}

async function syncLeadAndSubmission(args: {
  leadActionId: string;
  submissionId: string | null;
  neonAccountId: string | null;
  hubProfileId: string | null;
  neonSyncStatus: string;
  hubIdentityStatus: string;
  pointsStatus?: string;
  invitationStatus?: string;
  neonActivityId?: string | null;
  error?: string | null;
}) {
  const leadActionRes = await supabaseFetch(`lead_actions?select=lead_id&id=eq.${encodeURIComponent(args.leadActionId)}`);
  const rows = leadActionRes.ok ? await leadActionRes.json() : [];
  const leadId = rows[0]?.lead_id ? String(rows[0].lead_id) : null;
  if (leadId) {
    await patch(`constituent_leads?id=eq.${encodeURIComponent(leadId)}`, {
      neon_account_id: args.neonAccountId,
      hub_profile_id: args.hubProfileId,
      membership_state: "nonmember",
      hub_access: "restricted",
      updated_at: new Date().toISOString(),
    });
  }
  await patch(`lead_actions?id=eq.${encodeURIComponent(args.leadActionId)}`, {
    user_id: args.hubProfileId,
    neon_sync_status: args.neonSyncStatus,
    hub_identity_status: args.hubIdentityStatus,
    points_status: args.pointsStatus,
    invitation_status: args.invitationStatus,
    neon_activity_id: args.neonActivityId || null,
    reconciliation_error: args.error || null,
    reconciled_at: new Date().toISOString(),
  });
  if (args.submissionId) {
    await patch(`gpe_form_submissions?id=eq.${encodeURIComponent(args.submissionId)}`, {
      neon_account_id: args.neonAccountId,
      neon_sync_status: args.neonSyncStatus,
      points_status: args.pointsStatus || "pending_identity",
      updated_at: new Date().toISOString(),
    });
    await patch(`gpe_camp_challenge_submissions?form_submission_id=eq.${encodeURIComponent(args.submissionId)}`, {
      neon_account_id: args.neonAccountId,
      user_id: args.hubProfileId,
      member_link_status: args.hubProfileId ? "linked" : "pending_reconciliation",
      updated_at: new Date().toISOString(),
    }).catch(() => undefined);
  }
}

async function awardGeneralPetitionPoints(profileId: string | null, leadActionId: string, candidate: PetitionCandidate, generalPoints: number) {
  if (!profileId || generalPoints <= 0) return { status: "pending_identity", result: { reason: "no_hub_profile" } };
  const profile = await findProfile(candidate.email, candidate.neonAccountId);
  if (!isActiveProfile(profile)) return { status: "pending_membership", result: { reason: "inactive_or_missing_membership" } };

  const award = await supabaseFetch("rpc/service_award_petition_signature_points", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: profileId,
      p_lead_action_id: leadActionId,
      p_points: generalPoints,
      p_metadata: { petitionSlug: candidate.actionSlug, providerSignatureId: candidate.providerSignatureId },
      p_occurred_at: candidate.occurredAt,
    }),
  });
  if (!award.ok) return { status: "failed", result: { reason: await award.text() } };
  const result = await award.json() as Json;
  return { status: result.ok === true ? "awarded" : "failed", result };
}

async function invitationActivity(candidate: PetitionCandidate, neonAccountId: string) {
  try {
    const activityId = await createActivity({
      neonAccountId,
      subject: Deno.env.get("NEON_PETITION_INVITATION_ACTIVITY_SUBJECT") || "GPE Petition Signer Membership Invitation",
      note: {
        source: "action_network",
        membershipStatus: "nonmember",
        hubInviteStatus: "pending",
        invitationEligible: true,
        petition: candidate.petitionTitle,
        petitionSlug: candidate.actionSlug,
        campaignSlug: candidate.campaignSlug,
        sourceUrl: candidate.sourceUrl,
        providerPersonId: candidate.providerPersonId,
        providerSignatureId: candidate.providerSignatureId,
        signedAt: candidate.occurredAt,
      },
    });
    return { status: "succeeded", activityId, error: null };
  } catch (error) {
    const message = safeError(error);
    const missingConfig = /status\/timezone IDs are not configured|Missing required secret/i.test(message);
    return { status: missingConfig ? "pending" : "failed", activityId: null, error: message };
  }
}

async function candidateRows(limit = 100) {
  const submissionsRes = await supabaseFetch(`gpe_form_submissions?select=*&order=created_at.desc&limit=${Math.min(Math.max(limit * 4, limit), 500)}`);
  if (!submissionsRes.ok) throw new Error("Could not load form submissions.");
  const submissions = (await submissionsRes.json() as SubmissionRow[]).filter(isActionNetworkSubmission);

  const leadRes = await supabaseFetch(`lead_actions?select=*,constituent_leads(email_normalized,first_name,last_name,neon_account_id,hub_profile_id,membership_state,hub_access)&provider=eq.action_network&order=created_at.desc&limit=${Math.min(Math.max(limit, 20), 500)}`);
  const leadActions = leadRes.ok ? await leadRes.json() as LeadActionRow[] : [];
  const registry = await loadRegistry();

  const rows: PetitionCandidate[] = [];
  for (const submission of submissions) {
    const extracted = extractPetition(submission.submission_payload || {}, submission);
    if (!extracted.email || !extracted.actionSlug) continue;
    const existing = leadActions.find((action) => action.form_submission_id === submission.id);
    const seed = {
      submissionId: submission.id,
      leadActionId: existing?.id || null,
      ...extracted,
      occurredAt: submission.created_at,
      neonAccountId: existing?.constituent_leads?.neon_account_id || submission.neon_account_id || null,
      hubProfileId: existing?.constituent_leads?.hub_profile_id || existing?.user_id || null,
      membershipStatus: existing?.constituent_leads?.membership_state || "nonmember",
      hubIdentityStatus: existing?.hub_identity_status || "not_attempted",
      neonSyncStatus: existing?.neon_sync_status || submission.neon_sync_status || "not_attempted",
      pointsStatus: existing?.points_status || submission.points_status || "pending_identity",
      invitationStatus: existing?.invitation_status || "not_attempted",
      reconciliationError: existing?.reconciliation_error || null,
      rawPayload: submission.submission_payload || {},
    };
    const reg = registryFor(registry, seed);
    rows.push({
      ...seed,
      campaignSlug: seed.campaignSlug || reg?.campaign_slug || null,
      petitionTitle: reg?.title || seed.petitionTitle,
    });
  }

  for (const action of leadActions) {
    if (action.form_submission_id && rows.some((row) => row.submissionId === action.form_submission_id)) continue;
    const extracted = extractPetition(action.raw_payload || {});
    rows.push({
      submissionId: action.form_submission_id,
      leadActionId: action.id,
      email: action.constituent_leads?.email_normalized || extracted.email,
      firstName: action.constituent_leads?.first_name || extracted.firstName,
      lastName: action.constituent_leads?.last_name || extracted.lastName,
      phone: extracted.phone,
      zip: extracted.zip,
      actionSlug: action.action_slug || extracted.actionSlug,
      petitionTitle: extracted.petitionTitle || action.action_slug,
      campaignSlug: action.campaign_slug,
      sourceUrl: extracted.sourceUrl,
      providerActionId: action.provider_action_id || extracted.providerActionId,
      providerPersonId: action.provider_person_id || extracted.providerPersonId,
      providerSignatureId: action.provider_signature_id || extracted.providerSignatureId,
      occurredAt: String((action.raw_payload || {}).occurred_at || action.created_at || new Date().toISOString()),
      neonAccountId: action.constituent_leads?.neon_account_id || null,
      hubProfileId: action.constituent_leads?.hub_profile_id || action.user_id,
      membershipStatus: action.constituent_leads?.membership_state || "nonmember",
      hubIdentityStatus: action.hub_identity_status,
      neonSyncStatus: action.neon_sync_status,
      pointsStatus: action.points_status,
      invitationStatus: action.invitation_status || "not_attempted",
      reconciliationError: action.reconciliation_error || null,
      rawPayload: action.raw_payload || {},
    });
  }

  return rows.slice(0, limit);
}

async function reconcileCandidate(candidate: PetitionCandidate, registry: Awaited<ReturnType<typeof loadRegistry>>) {
  const reg = registryFor(registry, candidate);
  const campaignSlug = candidate.campaignSlug || reg?.campaign_slug || null;
  const generalPoints = reg?.general_points ?? 5;
  let neonAccountId = candidate.neonAccountId;
  let neonSyncStatus = neonAccountId ? "succeeded" : "pending";
  let error: string | null = null;

  try {
    const account = await resolveOrCreateAccount({
      email: candidate.email,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      phone: candidate.phone,
      zip: candidate.zip,
      allowCreate: true,
    });
    if (account.status === "ambiguous" || !account.neonAccountId) {
      neonSyncStatus = "failed";
      error = "Multiple Neon accounts matched this email; manual review required.";
    } else {
      neonAccountId = account.neonAccountId;
      neonSyncStatus = "succeeded";
    }
  } catch (caught) {
    neonSyncStatus = "failed";
    error = safeError(caught);
  }

  const profile = await findProfile(candidate.email, neonAccountId);
  const hubProfileId = profile?.id || null;
  const leadAction = await upsertLeadAction({ ...candidate, campaignSlug, neonAccountId }, neonAccountId, hubProfileId);
  if (!leadAction?.id) throw new Error("Could not create or find lead action.");

  let invitation = { status: "not_attempted", activityId: null as string | null, error: null as string | null };
  if (neonAccountId) invitation = await invitationActivity({ ...candidate, campaignSlug, neonAccountId }, neonAccountId);

  const points = await awardGeneralPetitionPoints(hubProfileId, leadAction.id, { ...candidate, neonAccountId }, generalPoints);
  await patch(`lead_actions?id=eq.${encodeURIComponent(leadAction.id)}`, {
    points_result: points.result,
  }).catch(() => undefined);

  await syncLeadAndSubmission({
    leadActionId: leadAction.id,
    submissionId: candidate.submissionId,
    neonAccountId,
    hubProfileId,
    neonSyncStatus,
    hubIdentityStatus: hubProfileId ? "succeeded" : "pending",
    pointsStatus: points.status,
    invitationStatus: invitation.status,
    neonActivityId: invitation.activityId,
    error: error || invitation.error,
  });

  return {
    ...candidate,
    leadActionId: leadAction.id,
    neonAccountId,
    hubProfileId,
    campaignSlug,
    neonSyncStatus,
    hubIdentityStatus: hubProfileId ? "succeeded" : "pending",
    pointsStatus: points.status,
    invitationStatus: invitation.status,
    reconciliationError: error || invitation.error,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  assertAllowedOrigin(origin);
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

  try {
    const user = await authenticatedUser(req);
    if (!user?.id || !(await isAdmin(user.id))) return jsonResponse({ message: "Admin access required." }, 403, origin);

    const body = await readJson(req, 20_000).catch(() => ({})) as Json;
    const action = sanitizeText(body.action, 40) || "list";
    const limit = Math.min(Math.max(Number(body.limit || 50), 1), 100);
    if (action === "list") {
      return jsonResponse({ ok: true, rows: await candidateRows(limit), checkedAt: new Date().toISOString() }, 200, origin);
    }
    if (action !== "reconcile") return jsonResponse({ message: "Unsupported action." }, 400, origin);

    const all = await candidateRows(limit);
    const onlyIds = Array.isArray(body.submissionIds) ? body.submissionIds.map((id) => String(id)) : [];
    const candidates = onlyIds.length > 0 ? all.filter((row) => row.submissionId && onlyIds.includes(row.submissionId)) : all;
    const registry = await loadRegistry();
    const results = [];
    for (const candidate of candidates) {
      if (!candidate.email) continue;
      results.push(await reconcileCandidate(candidate, registry));
    }
    return jsonResponse({
      ok: true,
      reconciled: results.length,
      rows: results,
      checkedAt: new Date().toISOString(),
    }, 200, origin);
  } catch (error) {
    console.error("admin-petition-reconciliation", safeError(error));
    return jsonResponse({ message: "Petition reconciliation could not be completed.", detail: safeError(error) }, 500, origin);
  }
});
