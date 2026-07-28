import { type FieldSchema, sanitizeText, ValidationError } from "./validation.ts";

export const MEMBERSHIP_AGE_RANGES = ["under_18", "18_24", "25_34", "35_44", "45_plus", "prefer_not_to_say"];
export const MEMBERSHIP_RACE_ETHNICITY = [
  "black_african_american",
  "latina_latine_hispanic",
  "indigenous_native",
  "asian_pacific_islander",
  "middle_eastern_north_african",
  "multiracial",
  "self_describe"
];
export const MEMBERSHIP_GENDER_IDENTITY = ["girl", "woman", "femme", "gender_expansive", "nonbinary", "self_describe", "prefer_not_to_say"];
export const MEMBERSHIP_CLIMATE_INTERESTS = ["energy_justice", "extreme_weather", "clean_beauty", "climate_mental_health", "green_jobs", "community_advocacy"];
export const MEMBERSHIP_COMMUNICATION_PREFERENCES = ["email", "sms", "events", "office_hours"];

export const CANONICAL_MEMBERSHIP_FIELDS: FieldSchema[] = [
  { key: "eligibilityAffirmed", label: "Eligibility affirmation", required: true, type: "checkbox", allowed: ["yes"] },
  { key: "ageRange", label: "Age range", required: true, type: "select", allowed: MEMBERSHIP_AGE_RANGES },
  { key: "raceEthnicity", label: "Race/ethnicity", required: true, type: "checkbox", allowed: MEMBERSHIP_RACE_ETHNICITY },
  { key: "raceEthnicityOther", label: "Race/ethnicity self-description" },
  { key: "genderIdentity", label: "Gender identity", type: "checkbox", allowed: MEMBERSHIP_GENDER_IDENTITY },
  { key: "genderIdentityOther", label: "Gender self-description" },
  { key: "climateInterests", label: "Climate interests", type: "checkbox", allowed: MEMBERSHIP_CLIMATE_INTERESTS },
  { key: "communicationPreferences", label: "Communication preferences", type: "checkbox", allowed: MEMBERSHIP_COMMUNICATION_PREFERENCES },
  { key: "interestedInOfficeHours", label: "Office Hours interest", type: "checkbox", allowed: ["yes"] },
  { key: "emailConsent", label: "Email consent", required: true, type: "checkbox", allowed: ["yes"] },
  { key: "smsConsent", label: "SMS consent", type: "checkbox", allowed: ["yes"] },
  { key: "termsConsent", label: "Terms/privacy consent", required: true, type: "checkbox", allowed: ["yes"] }
];

function arrayValue(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw.map((item) => sanitizeText(item, 120)).filter(Boolean);
}

function booleanCheckbox(value: unknown): string[] {
  if (value === true) return ["yes"];
  if (value === "true") return ["yes"];
  if (value === "yes") return ["yes"];
  if (Array.isArray(value)) return value.map((item) => sanitizeText(item, 120)).filter(Boolean);
  return [];
}

function assertAllowedList(label: string, values: string[], allowed: string[]) {
  const unsupported = values.filter((value) => !allowed.includes(value));
  if (unsupported.length > 0) throw new ValidationError(`${label} contains an unsupported option.`);
}

export function normalizeCanonicalMembershipInput(input: Record<string, unknown>) {
  const eligibilityAffirmed = booleanCheckbox(input.eligibilityAffirmed);
  if (eligibilityAffirmed.length === 0) throw new ValidationError("Eligibility affirmation is required.");

  const ageRange = sanitizeText(input.ageRange, 80);
  if (!ageRange) throw new ValidationError("Age range is required.");
  if (!MEMBERSHIP_AGE_RANGES.includes(ageRange)) throw new ValidationError("Age range contains an unsupported option.");

  const raceEthnicity = arrayValue(input.raceEthnicity);
  if (raceEthnicity.length === 0) throw new ValidationError("Race/ethnicity is required.");
  assertAllowedList("Race/ethnicity", raceEthnicity, MEMBERSHIP_RACE_ETHNICITY);

  const genderIdentity = arrayValue(input.genderIdentity);
  assertAllowedList("Gender identity", genderIdentity, MEMBERSHIP_GENDER_IDENTITY);

  const climateInterests = arrayValue(input.climateInterests);
  assertAllowedList("Climate interests", climateInterests, MEMBERSHIP_CLIMATE_INTERESTS);

  const communicationPreferences = arrayValue(input.communicationPreferences);
  assertAllowedList("Communication preferences", communicationPreferences, MEMBERSHIP_COMMUNICATION_PREFERENCES);

  const emailConsent = booleanCheckbox(input.emailConsent);
  if (emailConsent.length === 0) throw new ValidationError("Email consent is required.");

  const termsConsent = booleanCheckbox(input.termsConsent);
  if (termsConsent.length === 0) throw new ValidationError("Terms/privacy consent is required.");

  return {
    eligibilityAffirmed: true,
    ageRange,
    raceEthnicity,
    raceEthnicityOther: sanitizeText(input.raceEthnicityOther, 500),
    genderIdentity,
    genderIdentityOther: sanitizeText(input.genderIdentityOther, 500),
    climateInterests,
    communicationPreferences,
    interestedInOfficeHours: booleanCheckbox(input.interestedInOfficeHours).length > 0,
    emailConsent: true,
    smsConsent: booleanCheckbox(input.smsConsent).length > 0,
    termsConsent: true
  };
}

export function normalizeMembershipRequest(request: unknown) {
  if (!request || typeof request !== "object" || Array.isArray(request)) return null;
  const raw = request as Record<string, unknown>;
  if (raw.requested !== true) return null;
  if (raw.consent !== true) throw new ValidationError("Please confirm membership consent before continuing.");
  return {
    ...raw,
    canonicalMembership: normalizeCanonicalMembershipInput(raw)
  };
}
