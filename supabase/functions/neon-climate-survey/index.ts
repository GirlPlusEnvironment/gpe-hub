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

const MAX_BODY_BYTES = 120_000;
const SURVEY_ID = 2;
const FORM_ID = 47;

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

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = (Deno.env.get("ALLOWED_FORM_ORIGINS") || "").split(",").map((item) => item.trim()).filter(Boolean);
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0] || "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
    "Vary": "Origin"
  };
}

function jsonResponse(body: Json, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
  });
}

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
  const result = await neonFetch("/activities", {
    method: "POST",
    body: JSON.stringify({
      accountId,
      subject: "Mobile Climate Adaptation Plan Survey",
      type: "Survey",
      status: "Completed",
      priority: "Normal",
      note: activityNote(valid),
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10)
    })
  });
  return String((result as Json).id || (result as Json).activityId || "");
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

async function invokeHubInvitation(submissionId: string, email: string, accountId: string): Promise<boolean> {
  const invitationUrl = Deno.env.get("HUB_INVITATION_FUNCTION_URL");
  if (!invitationUrl) {
    await supabaseFetch("hub_invitations", {
      method: "POST",
      body: JSON.stringify({ submission_id: submissionId, neon_account_id: accountId, normalized_email: email, status: "pending" })
    });
    return false;
  }
  const secret = getEnv("HUB_INVITATION_SECRET");
  const res = await fetch(invitationUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
    body: JSON.stringify({ submissionId, email, neonAccountId: accountId })
  });
  if (!res.ok) throw new Error(`Hub invitation workflow failed (${res.status}).`);
  await supabaseFetch("hub_invitations", {
    method: "POST",
    body: JSON.stringify({ submission_id: submissionId, neon_account_id: accountId, normalized_email: email, status: "sent", sent_at: new Date().toISOString() })
  });
  return true;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_FORM_ORIGINS") || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (origin && !allowedOrigins.includes(origin)) return jsonResponse({ message: "Origin is not allowed." }, 403, origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

  let submission: Json | null = null;
  try {
    const payload = await readBody(req);
    const valid = validatePayload(payload, req);
    const existing = await getExistingSubmission(valid.idempotencyKey);
    if (existing?.membership_outcome) {
      return jsonResponse({
        submissionId: existing.id,
        membershipOutcome: existing.membership_outcome,
        membershipUrl: getEnv("GPE_MEMBERSHIP_URL", false),
        hubLoginUrl: getEnv("GPE_HUB_LOGIN_URL", false)
      }, 200, origin);
    }

    submission = existing || await createSubmission(valid);
    let neonAccountId = sanitizeText((payload as Json).storedNeonAccountId, 80);
    if (!neonAccountId) {
      const matches = await findNeonAccountsByEmail(valid.normalizedEmail);
      const match = resolveAccountMatch(matches, valid.firstName, valid.lastName);
      if (match.status === "ambiguous") {
        await updateSubmission(String(submission.id), {
          status: "requires_manual_review" satisfies SubmissionStatus,
          membership_outcome: "ambiguous_account" satisfies MembershipOutcome,
          manual_review_reason: "Multiple Neon accounts matched the submitted email."
        });
        return jsonResponse({ submissionId: submission.id, membershipOutcome: "ambiguous_account" }, 200, origin);
      }
      if (match.status === "matched") {
        neonAccountId = match.neonAccountId || "";
      } else {
        neonAccountId = await createNeonAccount(valid);
      }
    }

    if (!neonAccountId) throw new Error("Neon account could not be resolved.");
    await logRetry(String(submission.id), "neon_activity", Number(submission.neon_sync_attempts || 0) + 1, "started");
    const activityId = await createNeonActivity(neonAccountId, valid);
    await updateSubmission(String(submission.id), {
      neon_account_id: neonAccountId,
      neon_activity_id: activityId || null,
      neon_sync_attempts: Number(submission.neon_sync_attempts || 0) + 1,
      neon_synced_at: new Date().toISOString(),
      status: "neon_synced" satisfies SubmissionStatus
    });
    await logRetry(String(submission.id), "neon_activity", Number(submission.neon_sync_attempts || 0) + 1, "succeeded");

    const membership = await resolveMembership({
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
    let status: SubmissionStatus = "neon_synced";
    if (membership.outcome === "active_member_needs_hub_invite" && membership.neonAccountId) {
      try {
        const invited = await invokeHubInvitation(String(submission.id), valid.normalizedEmail, membership.neonAccountId);
        status = invited ? "hub_invited" : "hub_invite_pending";
      } catch (error) {
        outcome = "submission_saved_neon_sync_pending";
        status = "hub_invite_pending";
        await updateSubmission(String(submission.id), { last_error_summary: safeError(error), hub_invite_attempts: Number(submission.hub_invite_attempts || 0) + 1 });
      }
    } else if (membership.outcome === "nonmember" || membership.outcome === "inactive_or_expired_member") {
      outcome = "nonmember";
      await createPendingConversion(String(submission.id), valid.normalizedEmail, neonAccountId);
    }

    await updateSubmission(String(submission.id), { membership_outcome: outcome, status });
    return jsonResponse({
      submissionId: submission.id,
      membershipOutcome: outcome,
      membershipUrl: getEnv("GPE_MEMBERSHIP_URL", false),
      hubLoginUrl: getEnv("GPE_HUB_LOGIN_URL", false)
    }, 200, origin);
  } catch (error) {
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
