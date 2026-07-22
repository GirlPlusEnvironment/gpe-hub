import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Megaphone } from "lucide-react";
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
  getMembershipGateMessage,
  MEMBERSHIP_SYNC_WARNING_STORAGE_KEY,
  type MembershipCheckResult,
  type MembershipOutcome,
} from "@/lib/membership";
import { AuthEmailNotice } from "@/components/AuthEmailNotice";
import { MembershipRequiredPage, type MembershipRequiredVariant } from "@/components/MembershipRequiredPage";

type AuthMode = "login" | "signup" | "reset";

const SIGNUP_USERNAME_HELP = "3-20 characters: lowercase letters, numbers, dots, hyphens, or underscores.";

const membershipVariantForOutcome = (
  outcome: MembershipOutcome | null | undefined,
  membership?: MembershipCheckResult | null,
): MembershipRequiredVariant | null => {
  switch (outcome) {
    case "active_member_needs_hub_invite":
      return "activation_required";
    case "inactive_or_expired_member":
      return "expired";
    case "nonmember":
      return "nonmember";
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

const Login = () => {
  const {
    signIn,
    signUp,
    resendConfirmation,
    requestPasswordReset,
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
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
    if (!loading && user) {
      navigate(returnPath, { replace: true });
    }
  }, [loading, user, navigate, returnPath]);

  useEffect(() => {
    const nextMode =
      requestedMode === "signup" ? "signup" : requestedMode === "reset" ? "reset" : "login";
    setMode(nextMode);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmailNoticeKind(null);
    setSignupErrorKind(null);
    setMembershipGate(null);

    if (mode === "signup" && confirmPassword !== password) {
      setErrorMessage("Passwords must match.");
      return;
    }

    if (mode === "signup" && usernameError) {
      setErrorMessage(usernameError);
      return;
    }

    setIsSubmitting(true);

    try {
      let membership: MembershipCheckResult | null = null;
      if (mode !== "reset") {
        const nameParts = splitDisplayName(displayName);
        const membershipResult = await checkNeonMembership({
          email,
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
        });

        if (membershipResult.error) {
          console.warn("Membership lookup failed during authentication", membershipResult.error);
          membership = {
            matched: false,
            isActiveMember: false,
            neonAccountId: null,
            membershipStatus: null,
            membershipLevel: null,
            membershipStartAt: null,
            membershipEndAt: null,
            hubAccess: "unknown",
            outcome: "lookup_failed",
            publicState: "lookup_unavailable",
            hubUserLinked: false,
            requiresManualReview: false,
            reason: membershipResult.error,
          };
        } else {
          membership = membershipResult.data;
        }
        if (membership?.outcome === "lookup_failed") {
          console.warn("Membership lookup returned lookup_failed during authentication", membership.reason);
        }
        const gateMessage = getMembershipGateMessage(membership?.outcome ?? "lookup_failed");
        const loginCanContinue =
          mode === "login" &&
          membership?.outcome === "active_member_existing_hub_user";
        const signupCanContinue = mode === "signup" && membership?.outcome === "active_member_needs_hub_invite";

        if (!loginCanContinue && !signupCanContinue) {
          const variant = membershipVariantForOutcome(membership?.outcome ?? "lookup_failed", membership);
          if (variant) {
            setMembershipGate({ variant, membership, message: gateMessage });
          } else {
            setErrorMessage(gateMessage || "GPE Hub access requires an active GPE membership.");
          }
          return;
        }
      }

      if (mode === "login") {
        const { error } = await signIn({ email, password });
        if (error) {
	          setErrorMessage(error);
	          return;
	        }
	        navigate(returnPath, { replace: true });
	        return;
	      }

      if (mode === "reset") {
        const { error } = await requestPasswordReset(email);
        if (error) {
          setErrorMessage(error);
          return;
        }
        setSuccessMessage("Password reset email sent.");
        setEmailNoticeKind("reset");
        return;
      }

      const result = await signUp({
        email,
        password,
        displayName,
        username: normalizedUsername,
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
        membership?.outcome === "active_member_needs_hub_invite"
          ? "Your GPE membership is confirmed. Account created. Check your inbox to confirm your account, then return here to sign in."
          : "Account created. Check your inbox to confirm your account, then return here to sign in.",
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
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleActivateHub = () => {
    setMembershipGate(null);
    setAuthMode("signup");
  };

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
            <Tape className="mb-5">Member portal</Tape>
            <h1 className="font-header text-6xl uppercase leading-none md:text-7xl">
              Hey, GPE Community!
            </h1>
            <p className="mt-6 text-2xl font-bold">
              Welcome to your environmental justice hub. Log in to connect, post,
              message, and move work forward together.
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
                  ? "Join the Movement"
                  : "Reset Password"}
              </h2>
              <p className="mt-3 text-sm font-bold text-black/70">
                {mode === "login" && "Enter your real account details to access the hub."}
                {mode === "signup" && "We’ll send a confirmation email before your account becomes active."}
                {mode === "reset" && "Enter your email and we’ll send a real password-reset link."}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {mode === "signup" && (
                  <>
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
                  </>
                )}

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
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      required
                      minLength={8}
                    />
                  </div>
                )}

                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase">
                      Confirm Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Confirm your password"
                      required
                      minLength={8}
                    />
                  </div>
                )}

                {errorMessage && (
                  <div
                    className="rounded-[1.25rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700"
                    role="alert"
                  >
                    {errorMessage}
                    {errorMessage.includes("already a GPE member") && (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          className="underline"
                          onClick={() => setAuthMode("signup")}
                        >
                          Activate Hub account
                        </button>
                        <button
                          type="button"
                          className="underline"
                          onClick={() => setEmail("")}
                        >
                          Use another email
                        </button>
                        <a href="mailto:hello@girlplusenvironment.org" className="underline">
                          Contact support
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {successMessage && (
                  <div
                    className="rounded-[1.25rem] border-[3px] border-green-600 bg-green-100 p-4 text-sm font-bold text-green-700"
                    role="status"
                  >
                    {successMessage}
                    {emailNoticeKind && <AuthEmailNotice kind={emailNoticeKind} />}
                  </div>
                )}

                <CampButton type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting
                    ? mode === "login"
                      ? "Signing In..."
                      : mode === "signup"
                      ? "Creating Account..."
                      : "Sending Reset Email..."
                    : mode === "login"
                    ? "Log In"
                    : mode === "signup"
                    ? "Sign Up"
                    : "Send Reset Link"}
                </CampButton>
              </form>

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
