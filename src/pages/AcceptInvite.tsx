import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampButton, LoadingCampCard, Sticker, Tape } from "@/components/camp/CampDesign";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import {
  checkNeonMembership,
  GPE_MEMBERSHIP_URL,
  updateCurrentHubMembershipState,
  type MembershipCheckResult,
} from "@/lib/membership";

const INVITE_LINK_ERROR =
  "This invitation link is invalid or has expired. Request a new Hub access link from the login page.";
const GRACE_DAYS = 7;

const SENSITIVE_INVITE_PARAMS = [
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

const getInviteParams = () => {
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
    hasSensitiveParams: SENSITIVE_INVITE_PARAMS.some((key) => hashParams.has(key) || searchParams.has(key)),
  };
};

const clearInviteTokensFromUrl = () => {
  window.history.replaceState(null, document.title, "/accept-invite");
};

const AcceptInvite = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshProfile, updatePassword } = useAuth();
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [membership, setMembership] = useState<MembershipCheckResult | null>(null);
  const [membershipDecision, setMembershipDecision] = useState<"active" | "membership_pending" | null>(null);
  const [isCheckingMembership, setIsCheckingMembership] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const prepareInviteSession = async () => {
      setIsLoadingSession(true);
      setErrorMessage(null);

      try {
        const invite = getInviteParams();
        if (invite.error) throw new Error(INVITE_LINK_ERROR);

        if (invite.accessToken && invite.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: invite.accessToken,
            refresh_token: invite.refreshToken,
          });
          if (error) throw error;
        } else if (invite.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(invite.code);
          if (error) throw error;
        } else if (invite.tokenHash && (invite.type === "invite" || invite.type === "signup")) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: invite.tokenHash,
            type: invite.type,
          });
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!cancelled) {
          setSessionReady(Boolean(data.session));
          setInviteEmail(data.session?.user.email || "");
          if (!data.session) setErrorMessage(INVITE_LINK_ERROR);
        }

        if (invite.hasSensitiveParams) clearInviteTokensFromUrl();
      } catch (error) {
        if (!cancelled) {
          setSessionReady(false);
          setErrorMessage(error instanceof Error ? error.message : INVITE_LINK_ERROR);
        }

        if (getInviteParams().hasSensitiveParams) clearInviteTokensFromUrl();
      } finally {
        if (!cancelled) setIsLoadingSession(false);
      }
    };

    void prepareInviteSession();

    return () => {
      cancelled = true;
    };
  }, [location.key]);

  useEffect(() => {
    let cancelled = false;

    const runMembershipLookup = async () => {
      if (!sessionReady || !inviteEmail) return;
      setIsCheckingMembership(true);
      setErrorMessage(null);

      try {
        const result = await checkNeonMembership({ email: inviteEmail });
        if (cancelled) return;
        if (result.error) {
          setMembership(null);
          setMembershipDecision("membership_pending");
          setSuccessMessage(
            `We could not confirm membership right now. You can still accept this invite and complete membership within ${GRACE_DAYS} days.`,
          );
          return;
        }

        setMembership(result.data);
        if (result.data?.isActiveMember || result.data?.outcome === "active_member_needs_hub_invite" || result.data?.outcome === "active_member_existing_hub_user") {
          setMembershipDecision("active");
          await updateCurrentHubMembershipState({
            membershipAccessState: "active",
            neonAccountId: result.data.neonAccountId,
            membershipLevel: result.data.membershipLevel,
            membershipStartDate: result.data.membershipStartAt,
            membershipEndDate: result.data.membershipEndAt,
          });
          await refreshProfile();
        }
      } finally {
        if (!cancelled) setIsCheckingMembership(false);
      }
    };

    void runMembershipLookup();

    return () => {
      cancelled = true;
    };
  }, [inviteEmail, refreshProfile, sessionReady]);

  const continueWithoutMembership = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await updateCurrentHubMembershipState({ membershipAccessState: "membership_pending" });
      if (result.error) {
        setErrorMessage(result.error);
        return;
      }
      await refreshProfile();
      setMembershipDecision("membership_pending");
      setSuccessMessage(`Invitation can continue. Complete membership within ${GRACE_DAYS} days to keep Hub access.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!membershipDecision) {
      setErrorMessage("Choose a membership option before creating your password.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Your password must be at least 8 characters long.");
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

      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        if (membershipDecision === "active") {
          await checkNeonMembership({ email: data.user.email });
        }
        await refreshProfile(data.user);
      }

      setSuccessMessage("Invitation accepted. Your Hub account is ready.");
      setTimeout(() => navigate("/profile", { replace: true }), 1200);
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
          <Tape className="mb-5">Hub invitation</Tape>
          <Link to="/login" className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase underline">
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>

          <Sticker accent="cyan" className="mb-5">Accept invite</Sticker>
          <h1 className="gpe-heading text-4xl">Create Your Password</h1>
          <p className="mt-3 text-sm font-bold text-black/70">
            Use your secure Supabase invitation link to finish setting up your GPE Hub account.
          </p>

          {isLoadingSession ? (
            <div className="py-8">
              <LoadingCampCard label="Preparing your invitation" />
            </div>
          ) : sessionReady ? (
            <div className="mt-8 space-y-5">
              {isCheckingMembership ? (
                <LoadingCampCard label="Checking membership" />
              ) : membershipDecision ? (
                <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4 text-sm font-bold text-black">
                  {membershipDecision === "active"
                    ? "Membership confirmed. Create your password and come on in."
                    : `Membership pending. You can accept this invite now and complete membership within ${GRACE_DAYS} days.`}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[1.25rem] border-[3px] border-black bg-gpe-yellow p-4 text-sm font-bold text-black">
                    We could not find an active GPE membership for {inviteEmail || "this email"}.
                  </div>
                  <a href={GPE_MEMBERSHIP_URL} target="_blank" rel="noreferrer" className="block">
                    <CampButton type="button" className="w-full">
                      Become a Member
                    </CampButton>
                  </a>
                  <CampButton type="button" variant="outline" className="w-full" onClick={continueWithoutMembership} disabled={isSubmitting}>
                    Continue Without Membership
                  </CampButton>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase">
                  Password
                </Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase">
                  Confirm Password
                </Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
              </div>
              {errorMessage ? <div className="rounded-[1.25rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700" role="alert">{errorMessage}</div> : null}
              {successMessage ? <div className="rounded-[1.25rem] border-[3px] border-green-600 bg-green-100 p-4 text-sm font-bold text-green-700" role="status"><CheckCircle2 className="mr-2 inline h-4 w-4" />{successMessage}</div> : null}
              <CampButton type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? "Creating Account..." : "Accept Invite"}
              </CampButton>
              </form>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {errorMessage ? <div className="rounded-[1.25rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700">{errorMessage}</div> : null}
              <CampButton className="w-full" onClick={() => navigate("/login?mode=reset")}>
                Request New Hub Access Link
              </CampButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
