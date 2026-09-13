import {
  recordLeadAction,
  recordPointEventForLeadAction
} from "../_shared/form-submission.ts";
import { sendLifecycleEmail } from "../_shared/lifecycle-email.ts";
import { createAndFinalizeMembership, queueHubInvitation } from "../_shared/membership-request.ts";
import { normalizeMembershipRequest } from "../_shared/membership-schema.ts";
import { recordMembershipDataFallbackActivity } from "../_shared/membership-neon-mapping.ts";
import { createActivity } from "../_shared/neon-activity.ts";
import {
  type Json,
  findNeonAccountsByEmail,
  getEnv,
  neonFetch,
  normalizeEmail,
  resolveAccountMatch,
  resolveMembership,
  safeError,
  sanitizeText,
  supabaseFetch
} from "../_shared/neon-membership.ts";
import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type MembershipOutcome =
  | "active_member_existing_hub_user"
  | "active_member_needs_hub_invite"
  | "nonmember"
  | "ambiguous_account"
  | "submission_saved_neon_sync_pending"
  | "failed";

type SubmissionStatus =
  | "received"
  | "requires_manual_review"
  | "neon_sync_pending"
  | "neon_synced"
  | "hub_invite_pending"
  | "hub_invited"
  | "failed";

type MembershipCreationStatus =
  | "not_requested"
  | "incomplete"
  | "not_attempted"
  | "attempted"
  | "confirmed"
  | "already_active"
  | "failed";

const MAX_BODY_BYTES = 120_000;
const SURVEY_ID = 2;
const FORM_ID = 47;
const FORM_KEY = "neon_climate_survey";

type FieldDef = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  neonSurveyFieldId?: number;
  neonName: string;
  allowed?: string[];
  max?: number;
};

const FIELD_DEFS: FieldDef[] = [
  { key: "consent", label: "By checking this box, you’re giving consent to share your information within our organization and with our organizational partners. Your responses will be de-identified, and used to inform the development of a community climate adaptation plan.", type: "checkbox-single", required: true, neonSurveyFieldId: 37, neonName: "surveyFields[0].value", allowed: ["37"] },
  { key: "firstName", label: "First Name", type: "text", required: false, neonName: "account.name.firstName" },
  { key: "lastName", label: "Last Name", type: "text", required: false, neonName: "account.name.lastName" },
  { key: "phoneNumber", label: "Phone Number", type: "tel", required: true, neonSurveyFieldId: 44, neonName: "surveyFields[1].value" },
  { key: "emailAddress", label: "Email Address", type: "email", required: true, neonSurveyFieldId: 45, neonName: "surveyFields[2].value" },
  { key: "age", label: "Age", type: "text", required: true, neonName: "surveyPayload.age" },
  { key: "city", label: "City", type: "text", required: false, neonName: "account.address.city" },
  { key: "stateOrProvince", label: "State/Province", type: "select", required: false, neonName: "account.address.stateOrProvince", allowed: ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","AS","FM","GU","MH","MP","PW","PR","UM","VI","AA","AE","AP","AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"] },
  { key: "zipCode", label: "Zip", type: "text", required: true, neonName: "account.address.zipCode" },
  { key: "raceEthnicity", label: "Race/Ethnicity", type: "text", required: true, neonSurveyFieldId: 47, neonName: "surveyFields[3].value" },
  { key: "gender", label: "Gender", type: "text", required: true, neonSurveyFieldId: 46, neonName: "surveyFields[4].value" },
  { key: "educationLevel", label: "Highest Education Level Completed", type: "select", required: false, neonSurveyFieldId: 42, neonName: "surveyFields[5].value", allowed: ["186","187","188","189","190","191"] },
  { key: "currentIncome", label: "Current Income", type: "select", required: false, neonSurveyFieldId: 43, neonName: "surveyFields[6].value", allowed: ["192","193","194","195"] },
  { key: "climateEventsConcerned", label: "Which of the following climate events are you most concerned about? (Please choose no more than 3)", type: "checkbox", max: 3, required: true, neonSurveyFieldId: 39, neonName: "surveyFields[7].value", allowed: ["39","171","172","173","174","175","176"] },
  { key: "climateIssuesAffected", label: "Which of the following climate-related issues have affected you or your household in the past 5 years? (Select all that apply)", type: "checkbox", required: true, neonSurveyFieldId: 40, neonName: "surveyFields[8].value", allowed: ["40","178","179","180","181","182","183","184","185"] },
  { key: "climateIssuesOther", label: "Please specify if you selected \"Other\"", type: "text", required: false, neonSurveyFieldId: 41, neonName: "surveyFields[9].value" },
  { key: "impactFrequency", label: "How often do these climate impacts affect your daily life?", type: "select", required: true, neonSurveyFieldId: 21, neonName: "surveyFields[10].value", allowed: ["99","100","101","102"] },
  { key: "lifeAreasAffected", label: "Which areas of your life have been most affected? (Select up to 3)", type: "checkbox", max: 3, required: true, neonSurveyFieldId: 22, neonName: "surveyFields[11].value", allowed: ["22","104","105","106","107","108","109"] },
  { key: "safetyConfidence", label: "During extreme weather (heat, storms, flooding), how confident are you that you can stay safe?", type: "select", required: true, neonSurveyFieldId: 23, neonName: "surveyFields[12].value", allowed: ["110","111","112","113"] },
  { key: "preparednessBarriers", label: "What makes it harder for you or your community to prepare for or recover from climate events? (Select all that apply)", type: "checkbox", required: true, neonSurveyFieldId: 24, neonName: "surveyFields[13].value", allowed: ["24","115","116","117","118","119","120","121"] },
  { key: "preparednessBarriersOther", label: "Please specify if you selected \"Other\"", type: "text", required: false, neonSurveyFieldId: 25, neonName: "surveyFields[14].value" },
  { key: "mostImpactedGroups", label: "Which groups in your community do you believe are most impacted by climate change? (Select all that apply)", type: "checkbox", required: true, neonSurveyFieldId: 26, neonName: "surveyFields[15].value", allowed: ["26","123","124","125","126","127","128","129"] },
  { key: "cityPriorities", label: "Which actions should the city prioritize FIRST to protect your community? (Select up to 3)", type: "checkbox", max: 3, required: true, neonSurveyFieldId: 27, neonName: "surveyFields[16].value", allowed: ["27","131","132","133","134","135","136","137"] },
  { key: "longTermInvestments", label: "What long-term investments would help your community be more resilient in the future? (Select up to 3)", type: "checkbox", max: 3, required: true, neonSurveyFieldId: 28, neonName: "surveyFields[17].value", allowed: ["28","139","140","141","142","143","144","145"] },
  { key: "longTermInvestmentsOther", label: "Please specify if you selected \"Other\"", type: "text", required: false, neonSurveyFieldId: 29, neonName: "surveyFields[18].value" },
  { key: "concernsHeard", label: "Do you feel your community’s concerns are heard when the city plans for emergencies or climate issues?", type: "select", required: true, neonSurveyFieldId: 30, neonName: "surveyFields[19].value", allowed: ["146","147","148","149"] },
  { key: "communicationPreference", label: "How would you prefer to receive information about climate risks and city plans? (Select all that apply)", type: "checkbox", required: true, neonSurveyFieldId: 31, neonName: "surveyFields[20].value", allowed: ["31","151","152","153","154","155","156","157"] },
  { key: "communicationPreferenceOther", label: "Please specify if you selected \"Other\"", type: "text", required: false, neonSurveyFieldId: 32, neonName: "surveyFields[21].value" },
  { key: "oneChange", label: "What is one change the city could make to better protect your community from climate impacts?", type: "textarea", required: false, neonSurveyFieldId: 33, neonName: "surveyFields[22].value" },
  { key: "planUpdates", label: "Would you like to be informed about the process of creating a Mobile Climate Adaptation Plan?", type: "radio", required: true, neonSurveyFieldId: 34, neonName: "surveyFields[23].value", allowed: ["34","159"] },
  { key: "gpeUpdates", label: "Would you like to stay up to date on GPE happenings, events, and actions?", type: "radio", required: true, neonSurveyFieldId: 36, neonName: "surveyFields[24].value", allowed: ["36","161"] }
];

async function readBody(req: Request): Promise<Json> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ValidationError("Content-Type must be application/json.");
  }
  const body = await req.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    throw new ValidationError("Request body is too large.");
  }
  try {
    return JSON.parse(body);
  } catch (_) {
    throw new ValidationError("Malformed JSON.");
  }
}

class ValidationError extends Error {}

function validatePayload(payload: Json, req: Request) {
  const idempotencyKey = sanitizeText(req.headers.get("idempotency-key") || payload.idempotencyKey, 120);
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(idempotencyKey)) throw new ValidationError("Invalid idempotency key.");
  if (Number(payload.surveyId) !== SURVEY_ID || Number(payload.formId) !== FORM_ID) throw new ValidationError("Invalid survey metadata.");

  const account = (payload.account || {}) as Json;
  const email = normalizeEmail(account.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError("A valid email is required.");

  const answers = (payload.answers || {}) as Record<string, Json>;
  const sanitizedAnswers: Record<string, unknown> = {};
  for (const field of FIELD_DEFS) {
    const answer = answers[field.key] || {};
    let value = (answer as Json).value;
    if (field.type === "checkbox") {
      const rawArray = Array.isArray(value) ? value : [];
      const arrayValue = [...new Set(rawArray.map((item) => sanitizeText(item, 40)))];
      if (field.required && arrayValue.length === 0) throw new ValidationError(`${field.label} is required.`);
      if (field.max && arrayValue.length > field.max) throw new ValidationError(`${field.label} allows no more than ${field.max} selections.`);
      if (field.allowed && arrayValue.some((item) => !field.allowed?.includes(item))) throw new ValidationError(`${field.label} includes an unsupported option.`);
      value = arrayValue;
    } else {
      const stringValue = sanitizeText(value, field.type === "textarea" ? 4_000 : 500);
      if (field.required && !stringValue) throw new ValidationError(`${field.label} is required.`);
      if (field.allowed && stringValue && !field.allowed.includes(stringValue)) throw new ValidationError(`${field.label} includes an unsupported option.`);
      value = stringValue;
    }
    sanitizedAnswers[field.key] = {
      value,
      label: field.label,
      type: field.type,
      required: field.required,
      neonSurveyFieldId: field.neonSurveyFieldId || null,
      neonName: field.neonName
    };
  }

  return {
    idempotencyKey,
    normalizedEmail: email,
    firstName: sanitizeText(account.firstName, 120),
    lastName: sanitizeText(account.lastName, 120),
    phone: sanitizeText(account.phone, 80),
    address: ((account.address || {}) as Json),
    sourceUrl: sanitizeText(payload.sourceUrl, 500),
    submittedAt: sanitizeText(payload.submittedAt, 80),
    sanitizedAnswers
  };
}

function responseConfig() {
  return {
    membershipUrl: getEnv("GPE_MEMBERSHIP_URL", false) || "https://www.girlplusenvironment.org/become-a-member",
    hubLoginUrl: (getEnv("GPE_HUB_LOGIN_URL", false) || "https://members.girlplusenvironment.org").replace(/\/login\/?$/, "")
  };
}

function normalizeSurveyMembershipRequest(rawRequest: unknown, valid: ReturnType<typeof validatePayload>) {
  if (!rawRequest || typeof rawRequest !== "object" || Array.isArray(rawRequest)) return null;
  const request = rawRequest as Json;
  if (request.requested !== true) return null;
  return normalizeMembershipRequest({
    ...request,
    firstName: request.firstName || valid.firstName,
    lastName: request.lastName || valid.lastName,
    email: request.email || valid.normalizedEmail,
    phone: request.phone || valid.phone,
    city: request.city || valid.address.city,
    state: request.state || valid.address.stateOrProvince,
    zip: request.zip || valid.address.zipCode,
    source: FORM_KEY
  }) as Json | null;
}

async function getExistingSubmission(idempotencyKey: string) {
  const res = await supabaseFetch(`neon_climate_survey_submissions?select=*&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`);
  if (!res.ok) throw new Error("Could not check existing submission.");
  const rows = await res.json();
  return rows[0] || null;
}

async function createSubmission(valid: ReturnType<typeof validatePayload>) {
  const payload = {
    idempotency_key: valid.idempotencyKey,
    survey_id: SURVEY_ID,
    form_id: FORM_ID,
    source_url: valid.sourceUrl,
    normalized_email: valid.normalizedEmail,
    first_name: valid.firstName,
    last_name: valid.lastName,
    payload: { account: { firstName: valid.firstName, lastName: valid.lastName, email: valid.normalizedEmail, phone: "[redacted]", address: valid.address }, surveyId: SURVEY_ID, formId: FORM_ID },
    sanitized_answers: valid.sanitizedAnswers,
    status: "received",
    submitted_at: valid.submittedAt || new Date().toISOString()
  };
  const res = await supabaseFetch("neon_climate_survey_submissions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Could not create submission audit record.");
  return (await res.json())[0];
}

async function updateSubmission(id: string, patch: Json) {
  await supabaseFetch(`neon_climate_survey_submissions?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch)
  });
}

async function logRetry(submissionId: string, operation: string, attemptNumber: number, status: string, error?: string) {
  await supabaseFetch("neon_climate_survey_retries", {
    method: "POST",
    body: JSON.stringify({
      submission_id: submissionId,
      operation,
      attempt_number: attemptNumber,
      status,
      safe_error_summary: error || null
    })
  });
}

async function createNeonAccount(valid: ReturnType<typeof validatePayload>) {
  const accountPayload = {
    individualAccount: {
      primaryContact: {
        firstName: valid.firstName || "Survey",
        lastName: valid.lastName || "Respondent",
        email1: valid.normalizedEmail,
        phone1: valid.phone
      },
      addresses: [{
        city: sanitizeText(valid.address.city, 120),
        stateProvince: sanitizeText(valid.address.stateOrProvince, 20),
        zipCode: sanitizeText(valid.address.zipCode, 30),
        addressType: "Home"
      }]
    }
  };
  const result = await neonFetch("/accounts", { method: "POST", body: JSON.stringify(accountPayload) });
  return String((result as Json).id || (result as Json).accountId || ((result as Json).account as Json | undefined)?.id || "");
}

function activityNote(valid: ReturnType<typeof validatePayload>): string {
  return [
    "Mobile Climate Adaptation Plan Survey",
    `Survey ID: ${SURVEY_ID}`,
    `Form ID: ${FORM_ID}`,
    `Email: ${valid.normalizedEmail}`,
    "",
    JSON.stringify(valid.sanitizedAnswers)
  ].join("\n").slice(0, 20_000);
}

async function createNeonActivity(accountId: string, valid: ReturnType<typeof validatePayload>) {
  return await createActivity({
    neonAccountId: accountId,
    subject: "Mobile Climate Adaptation Plan Survey Response",
    type: "Survey",
    note: {
      neonWriteTarget: "activity_fallback_not_native_survey_response",
      surveyId: SURVEY_ID,
      formId: FORM_ID,
      email: valid.normalizedEmail,
      answers: valid.sanitizedAnswers,
      note: activityNote(valid)
    }
  });
}

async function createPendingConversion(submissionId: string, email: string, accountId: string | null) {
  await supabaseFetch("pending_membership_conversions", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      submission_id: submissionId,
      normalized_email: email,
      neon_account_id: accountId,
      membership_url: getEnv("GPE_MEMBERSHIP_URL", false)
    })
  });
}

async function hubProfileFound(email: string, neonAccountId: string | null) {
  if (neonAccountId) {
    const byNeon = await supabaseFetch(`profiles?select=id&neon_account_id=eq.${encodeURIComponent(neonAccountId)}&limit=1`);
    if (byNeon.ok) {
      const rows = await byNeon.json().catch(() => []);
      if (rows[0]?.id) return true;
    }
  }
  const byEmail = await supabaseFetch(`profiles?select=id&email=ilike.${encodeURIComponent(email)}&limit=1`);
  if (!byEmail.ok) return false;
  const rows = await byEmail.json().catch(() => []);
  return Boolean(rows[0]?.id);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);
  let submission: Json | null = null;
  try {
    assertAllowedOrigin(origin);

    const payload = await readBody(req);
    const valid = validatePayload(payload, req);
    const rawMembershipRequest = (payload as Json).membershipRequest;
    const membershipRequested = Boolean(rawMembershipRequest && typeof rawMembershipRequest === "object" && !Array.isArray(rawMembershipRequest) && (rawMembershipRequest as Json).requested === true);
    let membershipRequest: Json | null = null;
    let membershipCreationStatus: MembershipCreationStatus = membershipRequested ? "not_attempted" : "not_requested";
    let membershipFailureMessage = "";
    if (membershipRequested) {
      try {
        membershipRequest = normalizeSurveyMembershipRequest(rawMembershipRequest, valid);
        if (!membershipRequest) membershipCreationStatus = "incomplete";
      } catch (error) {
        membershipCreationStatus = "incomplete";
        membershipFailureMessage = safeError(error);
      }
    }
    const existing = await getExistingSubmission(valid.idempotencyKey);
    if (existing?.membership_outcome) {
      return jsonResponse({
        surveySubmitted: true,
        submissionId: existing.id,
        membershipRequested: Boolean(existing.membership_status_detail?.membershipRequested),
        membershipCreationStatus: existing.membership_creation_status || "not_attempted",
        membershipOutcome: existing.membership_outcome,
        constituentCreated: existing.membership_status_detail?.constituentStatus === "created",
        constituentFound: existing.membership_status_detail?.constituentStatus === "found",
        membershipAttempted: Boolean(existing.membership_status_detail?.membershipAttempted),
        membershipCreated: Boolean(existing.neon_membership_id),
        membershipAlreadyActive: existing.membership_creation_status === "already_active",
        membershipFailed: existing.membership_creation_status === "failed",
        neonAccountId: existing.neon_account_id || null,
        neonMembershipId: existing.neon_membership_id || null,
        membershipEmailQueued: Boolean(existing.membership_email_queued),
        hubInviteQueued: Boolean(existing.hub_invite_queued),
        hubProfileFound: Boolean(existing.membership_status_detail?.hubProfileFound),
        ...responseConfig()
      }, 200, origin);
    }

    submission = existing || await createSubmission(valid);
    let neonAccountId = sanitizeText((payload as Json).storedNeonAccountId, 80);
    let constituentStatus: "created" | "found" | "ambiguous" | "failed" | "not_attempted" = "not_attempted";
    if (!neonAccountId) {
      const matches = await findNeonAccountsByEmail(valid.normalizedEmail);
      const match = resolveAccountMatch(matches, valid.firstName, valid.lastName);
      if (match.status === "ambiguous") {
        constituentStatus = "ambiguous";
        await updateSubmission(String(submission.id), {
          status: "requires_manual_review" satisfies SubmissionStatus,
          membership_outcome: "ambiguous_account" satisfies MembershipOutcome,
          manual_review_reason: "Multiple Neon accounts matched the submitted email.",
          membership_creation_status: membershipCreationStatus,
          membership_status_detail: { membershipRequested, constituentStatus, membershipFailureMessage }
        });
        return jsonResponse({
          surveySubmitted: true,
          submissionId: submission.id,
          membershipRequested,
          membershipCreationStatus,
          membershipOutcome: "ambiguous_account",
          constituentStatus,
          constituentCreated: false,
          constituentFound: false,
          membershipAttempted: false,
          membershipCreated: false,
          membershipAlreadyActive: false,
          membershipFailed: membershipCreationStatus === "failed",
          membershipEmailQueued: false,
          hubInviteQueued: false,
          ...responseConfig()
        }, 200, origin);
      }
      if (match.status === "matched") {
        neonAccountId = match.neonAccountId || "";
        constituentStatus = "found";
      } else {
        neonAccountId = await createNeonAccount(valid);
        constituentStatus = neonAccountId ? "created" : "failed";
      }
    } else {
      constituentStatus = "found";
    }

    if (!neonAccountId) throw new Error("Neon account could not be resolved.");
    let membershipFallbackActivityId = "";
    let membershipFallbackFailureMessage = "";
    if (membershipRequest) {
      try {
        const fallback = await recordMembershipDataFallbackActivity({
          neonAccountId,
          request: { membershipRequest, surveyAnswers: valid.sanitizedAnswers, surveySubmissionId: submission.id },
          source: FORM_KEY,
          reason: "Inline survey membership data safety note before structured membership creation/custom field mapping.",
        });
        membershipFallbackActivityId = fallback.activityId || "";
      } catch (error) {
        membershipFallbackFailureMessage = safeError(error);
        console.error("climate-survey-membership-fallback-activity", membershipFallbackFailureMessage);
      }
    }
    await logRetry(String(submission.id), "neon_activity", Number(submission.neon_sync_attempts || 0) + 1, "started");
    let activitySynced = false;
    let neonActivityId = "";
    let activityFailureMessage = "";
    try {
      neonActivityId = await createNeonActivity(neonAccountId, valid);
      await updateSubmission(String(submission.id), {
        neon_account_id: neonAccountId,
        neon_activity_id: neonActivityId || null,
        neon_sync_attempts: Number(submission.neon_sync_attempts || 0) + 1,
        neon_synced_at: new Date().toISOString(),
        status: "neon_synced" satisfies SubmissionStatus
      });
      activitySynced = true;
      await logRetry(String(submission.id), "neon_activity", Number(submission.neon_sync_attempts || 0) + 1, "succeeded");
    } catch (error) {
      activityFailureMessage = safeError(error);
      await updateSubmission(String(submission.id), {
        neon_account_id: neonAccountId,
        neon_sync_attempts: Number(submission.neon_sync_attempts || 0) + 1,
        status: "neon_sync_pending" satisfies SubmissionStatus,
        last_error_summary: activityFailureMessage
      });
      await logRetry(String(submission.id), "neon_activity", Number(submission.neon_sync_attempts || 0) + 1, "failed", activityFailureMessage);
    }

    let membership = await resolveMembership({
      email: valid.normalizedEmail,
      firstName: valid.firstName,
      lastName: valid.lastName,
      neonAccountId
    });
    let outcome: MembershipOutcome = membership.outcome === "active_member_existing_hub_user" ||
      membership.outcome === "active_member_needs_hub_invite" ||
      membership.outcome === "nonmember" ||
      membership.outcome === "ambiguous_account"
      ? membership.outcome
      : membership.outcome === "lookup_failed"
        ? "submission_saved_neon_sync_pending"
        : "nonmember";
    let status: SubmissionStatus = activitySynced ? "neon_synced" : "neon_sync_pending";
    let neonMembershipId = "";
    let membershipAttempted = false;
    let membershipEmailQueued = false;
    let hubInviteQueued = false;
    let membershipFinalization: Json | null = null;
    let profileFound = await hubProfileFound(valid.normalizedEmail, neonAccountId);
    if (membership.outcome === "active_member_existing_hub_user" || membership.outcome === "active_member_needs_hub_invite") {
      membershipCreationStatus = "already_active";
    } else if (membershipRequested && membershipRequest && membershipCreationStatus !== "incomplete") {
      membershipAttempted = true;
      membershipCreationStatus = "attempted";
      try {
        const membershipResult = await createAndFinalizeMembership({
          neonAccountId,
          email: valid.normalizedEmail,
          request: { membershipRequest, surveySubmissionId: submission.id, source: FORM_KEY },
          source: FORM_KEY,
          submissionId: String(submission.id),
          firstName: valid.firstName
        });
        membershipFinalization = membershipResult;
        membershipCreationStatus = membershipResult.membershipCreationStatus;
        neonMembershipId = membershipResult.membershipId;
        membershipEmailQueued = membershipResult.membershipEmailQueued;
        hubInviteQueued = membershipResult.hubInviteQueued;
        outcome = "active_member_needs_hub_invite";
        membership = { ...membership, outcome, neonAccountId };
        profileFound = await hubProfileFound(valid.normalizedEmail, neonAccountId);
      } catch (error) {
        membershipCreationStatus = "failed";
        membershipFailureMessage = safeError(error);
        outcome = "nonmember";
      }
    }

    if (!membershipFinalization && membership.outcome === "active_member_needs_hub_invite" && membership.neonAccountId) {
      try {
        const invited = await queueHubInvitation({ submissionId: String(submission.id), email: valid.normalizedEmail, neonAccountId: membership.neonAccountId, source: FORM_KEY });
        hubInviteQueued = true;
        status = invited ? "hub_invited" : "hub_invite_pending";
        await updateSubmission(String(submission.id), invited ? { hub_invited_at: new Date().toISOString() } : {});
      } catch (error) {
        outcome = "submission_saved_neon_sync_pending";
        status = "hub_invite_pending";
        await updateSubmission(String(submission.id), { last_error_summary: safeError(error), hub_invite_attempts: Number(submission.hub_invite_attempts || 0) + 1 });
      }
    } else if (membership.outcome === "nonmember" || membership.outcome === "inactive_or_expired_member") {
      outcome = "nonmember";
      await createPendingConversion(String(submission.id), valid.normalizedEmail, neonAccountId);
    }

    await updateSubmission(String(submission.id), {
      membership_outcome: outcome,
      status,
      neon_membership_id: neonMembershipId || null,
      membership_creation_status: membershipCreationStatus,
      membership_email_queued: membershipEmailQueued,
      hub_invite_queued: hubInviteQueued,
      membership_status_detail: {
        membershipRequested,
        neonWriteTarget: "activity_fallback_not_native_survey_response",
        membershipFallbackActivityId: membershipFallbackActivityId || null,
        membershipFallbackFailureMessage,
        constituentStatus,
        membershipAttempted,
        membershipCreated: membershipCreationStatus === "confirmed",
        membershipAlreadyActive: membershipCreationStatus === "already_active",
        membershipFailed: membershipCreationStatus === "failed",
        hubProfileFound: profileFound,
        hubInviteQueued,
        membershipEmailQueued,
        membershipFailureMessage
      }
    });
    const leadActionResult = await recordLeadAction({
      email: valid.normalizedEmail,
      firstName: valid.firstName,
      lastName: valid.lastName,
      phone: valid.phone,
      postalCode: sanitizeText(valid.address.zipCode, 40),
      city: sanitizeText(valid.address.city, 120),
      state: sanitizeText(valid.address.stateOrProvince, 80),
      neonAccountId,
      actionType: "survey_completion",
      actionSlug: "mobile-climate-adaptation-survey",
      provider: "neon_survey",
      providerActionId: `survey:${SURVEY_ID}/form:${FORM_ID}`,
      campaignSlug: "mobile-climate-adaptation",
      sourceUrl: valid.sourceUrl,
      membershipRequest,
      neonSyncStatus: status === "neon_synced" || status === "hub_invited" || status === "hub_invite_pending" ? "succeeded" : status === "neon_sync_pending" ? "pending" : "failed",
      hubIdentityStatus: status === "hub_invited" ? "succeeded" : status === "hub_invite_pending" ? "pending" : "not_attempted",
      pointsStatus: "not_applicable",
      neonActivityId: neonActivityId || null,
      rawPayload: { climateSurveySubmissionId: submission.id, formSubmissionStatus: activitySynced ? "created" : "neon_sync_failed", formRecordId: neonActivityId || null, membershipOutcome: outcome, status, activityFailureMessage, membershipCreationStatus, neonMembershipId, membershipEmailQueued, hubInviteQueued, membershipFailureMessage, membershipFinalization }
    }).catch((error) => console.error("climate-survey-lead-action", safeError(error)));
    await recordPointEventForLeadAction({
      eventType: "SURVEY_COMPLETED",
      email: valid.normalizedEmail,
      leadAction: leadActionResult?.action,
      lead: leadActionResult?.lead,
      source: "neon_climate_survey",
      sourceId: String(submission.id),
      campaignSlug: "mobile-climate-adaptation",
      metadata: {
        surveyId: SURVEY_ID,
        formId: FORM_ID,
        climateSurveySubmissionId: submission.id,
        membershipOutcome: outcome,
        status,
        activityFailureMessage,
        neonWriteTarget: "activity_fallback_not_native_survey_response",
        membershipFallbackActivityId: membershipFallbackActivityId || null,
        membershipFallbackFailureMessage
      }
    }).catch((error) => console.error("climate-survey-point-event", safeError(error)));
    const surveyEmailResult = await sendLifecycleEmail({
      templateKey: "survey-thank-you",
      recipientEmail: valid.normalizedEmail,
      neonAccountId,
      eventType: "survey_completed",
      sourceType: "neon_climate_survey",
      sourceId: String(submission.id),
      idempotencyKey: `survey-thank-you:${submission.id}`,
      category: "public_form_followup",
      variables: {
        firstName: valid.firstName || "there",
        surveyName: "Mobile Climate Survey",
        resultTitle: membershipCreationStatus === "confirmed" || membershipCreationStatus === "already_active"
          ? "Your survey response was received and your membership status is active."
          : "Your survey response was received.",
        resultSummary: membershipRequested && membershipCreationStatus === "failed"
          ? "Membership was not completed from this submission. You can still become a member using the link below."
          : "Use the links below to become a member, invite someone to the Hub, or explore the GPE Community Hub.",
        membershipStatus: membershipCreationStatus === "confirmed"
          ? "confirmed"
          : membershipCreationStatus === "already_active"
            ? "already_active"
            : membershipCreationStatus === "failed"
              ? "failed"
              : "not_requested",
        communityResourcesUrl: "https://www.girlplusenvironment.org/resources",
        membershipUrl: "https://www.girlplusenvironment.org/become-a-member",
        invitePageUrl: "https://members.girlplusenvironment.org/invite/",
        hubUrl: "https://members.girlplusenvironment.org"
      }
    }).catch((error) => {
      console.error("climate-survey-lifecycle-email", safeError(error));
      return { ok: false, status: "failed", deliveryId: null };
    });
    return jsonResponse({
      surveySubmitted: true,
      submissionId: submission.id,
      membershipRequested,
      formSubmissionStatus: activitySynced ? "created" : "neon_sync_failed",
      formRecordId: neonActivityId || null,
      formRecordError: activityFailureMessage || null,
      constituentStatus,
      constituentCreated: constituentStatus === "created",
      constituentFound: constituentStatus === "found",
      membershipAttempted,
      membershipCreationStatus,
      membershipOutcome: membershipCreationStatus === "failed" ? "membership_not_created" : outcome,
      membershipCreated: membershipCreationStatus === "confirmed",
      membershipAlreadyActive: membershipCreationStatus === "already_active",
      membershipFailed: membershipCreationStatus === "failed",
      neonAccountId,
      neonMembershipId: neonMembershipId || null,
      hubProfileFound: profileFound,
      membershipEmailQueued,
      hubInviteQueued,
      surveyEmailAccepted: Boolean(surveyEmailResult.ok && ["sent", "already_sent"].includes(String(surveyEmailResult.status))),
      surveyEmailStatus: surveyEmailResult.status,
      surveyEmailDeliveryId: surveyEmailResult.deliveryId || null,
      neonWriteTarget: "activity_fallback_not_native_survey_response",
      membershipFallbackActivityId: membershipFallbackActivityId || null,
      membershipFallbackFailureMessage,
      membershipFinalization,
      ...responseConfig()
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof ValidationError ? error.message : "Survey submission could not be completed.";
    if (submission?.id) {
      await updateSubmission(String(submission.id), {
        status: "failed" satisfies SubmissionStatus,
        membership_outcome: "failed" satisfies MembershipOutcome,
        last_error_summary: safeError(error)
      }).catch(() => undefined);
    }
    console.error("neon-climate-survey", safeError(error));
    return jsonResponse({ message }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
