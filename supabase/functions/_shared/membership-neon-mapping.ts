import { createActivity } from "./neon-activity.ts";
import { type Json, neonFetch, safeError } from "./neon-membership.ts";
import { sanitizeText } from "./validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
};

type MappingStatus = "working" | "mapped" | "mapping_failed" | "missing_custom_field_mapping" | "intentionally_ignored";

type MappingRow = {
  frontendField: string;
  sourceKey: string;
  neonDestination: string;
  status: MappingStatus;
  valuePresent: boolean;
  neonRecordType?: "account" | "membership";
  neonFieldId?: string;
  error?: string;
};

const ACCOUNT_FIELD_ENV: Record<string, string> = {
  ageRange: "NEON_MEMBERSHIP_FIELD_AGE_RANGE",
  raceEthnicity: "NEON_MEMBERSHIP_FIELD_RACE_ETHNICITY",
  raceEthnicityOther: "NEON_MEMBERSHIP_FIELD_RACE_ETHNICITY_OTHER",
  climateInterests: "NEON_MEMBERSHIP_FIELD_CLIMATE_INTERESTS",
  communicationPreferences: "NEON_MEMBERSHIP_FIELD_COMMUNICATION_PREFERENCES",
  emailConsent: "NEON_MEMBERSHIP_FIELD_EMAIL_CONSENT",
  smsConsent: "NEON_MEMBERSHIP_FIELD_SMS_CONSENT",
};

const MEMBERSHIP_FIELD_ENV: Record<string, string> = {
  genderIdentity: "NEON_MEMBERSHIP_FIELD_GENDER_IDENTITY",
  genderIdentityOther: "NEON_MEMBERSHIP_FIELD_GENDER_IDENTITY_OTHER",
  interestedInOfficeHours: "NEON_MEMBERSHIP_FIELD_OFFICE_HOURS_INTEREST",
};

const FIELD_ENV: Record<string, string> = {
  ...ACCOUNT_FIELD_ENV,
  ...MEMBERSHIP_FIELD_ENV,
};

const OPTION_ENV: Record<string, string> = {
  ageRange: "NEON_MEMBERSHIP_FIELD_AGE_RANGE_OPTIONS_JSON",
  raceEthnicity: "NEON_MEMBERSHIP_FIELD_RACE_ETHNICITY_OPTIONS_JSON",
  genderIdentity: "NEON_MEMBERSHIP_FIELD_GENDER_IDENTITY_OPTIONS_JSON",
  climateInterests: "NEON_MEMBERSHIP_FIELD_CLIMATE_INTERESTS_OPTIONS_JSON",
  communicationPreferences: "NEON_MEMBERSHIP_FIELD_COMMUNICATION_PREFERENCES_OPTIONS_JSON",
  interestedInOfficeHours: "NEON_MEMBERSHIP_FIELD_OFFICE_HOURS_INTEREST_OPTIONS_JSON",
  emailConsent: "NEON_MEMBERSHIP_FIELD_EMAIL_CONSENT_OPTIONS_JSON",
  smsConsent: "NEON_MEMBERSHIP_FIELD_SMS_CONSENT_OPTIONS_JSON",
};

function canonicalFromRequest(request: Json) {
  const direct = request.canonicalMembership;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) return direct as Json;
  const membershipRequest = request.membershipRequest;
  if (membershipRequest && typeof membershipRequest === "object" && !Array.isArray(membershipRequest)) {
    const canonical = (membershipRequest as Json).canonicalMembership;
    if (canonical && typeof canonical === "object" && !Array.isArray(canonical)) return canonical as Json;
  }
  const nestedRequest = request.request;
  if (nestedRequest && typeof nestedRequest === "object" && !Array.isArray(nestedRequest)) {
    const canonical = (nestedRequest as Json).canonicalMembership;
    if (canonical && typeof canonical === "object" && !Array.isArray(canonical)) return canonical as Json;
  }
  return request;
}

function fieldValuePresent(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return true;
  return sanitizeText(value, 2_000).length > 0;
}

function neonRecordTypeFor(key: string): "account" | "membership" | undefined {
  if (ACCOUNT_FIELD_ENV[key]) return "account";
  if (MEMBERSHIP_FIELD_ENV[key]) return "membership";
  return undefined;
}

function membershipRecordWritesEnabled() {
  return Deno.env.get("NEON_MEMBERSHIP_WRITE_MEMBERSHIP_FIELDS") === "true";
}

function customDestination(key: string, fallbackLabel: string) {
  const configured = Deno.env.get(FIELD_ENV[key]);
  const recordType = neonRecordTypeFor(key) || "account";
  const label = recordType === "membership" ? "Membership" : "Account";
  if (recordType === "membership" && configured && !membershipRecordWritesEnabled()) {
    return `${label} custom field ${configured} (write disabled pending Neon life-membership PATCH support)`;
  }
  return configured ? `${label} custom field ${configured}` : `${label} custom field for ${fallbackLabel}`;
}

function customStatus(key: string): MappingStatus {
  if (MEMBERSHIP_FIELD_ENV[key] && Deno.env.get(MEMBERSHIP_FIELD_ENV[key]) && !membershipRecordWritesEnabled()) {
    return "missing_custom_field_mapping";
  }
  return Deno.env.get(FIELD_ENV[key]) ? "mapped" : "missing_custom_field_mapping";
}

export function membershipMappingReport(request: Json): MappingRow[] {
  const canonical = canonicalFromRequest(request);
  const row = (frontendField: string, sourceKey: string, neonDestination: string, status: MappingStatus): MappingRow => ({
    frontendField,
    sourceKey,
    neonDestination,
    status,
    valuePresent: fieldValuePresent(canonical[sourceKey]),
    neonRecordType: neonRecordTypeFor(sourceKey),
    neonFieldId: FIELD_ENV[sourceKey] ? Deno.env.get(FIELD_ENV[sourceKey]) || undefined : undefined,
  });
  return [
    row("First Name", "firstName", "Individual primary contact firstName", "working"),
    row("Last Name", "lastName", "Individual primary contact lastName", "working"),
    row("Email", "email", "Individual primary contact email1", "working"),
    row("Phone", "phone", "Individual primary contact phone1", "working"),
    row("City", "city", "Individual primary contact address city", "working"),
    row("State", "state", "Individual primary contact address stateProvince", "working"),
    row("Zip", "zip", "Individual primary contact address zipCode", "working"),
    row("Age Range", "ageRange", customDestination("ageRange", "Age Range"), customStatus("ageRange")),
    row("Race/Ethnicity", "raceEthnicity", customDestination("raceEthnicity", "Race/Ethnicity"), customStatus("raceEthnicity")),
    row("Race/Ethnicity Self-description", "raceEthnicityOther", customDestination("raceEthnicityOther", "Race/Ethnicity Self-description"), customStatus("raceEthnicityOther")),
    row("Gender Identity", "genderIdentity", customDestination("genderIdentity", "Gender Identity"), customStatus("genderIdentity")),
    row("Gender Self-description", "genderIdentityOther", customDestination("genderIdentityOther", "Gender Self-description"), customStatus("genderIdentityOther")),
    row("Climate Interests", "climateInterests", customDestination("climateInterests", "Climate Interests"), customStatus("climateInterests")),
    row("Communication Preferences", "communicationPreferences", customDestination("communicationPreferences", "Communication Preferences"), customStatus("communicationPreferences")),
    row("Office Hours Interest", "interestedInOfficeHours", customDestination("interestedInOfficeHours", "Office Hours Interest"), customStatus("interestedInOfficeHours")),
    row("Email Consent", "emailConsent", customDestination("emailConsent", "Email Consent"), customStatus("emailConsent")),
    row("SMS Consent", "smsConsent", customDestination("smsConsent", "SMS Consent"), customStatus("smsConsent")),
    row("Terms/Privacy Consent", "termsConsent", "Internal consent audit only", "intentionally_ignored"),
    row("Eligibility Affirmation", "eligibilityAffirmed", "Internal eligibility audit only", "intentionally_ignored"),
  ];
}

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function stringValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean).join("; ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return sanitizeText(value, 2_000);
}

function optionMapFor(key: string): Record<string, unknown> {
  const raw = OPTION_ENV[key] ? Deno.env.get(OPTION_ENV[key]) : "";
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch (_) {
    return {};
  }
}

function optionEntry(value: unknown): { id: string; name?: string } | null {
  if (typeof value === "string" || typeof value === "number") {
    const id = sanitizeText(value, 80);
    return id ? { id } : null;
  }
  const record = asRecord(value);
  const id = sanitizeText(record.id, 80);
  if (!id) return null;
  const name = sanitizeText(record.name, 200);
  return name ? { id, name } : { id };
}

function customFieldFor(key: string, value: unknown, destination: "account" | "membership") {
  const envMap = destination === "membership" ? MEMBERSHIP_FIELD_ENV : ACCOUNT_FIELD_ENV;
  const fieldId = Deno.env.get(envMap[key]);
  if (!fieldId || !fieldValuePresent(value)) return null;
  const optionMap = optionMapFor(key);
  const values = Array.isArray(value) ? value : [value];
  const mappedOptions = values
    .map((item) => optionEntry(optionMap[String(item)] || optionMap[stringValue(item)]))
    .filter(Boolean) as { id: string; name?: string }[];

  if (Object.keys(optionMap).length > 0) {
    if (mappedOptions.length === 0) {
      throw new Error(`No Neon option mapping configured for ${key}=${stringValue(value)}`);
    }
    return { id: fieldId, optionValues: mappedOptions };
  }

  return { id: fieldId, value: stringValue(value) };
}

function extractAccountCustomFields(account: Json): Json[] {
  const individual = asRecord(account.individualAccount);
  const company = asRecord(account.companyAccount);
  const direct = account.accountCustomFields;
  for (const candidate of [individual.accountCustomFields, company.accountCustomFields, direct]) {
    if (Array.isArray(candidate)) return candidate as Json[];
  }
  return [];
}

function extractMembershipCustomFields(membership: Json): Json[] {
  const candidates = [
    membership.membershipCustomFields,
    membership.customFields,
    asRecord(membership.membership).customFields,
    asRecord(membership.membership).membershipCustomFields,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Json[];
  }
  return [];
}

function customFieldHasValue(field: Json) {
  if (fieldValuePresent(field.value)) return true;
  return Array.isArray(field.optionValues) && field.optionValues.length > 0;
}

function mergeCustomFields(existing: Json[], proposed: Json[], missingOnly: boolean) {
  const byId = new Map<string, Json>();
  existing.forEach((field) => {
    const id = sanitizeText(field.id, 80);
    if (id) byId.set(id, field);
  });
  proposed.forEach((field) => {
    const id = sanitizeText(field.id, 80);
    if (!id) return;
    if (missingOnly && byId.has(id) && customFieldHasValue(byId.get(id) || {})) return;
    byId.set(id, field);
  });
  return Array.from(byId.values());
}

export async function writeMembershipAccountCustomFields(args: {
  neonAccountId: string;
  request: Json;
  missingOnly?: boolean;
  dryRun?: boolean;
}) {
  const canonical = canonicalFromRequest(args.request);
  const baseReport = membershipMappingReport(args.request);
  const proposed: Json[] = [];
  const failed: MappingRow[] = [];

  for (const row of baseReport) {
    if (!ACCOUNT_FIELD_ENV[row.sourceKey] || !row.valuePresent) continue;
    if (!Deno.env.get(ACCOUNT_FIELD_ENV[row.sourceKey])) continue;
    try {
      const field = customFieldFor(row.sourceKey, canonical[row.sourceKey], "account");
      if (field) proposed.push(field);
    } catch (error) {
      failed.push({ ...row, status: "mapping_failed", error: safeError(error) });
    }
  }

  if (args.dryRun) {
    return { proposedFields: proposed, updatedFieldCount: 0, failedMappings: failed };
  }

  if (proposed.length === 0) {
    return { proposedFields: proposed, updatedFieldCount: 0, failedMappings: failed };
  }

  const existingAccount = await neonFetch(`/accounts/${encodeURIComponent(args.neonAccountId)}`, { method: "GET" }, "membership_account_custom_fields_readback") as Json;
  const mergedFields = mergeCustomFields(extractAccountCustomFields(existingAccount), proposed, args.missingOnly !== false);
  await neonFetch(`/accounts/${encodeURIComponent(args.neonAccountId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      individualAccount: {
        accountCustomFields: mergedFields,
      },
    }),
  }, "membership_account_custom_fields_update");
  const readback = await neonFetch(`/accounts/${encodeURIComponent(args.neonAccountId)}`, { method: "GET" }, "membership_account_custom_fields_verify") as Json;
  const readbackFields = extractAccountCustomFields(readback);
  const writtenIds = new Set(proposed.map((field) => sanitizeText(field.id, 80)));
  const verified = readbackFields.filter((field) => writtenIds.has(sanitizeText(field.id, 80)) && customFieldHasValue(field));
  return {
    proposedFields: proposed,
    updatedFieldCount: verified.length,
    failedMappings: failed,
  };
}

export async function writeMembershipRecordCustomFields(args: {
  neonMembershipId: string;
  request: Json;
  missingOnly?: boolean;
  dryRun?: boolean;
}) {
  if (!membershipRecordWritesEnabled()) {
    return { proposedFields: [], updatedFieldCount: 0, failedMappings: [] as MappingRow[] };
  }
  const canonical = canonicalFromRequest(args.request);
  const baseReport = membershipMappingReport(args.request);
  const proposed: Json[] = [];
  const failed: MappingRow[] = [];

  for (const row of baseReport) {
    if (!MEMBERSHIP_FIELD_ENV[row.sourceKey] || !row.valuePresent) continue;
    if (!Deno.env.get(MEMBERSHIP_FIELD_ENV[row.sourceKey])) continue;
    try {
      const field = customFieldFor(row.sourceKey, canonical[row.sourceKey], "membership");
      if (field) proposed.push(field);
    } catch (error) {
      failed.push({ ...row, status: "mapping_failed", error: safeError(error) });
    }
  }

  if (args.dryRun) {
    return { proposedFields: proposed, updatedFieldCount: 0, failedMappings: failed };
  }

  if (proposed.length === 0) {
    return { proposedFields: proposed, updatedFieldCount: 0, failedMappings: failed };
  }

  const existingMembership = await neonFetch(`/memberships/${encodeURIComponent(args.neonMembershipId)}`, { method: "GET" }, "membership_custom_fields_readback") as Json;
  const mergedFields = mergeCustomFields(extractMembershipCustomFields(existingMembership), proposed, args.missingOnly !== false);
  await neonFetch(`/memberships/${encodeURIComponent(args.neonMembershipId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      membershipCustomFields: mergedFields,
    }),
  }, "membership_custom_fields_update");
  const readback = await neonFetch(`/memberships/${encodeURIComponent(args.neonMembershipId)}`, { method: "GET" }, "membership_custom_fields_verify") as Json;
  const readbackFields = extractMembershipCustomFields(readback);
  const writtenIds = new Set(proposed.map((field) => sanitizeText(field.id, 80)));
  const verified = readbackFields.filter((field) => writtenIds.has(sanitizeText(field.id, 80)) && customFieldHasValue(field));
  return {
    proposedFields: proposed,
    updatedFieldCount: verified.length,
    failedMappings: failed,
  };
}

export async function recordMembershipProfileActivity(args: {
  neonAccountId: string;
  membershipId: string;
  request: Json;
  source: string;
}) {
  const canonical = canonicalFromRequest(args.request);
  const mappingReport = membershipMappingReport(args.request);
  let accountStructuredWrite: Awaited<ReturnType<typeof writeMembershipAccountCustomFields>> | null = null;
  let membershipStructuredWrite: Awaited<ReturnType<typeof writeMembershipRecordCustomFields>> | null = null;
  try {
    accountStructuredWrite = await writeMembershipAccountCustomFields({
      neonAccountId: args.neonAccountId,
      request: args.request,
      missingOnly: false,
    });
  } catch (error) {
    accountStructuredWrite = {
      proposedFields: [],
      updatedFieldCount: 0,
      failedMappings: [{ frontendField: "Structured Neon member fields", sourceKey: "accountCustomFields", neonDestination: "Account custom fields", status: "mapping_failed", valuePresent: true, error: safeError(error) }],
    };
  }
  try {
    membershipStructuredWrite = await writeMembershipRecordCustomFields({
      neonMembershipId: args.membershipId,
      request: args.request,
      missingOnly: false,
    });
  } catch (error) {
    membershipStructuredWrite = {
      proposedFields: [],
      updatedFieldCount: 0,
      failedMappings: [{ frontendField: "Structured Neon membership fields", sourceKey: "membershipCustomFields", neonDestination: "Membership custom fields", status: "mapping_failed", valuePresent: true, error: safeError(error) }],
    };
  }
  const activityId = await createActivity({
    neonAccountId: args.neonAccountId,
    subject: "GPE Membership Profile Data",
    type: "Membership",
    note: {
      source: args.source,
      neonMembershipId: args.membershipId,
      collectedMembershipProfile: canonical,
      mappingReport,
      structuredWrite: {
        account: accountStructuredWrite,
        membership: membershipStructuredWrite,
      },
    },
  });
  return {
    activityId,
    mappingReport,
    structuredWrite: {
      account: accountStructuredWrite,
      membership: membershipStructuredWrite,
    },
    missingMappings: [
      ...mappingReport.filter((row) => row.status === "missing_custom_field_mapping" && row.valuePresent),
      ...((accountStructuredWrite?.failedMappings || []) as MappingRow[]),
      ...((membershipStructuredWrite?.failedMappings || []) as MappingRow[]),
    ],
  };
}

export async function recordMembershipDataFallbackActivity(args: {
  neonAccountId: string;
  request: Json;
  source: string;
  reason: string;
}) {
  const canonical = canonicalFromRequest(args.request);
  const mappingReport = membershipMappingReport(args.request);
  const activityId = await createActivity({
    neonAccountId: args.neonAccountId,
    subject: "GPE Membership Data Fallback",
    type: "Membership",
    note: {
      source: args.source,
      reason: args.reason,
      collectedMembershipProfile: canonical,
      mappingReport,
      missingMappings: mappingReport.filter((row) => row.status === "missing_custom_field_mapping" && row.valuePresent),
    },
  });
  return {
    activityId,
    mappingReport,
    missingMappings: mappingReport.filter((row) => row.status === "missing_custom_field_mapping" && row.valuePresent),
  };
}
