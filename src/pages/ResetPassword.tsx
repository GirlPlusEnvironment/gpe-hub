import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampButton, LoadingCampCard, Sticker, Tape } from "@/components/camp/CampDesign";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { checkNeonMembership } from "@/lib/membership";

const RECOVERY_LINK_ERROR =
  "This password reset link is invalid or has expired. Request a new one from the login page.";

const SENSITIVE_RECOVERY_PARAMS = [
  "access_token",
  "refresh_token",
  "token_type",
  "expires_in",
  "expires_at",
  "type",
  "code",
  "token_hash",
  "error",
  "error_code",
  "error_description",
];

const getRecoveryParams = () => {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const get = (key: string) => hashParams.get(key) || searchParams.get(key);

  return {
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    code: get("code"),
    tokenHash: get("token_hash"),
    type: get("type"),
    error: get("error_description") || get("error"),
    hasSensitiveParams: SENSITIVE_RECOVERY_PARAMS.some((key) => hashParams.has(key) || searchParams.has(key)),
  };
};

const clearRecoveryTokensFromUrl = () => {
  window.history.replaceState(null, document.title, "/reset-password");
};

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshProfile, updatePassword } = useAuth();

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY" && nextSession && !cancelled) {
        setSessionReady(true);
        setErrorMessage(null);
        setIsLoadingSession(false);
        clearRecoveryTokensFromUrl();
      }
    });

    const prepareRecoverySession = async () => {
      setIsLoadingSession(true);
      setErrorMessage(null);

      try {
        const recovery = getRecoveryParams();

        if (recovery.error) {
          throw new Error(RECOVERY_LINK_ERROR);
        }

        if (recovery.accessToken && recovery.refreshToken && recovery.type === "recovery") {
          const { error } = await supabase.auth.setSession({
            access_token: recovery.accessToken,
            refresh_token: recovery.refreshToken,
          });
          if (error) {
            throw error;
          }
        } else if (recovery.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(recovery.code);
          if (error) {
            throw error;
          }
        } else if (recovery.tokenHash && recovery.type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: recovery.tokenHash,
            type: "recovery",
          });
          if (error) {
            throw error;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        if (!cancelled) {
          setSessionReady(Boolean(data.session));
          if (!data.session) {
            setErrorMessage(RECOVERY_LINK_ERROR);
          }
        }

        if (recovery.hasSensitiveParams) {
          clearRecoveryTokensFromUrl();
        }
      } catch (error) {
        if (!cancelled) {
          setSessionReady(false);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : RECOVERY_LINK_ERROR,
          );
        }

        const recovery = getRecoveryParams();
        if (recovery.hasSensitiveParams) {
          clearRecoveryTokensFromUrl();
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSession(false);
        }
      }
    };

    void prepareRecoverySession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [location.key]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setErrorMessage("Your new password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords must match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await updatePassword(password);
      if (error) {
        setErrorMessage(error);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email || "";
      if (userEmail) {
        await checkNeonMembership({ email: userEmail });
        await refreshProfile(userData.user);
      }

      setSuccessMessage("Password updated. Your Hub access is being refreshed.");
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="gpe-page md:pl-0">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-12">
        <div className="gpe-card gpe-paper w-full p-8 md:p-10">
          <img
            src="/gpe-hub-icon.png"
            alt="GPE Hub"
            className="gpe-border mb-6 h-24 w-auto rounded-[1.5rem] bg-white object-contain p-2 shadow-gpe-sm"
          />
          <Tape className="mb-5">Account recovery</Tape>
          <Link
            to="/login"
            className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>

          <Sticker accent="yellow" className="mb-5">Secure reset</Sticker>
          <h1 className="gpe-heading text-4xl">Set New Password</h1>
          <p className="mt-3 text-sm font-bold text-black/70">
            Finish the real Supabase recovery flow by choosing a new password for your account.
          </p>

          {isLoadingSession ? (
            <div className="py-8">
              <LoadingCampCard label="Preparing your reset session" />
            </div>
          ) : sessionReady ? (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase">
                  New Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase">
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              {errorMessage && (
                <div className="rounded-[1.25rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700" role="alert">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="rounded-[1.25rem] border-[3px] border-green-600 bg-green-100 p-4 text-sm font-bold text-green-700" role="status">
                  {successMessage}
                </div>
              )}

              <CampButton type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? "Updating Password..." : "Save New Password"}
              </CampButton>
            </form>
          ) : (
            <div className="mt-8 space-y-4">
              {errorMessage && (
                <div className="rounded-[1.25rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700">
                  {errorMessage}
                </div>
              )}
              <CampButton className="w-full" onClick={() => navigate("/login?mode=reset")}>
                Request New Reset Email
              </CampButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
