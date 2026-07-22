import { ArrowLeft, ExternalLink, HelpCircle, Mail, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CampButton, Sticker, Tape } from "@/components/camp/CampDesign";
import { GPE_MEMBERSHIP_URL, type MembershipCheckResult } from "@/lib/membership";

export type MembershipRequiredVariant =
  | "activation_required"
  | "nonmember"
  | "expired"
  | "manual_review"
  | "service_error";

type MembershipRequiredPageProps = {
  variant: MembershipRequiredVariant;
  email?: string;
  membership?: MembershipCheckResult | null;
  onActivateHub?: () => void;
  onResendInvitation?: () => void;
  onUseAnotherEmail?: () => void;
  onRetry?: () => void;
  returnPath?: string;
};

const supportEmail = "hello@girlplusenvironment.org";

function membershipUrl(returnPath?: string) {
  const url = new URL(GPE_MEMBERSHIP_URL, window.location.origin);
  url.searchParams.set("return_to", `${window.location.origin}${returnPath || "/"}`);
  return url.toString();
}

function contentForVariant(variant: MembershipRequiredVariant) {
  switch (variant) {
    case "activation_required":
      return {
        eyebrow: "Membership found",
        title: "You’re already a GPE member.",
        description: "Let’s activate your Hub account so your membership is connected to this login.",
        cta: "Activate Hub",
      };
    case "expired":
      return {
        eyebrow: "Renew membership",
        title: "Your membership has expired.",
        description: "Renew your GPE membership to reopen Hub access, campaigns, resources, and community tools.",
        cta: "Renew Membership",
      };
    case "manual_review":
      return {
        eyebrow: "Manual review",
        title: "We need to confirm your membership.",
        description: "More than one Neon record matched this email. Team GPE needs to confirm the right account before Hub access can continue.",
        cta: "Contact Support",
      };
    case "service_error":
      return {
        eyebrow: "Verification paused",
        title: "We could not confirm your membership right now.",
        description: "The membership service is unavailable. Try again shortly or contact Team GPE if this keeps happening.",
        cta: "Try Again",
      };
    case "nonmember":
    default:
      return {
        eyebrow: "Member benefit",
        title: "GPE Hub access is a member benefit.",
        description: "Become a member to unlock the Hub, campaign actions, resources, community posts, messaging, and seasonal challenges.",
        cta: "Become a Member",
      };
  }
}

export function MembershipRequiredPage({
  variant,
  email,
  membership,
  onActivateHub,
  onResendInvitation,
  onUseAnotherEmail,
  onRetry,
  returnPath,
}: MembershipRequiredPageProps) {
  const copy = contentForVariant(variant);
  const externalMembershipUrl = membershipUrl(returnPath);
  const isActivation = variant === "activation_required";
  const isManualReview = variant === "manual_review";
  const isServiceError = variant === "service_error";

  return (
    <div className="space-y-6">
      <Card className="gpe-paper border-[4px] border-black">
        <CardHeader>
          <Tape>{copy.eyebrow}</Tape>
          <CardTitle className="font-header text-4xl uppercase leading-none">{copy.title}</CardTitle>
          <p className="font-bold text-black/70">{copy.description}</p>
          {email ? <Sticker accent="cyan" rotate="none">{email}</Sticker> : null}
        </CardHeader>
        <CardContent className="space-y-5">
          {membership?.membershipStatus || membership?.membershipLevel ? (
            <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4 text-sm font-bold">
              {membership.membershipLevel ? <div>Level: {membership.membershipLevel}</div> : null}
              {membership.membershipStatus ? <div>Status: {membership.membershipStatus}</div> : null}
              {membership.membershipEndAt ? <div>Expiration: {new Date(membership.membershipEndAt).toLocaleDateString()}</div> : null}
            </div>
          ) : null}

          {isActivation ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <CampButton type="button" variant="secondary" onClick={onActivateHub}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Activate Hub
              </CampButton>
              <CampButton type="button" variant="outline" onClick={onResendInvitation}>
                <Mail className="mr-2 h-4 w-4" />
                Resend Invitation
              </CampButton>
              <CampButton type="button" variant="yellow" onClick={onUseAnotherEmail}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Use Another Email
              </CampButton>
              <a href={`mailto:${supportEmail}`}>
                <CampButton type="button" variant="outline" className="w-full">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Contact Support
                </CampButton>
              </a>
            </div>
          ) : isManualReview ? (
            <a href={`mailto:${supportEmail}`}>
              <CampButton type="button" variant="secondary" className="w-full justify-center">
                Contact Support
              </CampButton>
            </a>
          ) : isServiceError ? (
            <CampButton type="button" variant="secondary" className="w-full justify-center" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </CampButton>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                  <Sparkles className="mb-2 h-6 w-6" />
                  <div className="font-black">Campaign actions</div>
                  <p className="mt-1 text-xs font-bold text-black/65">Join petitions, events, seasonal challenges, and advocacy pushes.</p>
                </div>
                <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                  <ShieldCheck className="mb-2 h-6 w-6" />
                  <div className="font-black">Member Hub</div>
                  <p className="mt-1 text-xs font-bold text-black/65">Access resources, jobs, funding, posts, and member messaging.</p>
                </div>
                <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                  <HelpCircle className="mb-2 h-6 w-6" />
                  <div className="font-black">Community support</div>
                  <p className="mt-1 text-xs font-bold text-black/65">Connect with GPE programs, organizers, and environmental justice peers.</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border-[4px] border-black bg-gpe-yellow p-5">
                <h3 className="font-header text-2xl uppercase">{variant === "expired" ? "Renew in Neon" : "Become a Member"}</h3>
                <p className="mt-2 text-sm font-bold text-black/70">
                  The native Neon membership form cannot be safely embedded in this build, so this page uses the approved fallback: open the membership page in a new tab and preserve your Hub return URL.
                </p>
                <a href={externalMembershipUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex">
                  <CampButton type="button" variant="secondary">
                    {copy.cta} <ExternalLink className="ml-2 h-4 w-4" />
                  </CampButton>
                </a>
              </div>

              <div className="grid gap-3 text-sm font-bold md:grid-cols-2">
                <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                  <div className="font-black uppercase">FAQ</div>
                  <p className="mt-1 text-black/65">Use the same email for membership and Hub login so access can sync automatically.</p>
                </div>
                <div className="rounded-[1.25rem] border-[3px] border-black bg-white p-4">
                  <div className="font-black uppercase">Need Help?</div>
                  <a href={`mailto:${supportEmail}`} className="mt-1 block underline">Contact {supportEmail}</a>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isActivation && !isManualReview ? (
        <Button type="button" variant="outline" onClick={onUseAnotherEmail}>
          Use another email
        </Button>
      ) : null}
    </div>
  );
}
