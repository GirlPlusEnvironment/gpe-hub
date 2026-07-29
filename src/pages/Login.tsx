import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Megaphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampButton, Sticker, Tape } from "@/components/camp/CampDesign";
import { useAuth } from "@/hooks/useAuth";
import {
  getSignupErrorMessage,
  normalizeUsername,
  USERNAME_PATTERN,
  type SignupErrorState,
} from "@/lib/auth";
import {
  checkNeonMembership,
  enrollGpeMembership,
  getMembershipGateMessage,
  GPE_MEMBERSHIP_URL,
  MEMBERSHIP_SYNC_WARNING_MESSAGE,
  MEMBERSHIP_SYNC_WARNING_STORAGE_KEY,
  requestHubAccountActivation,
  type MembershipCheckResult,
  type MembershipEnrollmentFields,
  type MembershipOutcome,
} from "@/lib/membership";
import { AuthEmailNotice } from "@/components/AuthEmailNotice";
import { MembershipRequiredPage, type MembershipRequiredVariant } from "@/components/MembershipRequiredPage";
import type { Profile } from "@/contexts/auth-context";

type AuthMode = "login" | "signup" | "reset";
type SignupStage = "lookup" | "options" | "membership" | "account";
type SignupAccessState = "active" | "membership_pending";

const SIGNUP_USERNAME_HELP = "3-20 characters: lowercase letters, numbers, dots, hyphens, or underscores.";
const ACTIVATION_SENT_MESSAGE =
  "If that email belongs to an active GPE member, we’ll send secure Hub access instructions.";
const LOGIN_CREDENTIALS_MESSAGE =
  "We couldn’t sign you in with those credentials. Use Activate or reset Hub access if you need a new password or account setup link.";
const GRACE_DAYS = 7;

const AGE_OPTIONS = [
  ["under_18", "Under 18"],
  ["18_24", "18-24"],
  ["25_34", "25-34"],
  ["35_44", "35-44"],
  ["45_plus", "45+"],
  ["prefer_not_to_say", "Prefer not to say"],
];

const RACE_OPTIONS = [
  ["black_african_american", "Black or African American"],
  ["latina_latine_hispanic", "Latina, Latine, or Hispanic"],
  ["indigenous_native", "Indigenous or Native"],
  ["asian_pacific_islander", "Asian or Pacific Islander"],
  ["middle_eastern_north_african", "Middle Eastern or North African"],
  ["multiracial", "Multiracial"],
  ["self_describe", "Self-describe"],
];

const GENDER_OPTIONS = [
  ["girl", "Girl"],
  ["woman", "Woman"],
  ["femme", "Femme"],
  ["gender_expansive", "Gender expansive"],
  ["nonbinary", "Nonbinary"],
  ["self_describe", "Self-describe"],
  ["prefer_not_to_say", "Prefer not to say"],
];

const INTEREST_OPTIONS = [
  ["energy_justice", "Energy justice"],
  ["extreme_weather", "Extreme weather"],
  ["clean_beauty", "Clean beauty"],
  ["climate_mental_health", "Climate mental health"],
  ["green_jobs", "Green jobs"],
  ["community_advocacy", "Community advocacy"],
];

const COMMUNICATION_OPTIONS = [
  ["email", "Email"],
  ["sms", "Text messages"],
  ["events", "Events"],
  ["office_hours", "Office Hours"],
];

const membershipVariantForOutcome = (
  outcome: MembershipOutcome | null | undefined,
  membership?: MembershipCheckResult | null,
): MembershipRequiredVariant | null => {
  switch (outcome) {
    case "inactive_or_expired_member":
      return "expired";
    case "ambiguous_account":
      return "manual_review";
    case "lookup_failed":
      return "service_error";
    default:
      return membership?.hubAccess === "membership_required" ? "nonmember" : null;
  }
};

const splitDisplayName = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isPendingProfileAllowed = (profile: Profile | null | undefined) => {
  if (!profile || profile.account_status === "deactivated") return false;
  if (profile.membership_access_state !== "membership_pending") return false;
  if (!profile.membership_grace_expires_at) return true;
  return new Date(profile.membership_grace_expires_at).getTime() > Date.now();
};

const CheckboxGroup = ({
  label,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  options: string[][];
  value: string[];
  onChange: (nextValue: string[]) => void;
  required?: boolean;
}) => (
  <fieldset className="space-y-3">
    <legend className="text-xs font-bold uppercase">
      {label} {required ? <span className="text-red-700">*</span> : null}
    </legend>
    <div className="grid gap-2">
      {options.map(([optionValue, optionLabel]) => (
        <label key={optionValue} className="flex items-start gap-3 rounded-2xl border-2 border-black bg-white p-3 text-sm font-bold">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-gpe-pink"
            checked={value.includes(optionValue)}
            onChange={(event) => {
              onChange(
                event.target.checked
                  ? [...value, optionValue]
                  : value.filter((item) => item !== optionValue),
              );
            }}
          />
          <span>{optionLabel}</span>
        </label>
      ))}
    </div>
  </fieldset>
);

const Login = () => {
  const {
    signIn,
    signUp,
    signOut,
    resendConfirmation,
    refreshProfile,
    user,
    loading,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedMode = params.get("mode");
  const returnPath =
    typeof location.state?.from === "string" && location.state.from.startsWith("/")
      ? location.state.from
      : "/";

  const [mode, setMode] = useState<AuthMode>(
    requestedMode === "signup" ? "signup" : requestedMode === "reset" ? "reset" : "login",
  );
  const [signupStage, setSignupStage] = useState<SignupStage>("lookup");
  const [signupMembership, setSignupMembership] = useState<MembershipCheckResult | null>(null);
  const [signupAccessState, setSignupAccessState] = useState<SignupAccessState | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [memberFirstName, setMemberFirstName] = useState("");
  const [memberLastName, setMemberLastName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [raceEthnicity, setRaceEthnicity] = useState<string[]>([]);
  const [raceEthnicityOther, setRaceEthnicityOther] = useState("");
  const [genderIdentity, setGenderIdentity] = useState<string[]>([]);
  const [genderIdentityOther, setGenderIdentityOther] = useState("");
  const [climateInterests, setClimateInterests] = useState<string[]>([]);
  const [communicationPreferences, setCommunicationPreferences] = useState<string[]>(["email"]);
  const [eligibilityAffirmed, setEligibilityAffirmed] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailNoticeKind, setEmailNoticeKind] = useState<"signup" | "reset" | "resend" | null>(null);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [signupErrorKind, setSignupErrorKind] = useState<SignupErrorState | null>(null);
  const [membershipGate, setMembershipGate] = useState<{
    variant: MembershipRequiredVariant;
    membership: MembershipCheckResult | null;
    message: string | null;
  } | null>(null);

  useEffect(() => {
    if (!loading && user && !isSubmitting) {
      navigate(returnPath, { replace: true });
    }
  }, [isSubmitting, loading, user, navigate, returnPath]);

  useEffect(() => {
    const nextMode =
      requestedMode === "signup" ? "signup" : requestedMode === "reset" ? "reset" : "login";
    setMode(nextMode);
    setSignupStage("lookup");
    setSignupMembership(null);
    setSignupAccessState(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmailNoticeKind(null);
    setSignupErrorKind(null);
    setShowResendConfirmation(false);
    setConfirmPassword("");
    setMembershipGate(null);
  }, [requestedMode]);

  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const usernameError =
    username.trim().length === 0
      ? null
      : USERNAME_PATTERN.test(normalizedUsername)
      ? null
      : SIGNUP_USERNAME_HELP;

  const setAuthMode = (nextMode: Exclude<AuthMode, "reset"> | "reset") => {
    const nextSearch =
      nextMode === "login" ? "" : nextMode === "signup" ? "?mode=signup" : "?mode=reset";
    navigate(`/login${nextSearch}`, { replace: location.pathname === "/login" });
  };

  const resetSignupDecision = () => {
    setSignupStage("lookup");
    setSignupMembership(null);
    setSignupAccessState(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSignupLookup = async () => {
    const nextEmail = normalizeEmail(email);
    if (!nextEmail) {
      setErrorMessage("Enter your email address first.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setMembershipGate(null);

    try {
      const nameParts = splitDisplayName(displayName);
      const membershipResult = await checkNeonMembership({
        email: nextEmail,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
      });

      const membership = membershipResult.error
        ? {
            matched: false,
            isActiveMember: false,
            neonAccountId: null,
            membershipStatus: null,
            membershipLevel: null,
            membershipStartAt: null,
            membershipEndAt: null,
            hubAccess: "unknown" as const,
            outcome: "lookup_failed" as const,
            publicState: "lookup_unavailable" as const,
            hubUserLinked: false,
            requiresManualReview: false,
            reason: membershipResult.error,
          }
        : membershipResult.data;

      setSignupMembership(membership ?? null);

      if (membership?.outcome === "ambiguous_account") {
        setMembershipGate({
          variant: "manual_review",
          membership,
          message: getMembershipGateMessage("ambiguous_account"),
        });
        return;
      }

      if (membership?.outcome === "active_member_existing_hub_user") {
        setSuccessMessage("We found your active membership and existing Hub account. Sign in to continue.");
        setMode("login");
        return;
      }

      if (membership?.outcome === "active_member_needs_hub_invite" || membership?.isActiveMember) {
        setSignupAccessState("active");
        setSignupStage("account");
        setSuccessMessage("We found your active GPE membership. Create your Hub login and we’ll connect it.");
        return;
      }

      setSignupStage("options");
      setSuccessMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueWithoutMembership = () => {
    setSignupAccessState("membership_pending");
    setSignupStage("account");
    setSuccessMessage(
      `You can create a Hub account now. Membership is still required for long-term access, and your grace period lasts ${GRACE_DAYS} days.`,
    );
  };

  const handleMembershipEnroll = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const nextEmail = normalizeEmail(email);
    if (!nextEmail) {
      setErrorMessage("Enter your email address first.");
      setSignupStage("lookup");
      return;
    }
    if (!memberFirstName.trim() || !memberLastName.trim()) {
      setErrorMessage("First and last name are required for membership.");
      return;
    }
    if (!ageRange || raceEthnicity.length === 0 || !eligibilityAffirmed || !emailConsent || !termsConsent) {
      setErrorMessage("Complete the required membership fields before continuing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const fields: MembershipEnrollmentFields = {
        firstName: memberFirstName.trim(),
        lastName: memberLastName.trim(),
        email: nextEmail,
        phone: memberPhone.trim(),
        eligibilityAffirmed: eligibilityAffirmed ? ["yes"] : [],
        ageRange,
        raceEthnicity,
        raceEthnicityOther,
        genderIdentity,
        genderIdentityOther,
        climateInterests,
        communicationPreferences,
        interestedInOfficeHours: communicationPreferences.includes("office_hours") ? ["yes"] : [],
        emailConsent: emailConsent ? ["yes"] : [],
        smsConsent: smsConsent ? ["yes"] : [],
        termsConsent: termsConsent ? ["yes"] : [],
        consent: ["consent"],
      };
      const enrollment = await enrollGpeMembership({
        idempotencyKey: `hub-signup-membership:${nextEmail}:${Date.now()}`,
        fields,
      });

      if (enrollment.error) {
        setErrorMessage(enrollment.error);
        return;
      }

      if (enrollment.data?.requiresManualReview) {
        setMembershipGate({
          variant: "manual_review",
          membership: null,
          message: "We saved your membership request, but Team GPE needs to review it before Hub access can continue.",
        });
        return;
      }

      const name = `${memberFirstName.trim()} ${memberLastName.trim()}`.trim();
      if (!displayName.trim()) setDisplayName(name);
      setSignupMembership({
        matched: true,
        isActiveMember: true,
        neonAccountId: enrollment.data?.neonAccountId ?? null,
        membershipStatus: "active",
        membershipLevel: null,
        membershipStartAt: null,
        membershipEndAt: null,
        hubAccess: "invite_required",
        outcome: "active_member_needs_hub_invite",
        publicState: "neon_member_needs_hub_activation",
        hubUserLinked: false,
        requiresManualReview: false,
      });
      setSignupAccessState("active");
      setSignupStage("account");
      setSuccessMessage("Membership confirmed. Create your Hub login to finish onboarding.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmailNoticeKind(null);
    setSignupErrorKind(null);
    setMembershipGate(null);

    if (mode === "signup") {
      if (signupStage !== "account" || !signupAccessState) {
        await handleSignupLookup();
        return;
      }

      if (confirmPassword !== password) {
        setErrorMessage("Passwords must match.");
        return;
      }

      if (usernameError) {
        setErrorMessage(usernameError);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const { error, user: signedInUser, profile: signedInProfile } = await signIn({ email, password });
        if (error) {
          setErrorMessage(LOGIN_CREDENTIALS_MESSAGE);
          return;
        }

        const membershipResult = await checkNeonMembership({
          email: signedInUser?.email || email,
          firstName: signedInProfile?.first_name || "",
          lastName: signedInProfile?.last_name || "",
        });
        if (membershipResult.error) {
          console.warn("Membership lookup failed after authentication", membershipResult.error);
          const refreshedProfile = await refreshProfile();
          if (
            refreshedProfile?.member_status === "active" ||
            refreshedProfile?.membership_access_state === "active" ||
            isPendingProfileAllowed(refreshedProfile)
          ) {
            window.localStorage.setItem(MEMBERSHIP_SYNC_WARNING_STORAGE_KEY, MEMBERSHIP_SYNC_WARNING_MESSAGE);
            navigate(returnPath, { replace: true });
            return;
          }
          await signOut();
          setMembershipGate({
            variant: "service_error",
            membership: null,
            message: MEMBERSHIP_SYNC_WARNING_MESSAGE,
          });
          return;
        }

        const loginMembership = membershipResult.data;
        if (loginMembership?.outcome === "lookup_failed") {
          console.warn("Membership lookup returned lookup_failed after authentication", loginMembership.reason);
        }

        const refreshedProfile = await refreshProfile();

        if (
          loginMembership?.outcome === "active_member_existing_hub_user" ||
          loginMembership?.hubAccess === "allowed" ||
          refreshedProfile?.member_status === "active" ||
          refreshedProfile?.membership_access_state === "active" ||
          isPendingProfileAllowed(refreshedProfile)
        ) {
          navigate(returnPath, { replace: true });
          return;
        }

        await signOut();
        const variant = membershipVariantForOutcome(loginMembership?.outcome ?? "lookup_failed", loginMembership);
        if (variant) {
          setMembershipGate({
            variant,
            membership: loginMembership,
            message: getMembershipGateMessage(loginMembership?.outcome ?? "lookup_failed"),
          });
        } else {
          setErrorMessage("GPE Hub access requires an active GPE membership. Become a member to keep access.");
        }
        return;
      }

      if (mode === "reset") {
        const { error, data } = await requestHubAccountActivation({ email });
        if (error) {
          setErrorMessage(error);
          return;
        }
        setSuccessMessage(data?.message || ACTIVATION_SENT_MESSAGE);
        setEmailNoticeKind("reset");
        return;
      }

      const result = await signUp({
        email: normalizeEmail(email),
        password,
        displayName,
        username: normalizedUsername,
        membershipAccessState: signupAccessState,
        neonAccountId: signupMembership?.neonAccountId ?? null,
        membershipLevel: signupMembership?.membershipLevel ?? null,
        membershipStartDate: signupMembership?.membershipStartAt ?? null,
        membershipEndDate: signupMembership?.membershipEndAt ?? null,
      });

      if (result.error) {
        setSignupErrorKind(result.errorKind ?? "signup_failed");
        setErrorMessage(getSignupErrorMessage(result.errorKind ?? "signup_failed"));
        setShowResendConfirmation(
          result.errorKind === "confirmation_email_failed" ||
            result.errorKind === "email_exists" ||
            result.errorKind === "temporary_email_failure",
        );
        return;
      }

      setSuccessMessage(
        signupAccessState === "active"
          ? "Your GPE membership is confirmed. Check your inbox to confirm your account, then return here to sign in."
          : `Account created. Check your inbox to confirm your account. You’ll have ${GRACE_DAYS} days to complete membership after your first login.`,
      );
      setEmailNoticeKind("signup");
      setShowResendConfirmation(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setErrorMessage("Enter your email address first so we know where to resend the confirmation email.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await resendConfirmation(email);
      if (error) {
        setErrorMessage(error);
        return;
      }

      setSuccessMessage("Confirmation email sent again.");
      setEmailNoticeKind("resend");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseAnotherEmail = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setMembershipGate(null);
    resetSignupDecision();
  };

  const handleActivateHub = () => {
    setMembershipGate(null);
    setAuthMode("reset");
  };

  const handleRequestActivation = async () => {
    if (!email.trim()) {
      setErrorMessage("Enter your email address first so we know where to send Hub access instructions.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmailNoticeKind(null);

    try {
      const { error, data } = await requestHubAccountActivation({ email });
      if (error) {
        setErrorMessage(error);
        return;
      }
      setSuccessMessage(data?.message || ACTIVATION_SENT_MESSAGE);
      setEmailNoticeKind("reset");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSignupLookup = () => (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-bold uppercase">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (signupStage !== "lookup") resetSignupDecision();
          }}
          placeholder="you@gpe.org"
          required
        />
      </div>
      <CampButton type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Checking Membership..." : "Check Membership"}
      </CampButton>
    </form>
  );

  const renderSignupOptions = () => (
    <div className="mt-8 space-y-5">
      <div className="rounded-[1.25rem] border-[3px] border-black bg-gpe-yellow p-5 text-sm font-bold text-black">
        We couldn’t find an active Girl Plus Environment membership associated with this email.
      </div>
      <button
        type="button"
        className="gpe-card gpe-hover-lift w-full bg-white p-5 text-left"
        onClick={() => {
          const nameParts = splitDisplayName(displayName);
          setMemberFirstName((current) => current || nameParts.firstName);
          setMemberLastName((current) => current || nameParts.lastName);
          setSignupStage("membership");
        }}
      >
        <Sticker accent="pink" rotate="none">Primary</Sticker>
        <h3 className="mt-4 font-header text-2xl uppercase">Become a Member</h3>
        <p className="mt-2 text-sm font-bold text-black/70">
          Create your free GPE membership here, then continue directly into Hub account setup.
        </p>
      </button>
      <button
        type="button"
        className="gpe-card gpe-hover-lift w-full bg-white p-5 text-left"
        onClick={continueWithoutMembership}
      >
        <Sticker accent="cyan" rotate="none">Secondary</Sticker>
        <h3 className="mt-4 font-header text-2xl uppercase">Continue Without Membership</h3>
        <p className="mt-2 text-sm font-bold text-black/70">
          You can explore the Hub now. Membership is required to keep long-term access.
        </p>
      </button>
      <CampButton type="button" variant="outline" className="w-full" onClick={resetSignupDecision}>
        Use Another Email
      </CampButton>
    </div>
  );

  const renderMembershipEnrollment = () => (
    <form onSubmit={handleMembershipEnroll} className="mt-8 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="memberFirstName" className="text-xs font-bold uppercase">First Name</Label>
          <Input id="memberFirstName" value={memberFirstName} onChange={(event) => setMemberFirstName(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="memberLastName" className="text-xs font-bold uppercase">Last Name</Label>
          <Input id="memberLastName" value={memberLastName} onChange={(event) => setMemberLastName(event.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="memberEmail" className="text-xs font-bold uppercase">Email</Label>
        <Input id="memberEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="memberPhone" className="text-xs font-bold uppercase">Phone <span className="text-black/50">Optional</span></Label>
        <Input id="memberPhone" type="tel" value={memberPhone} onChange={(event) => setMemberPhone(event.target.value)} />
      </div>
      <label className="flex items-start gap-3 rounded-2xl border-2 border-black bg-white p-3 text-sm font-bold">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-gpe-pink" checked={eligibilityAffirmed} onChange={(event) => setEligibilityAffirmed(event.target.checked)} required />
        <span>I affirm that I am eligible for Girl Plus Environment membership.</span>
      </label>
      <div className="space-y-2">
        <Label htmlFor="ageRange" className="text-xs font-bold uppercase">Age Range <span className="text-red-700">*</span></Label>
        <select
          id="ageRange"
          className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          value={ageRange}
          onChange={(event) => setAgeRange(event.target.value)}
          required
        >
          <option value="">Select one</option>
          {AGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <CheckboxGroup label="Race / Ethnicity" options={RACE_OPTIONS} value={raceEthnicity} onChange={setRaceEthnicity} required />
      {raceEthnicity.includes("self_describe") ? (
        <Input value={raceEthnicityOther} onChange={(event) => setRaceEthnicityOther(event.target.value)} placeholder="Self-description" />
      ) : null}
      <CheckboxGroup label="Gender Identity" options={GENDER_OPTIONS} value={genderIdentity} onChange={setGenderIdentity} />
      {genderIdentity.includes("self_describe") ? (
        <Input value={genderIdentityOther} onChange={(event) => setGenderIdentityOther(event.target.value)} placeholder="Self-description" />
      ) : null}
      <CheckboxGroup label="Climate Interests" options={INTEREST_OPTIONS} value={climateInterests} onChange={setClimateInterests} />
      <CheckboxGroup label="Communication Preferences" options={COMMUNICATION_OPTIONS} value={communicationPreferences} onChange={setCommunicationPreferences} />
      <label className="flex items-start gap-3 rounded-2xl border-2 border-black bg-white p-3 text-sm font-bold">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-gpe-pink" checked={emailConsent} onChange={(event) => setEmailConsent(event.target.checked)} required />
        <span>I agree to receive GPE membership emails.</span>
      </label>
      <label className="flex items-start gap-3 rounded-2xl border-2 border-black bg-white p-3 text-sm font-bold">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-gpe-pink" checked={smsConsent} onChange={(event) => setSmsConsent(event.target.checked)} />
        <span>I agree to receive optional text messages from GPE.</span>
      </label>
      <label className="flex items-start gap-3 rounded-2xl border-2 border-black bg-white p-3 text-sm font-bold">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-gpe-pink" checked={termsConsent} onChange={(event) => setTermsConsent(event.target.checked)} required />
        <span>I agree to the membership terms and privacy policy.</span>
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <CampButton type="button" variant="outline" className="flex-1" onClick={() => setSignupStage("options")}>
          Back
        </CampButton>
        <CampButton type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Creating Membership..." : "Create Membership"}
        </CampButton>
      </div>
    </form>
  );

  const renderSignupAccount = () => (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4 text-sm font-bold text-black">
        {signupAccessState === "active"
          ? "Membership confirmed. Finish creating your Hub login."
          : "Membership pending. Finish creating your Hub login and complete membership within seven days."}
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName" className="text-xs font-bold uppercase">
          Display Name <span className="text-black/50">Optional</span>
        </Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="How should the community know you?"
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username" className="text-xs font-bold uppercase">
          Username <span className="text-black/50">Optional</span>
        </Label>
        <Input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="your.handle"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="username-help"
        />
        <p id="username-help" className={`text-xs font-bold ${usernameError ? "text-red-700" : "text-black/60"}`}>
          {usernameError || SIGNUP_USERNAME_HELP}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-bold uppercase">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs font-bold uppercase">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required minLength={8} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase">Confirm Password</Label>
        <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm your password" required minLength={8} />
      </div>
      <CampButton type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creating Account..." : "Create Hub Account"}
      </CampButton>
      <CampButton type="button" variant="outline" className="w-full" onClick={resetSignupDecision}>
        Start Over
      </CampButton>
    </form>
  );

  return (
    <div className="gpe-page md:pl-0">
      <div className="grid min-h-screen md:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-black p-12 text-white md:flex md:flex-col md:items-center md:justify-center">
          <div className="gpe-pattern absolute inset-0 opacity-30" />
          <div className="relative z-10 max-w-xl text-center">
            <img
              src="/gpe-hub-icon.png"
              alt="GPE Hub"
              className="gpe-border mx-auto mb-10 max-h-64 w-full max-w-[220px] rounded-[2rem] bg-white object-contain p-4 shadow-gpe"
            />
            <Tape className="mb-5">Member Hub</Tape>
            <h1 className="font-header text-6xl uppercase leading-none md:text-7xl">
              Hey, GPE Community!
            </h1>
            <p className="mt-6 text-2xl font-bold">
              Welcome to your environmental justice hub. Membership keeps the room open, but you can start your account first.
            </p>
          </div>
          <Megaphone className="absolute bottom-10 left-10 h-28 w-28 text-white/20" />
        </section>

        <section className="flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md">
            <div className="mb-8 grid grid-cols-2 gap-4">
              <CampButton
                type="button"
                variant={mode === "login" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setAuthMode("login")}
              >
                Log In
              </CampButton>
              <CampButton
                type="button"
                variant={mode === "signup" ? "secondary" : "outline"}
                className="flex-1"
                onClick={() => setAuthMode("signup")}
              >
                Sign Up
              </CampButton>
            </div>

            <div className="gpe-card gpe-paper p-8 md:p-10">
              {membershipGate ? (
                <MembershipRequiredPage
                  variant={membershipGate.variant}
                  email={email}
                  membership={membershipGate.membership}
                  returnPath={returnPath}
                  onActivateHub={handleActivateHub}
                  onResendInvitation={handleActivateHub}
                  onUseAnotherEmail={handleUseAnotherEmail}
                  onRetry={() => {
                    setMembershipGate(null);
                    setErrorMessage(null);
                  }}
                />
              ) : (
                <>
                  {mode === "reset" && (
                    <button
                      type="button"
                      className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase underline"
                      onClick={() => setAuthMode("login")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Login
                    </button>
                  )}

                  <Sticker accent={mode === "signup" ? "cyan" : mode === "reset" ? "yellow" : "pink"} className="mb-5">
                    {mode === "login" ? "Login" : mode === "signup" ? "Join" : "Reset"}
                  </Sticker>
                  <h2 className="gpe-heading text-4xl">
                    {mode === "login"
                      ? "Welcome Back!"
                      : mode === "signup"
                      ? "Create Your Hub Account"
                      : "Reset Password"}
                  </h2>
                  <p className="mt-3 text-sm font-bold text-black/70">
                    {mode === "login" && "Enter your account details to access the Hub."}
                    {mode === "signup" && "First, we’ll check whether your GPE membership is already connected to this email."}
                    {mode === "reset" && "Enter your email and we’ll send secure Hub access instructions."}
                  </p>

                  {errorMessage && (
                    <div
                      className="mt-6 rounded-[1.25rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700"
                      role="alert"
                    >
                      {errorMessage}
                    </div>
                  )}

                  {successMessage && (
                    <div
                      className="mt-6 rounded-[1.25rem] border-[3px] border-green-600 bg-green-100 p-4 text-sm font-bold text-green-700"
                      role="status"
                    >
                      <CheckCircle2 className="mr-2 inline h-4 w-4" />
                      {successMessage}
                      {emailNoticeKind && <AuthEmailNotice kind={emailNoticeKind} />}
                    </div>
                  )}

                  {mode === "signup" ? (
                    signupStage === "lookup" ? renderSignupLookup() :
                    signupStage === "options" ? renderSignupOptions() :
                    signupStage === "membership" ? renderMembershipEnrollment() :
                    renderSignupAccount()
                  ) : (
                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-bold uppercase">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@gpe.org"
                          required
                        />
                      </div>

                      {mode !== "reset" && (
                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-xs font-bold uppercase">
                            Password
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Enter your password"
                            required
                            minLength={8}
                          />
                        </div>
                      )}

                      <CampButton type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                        {isSubmitting
                          ? mode === "login"
                            ? "Signing In..."
                            : "Sending Reset Email..."
                          : mode === "login"
                          ? "Log In"
                          : "Send Reset Link"}
                      </CampButton>
                    </form>
                  )}

                  <div className="mt-6 flex flex-col gap-3 text-sm font-bold md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      className="text-left underline"
                      onClick={() => setAuthMode(mode === "signup" ? "login" : "signup")}
                    >
                      {mode === "signup"
                        ? "Already registered?"
                        : mode === "reset"
                        ? "Need an account?"
                        : "Need an account?"}
                    </button>

                    {mode === "login" && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-black/60 underline"
                        onClick={() => setAuthMode("reset")}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Forgot password?
                      </button>
                    )}
                  </div>

                  {mode === "login" && email.trim() && (
                    <div className="mt-5 border-t-[3px] border-black pt-5">
                      <CampButton
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleRequestActivation}
                        disabled={isSubmitting}
                      >
                        Activate or Reset Hub Access
                      </CampButton>
                    </div>
                  )}

                  {showResendConfirmation && email.trim() && (
                    <div className="mt-5 border-t-[3px] border-black pt-5">
                      <p className="text-xs font-bold uppercase text-black/60">
                        Need another confirmation email?
                      </p>
                      <CampButton
                        type="button"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={handleResendConfirmation}
                        disabled={isSubmitting}
                      >
                        Resend Confirmation Email
                      </CampButton>
                      {signupErrorKind === "confirmation_email_failed" && (
                        <p className="mt-2 text-xs font-bold text-black/60">
                          Use the same email address you entered above.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
