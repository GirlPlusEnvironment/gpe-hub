import { createActivity } from "./neon-activity.ts";
import { type Json } from "./neon-membership.ts";
import { sanitizeText } from "./validation.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
};

type MappingStatus = "working" | "activity_recorded" | "missing_custom_field_mapping" | "intentionally_ignored";

type MappingRow = {
  frontendField: string;
  sourceKey: string;
  neonDestination: string;
  status: MappingStatus;
  valuePresent: boolean;
};

const FIELD_ENV: Record<string, string> = {
  ageRange: "NEON_MEMBERSHIP_FIELD_AGE_RANGE",
  raceEthnicity: "NEON_MEMBERSHIP_FIELD_RACE_ETHNICITY",
  raceEthnicityOther: "NEON_MEMBERSHIP_FIELD_RACE_ETHNICITY_OTHER",
  genderIdentity: "NEON_MEMBERSHIP_FIELD_GENDER_IDENTITY",
  genderIdentityOther: "NEON_MEMBERSHIP_FIELD_GENDER_IDENTITY_OTHER",
  climateInterests: "NEON_MEMBERSHIP_FIELD_CLIMATE_INTERESTS",
  communicationPreferences: "NEON_MEMBERSHIP_FIELD_COMMUNICATION_PREFERENCES",
  interestedInOfficeHours: "NEON_MEMBERSHIP_FIELD_OFFICE_HOURS_INTEREST",
  emailConsent: "NEON_MEMBERSHIP_FIELD_EMAIL_CONSENT",
  smsConsent: "NEON_MEMBERSHIP_FIELD_SMS_CONSENT",
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

function customDestination(key: string, fallbackLabel: string) {
  const configured = Deno.env.get(FIELD_ENV[key]);
  return configured ? `Account custom field ${configured}` : `Account custom field for ${fallbackLabel}`;
}

function customStatus(key: string): MappingStatus {
  return Deno.env.get(FIELD_ENV[key]) ? "activity_recorded" : "missing_custom_field_mapping";
}

export function membershipMappingReport(request: Json): MappingRow[] {
  const canonical = canonicalFromRequest(request);
  const row = (frontendField: string, sourceKey: string, neonDestination: string, status: MappingStatus): MappingRow => ({
    frontendField,
    sourceKey,
    neonDestination,
    status,
    valuePresent: fieldValuePresent(canonical[sourceKey]),
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

export async function recordMembershipProfileActivity(args: {
  neonAccountId: string;
  membershipId: string;
  request: Json;
  source: string;
}) {
  const canonical = canonicalFromRequest(args.request);
  const mappingReport = membershipMappingReport(args.request);
  const activityId = await createActivity({
    neonAccountId: args.neonAccountId,
    subject: "GPE Membership Profile Data",
    type: "Membership",
    note: {
      source: args.source,
      neonMembershipId: args.membershipId,
      collectedMembershipProfile: canonical,
      mappingReport,
    },
  });
  return {
    activityId,
    mappingReport,
    missingMappings: mappingReport.filter((row) => row.status === "missing_custom_field_mapping" && row.valuePresent),
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
