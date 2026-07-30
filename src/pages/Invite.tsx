import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Copy, MailPlus, RotateCcw, Send, X } from "lucide-react";
import { CampButton, Sticker, Tape } from "@/components/camp/CampDesign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendHubInvitation, type HubInvitationResult, GPE_MEMBERSHIP_URL } from "@/lib/membership";

type InviteForm = {
  email: string;
  firstName: string;
  lastName: string;
  personalMessage: string;
};

const initialForm: InviteForm = {
  email: "",
  firstName: "",
  lastName: "",
  personalMessage: "",
};

const HUB_URL = "https://members.girlplusenvironment.org/";

function formatSentAt(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const Invite = () => {
  const [form, setForm] = useState<InviteForm>(initialForm);
  const [result, setResult] = useState<HubInvitationResult | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  const recipientEmail = result?.recipientEmail || form.email.trim().toLowerCase();
  const canSubmit = useMemo(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()), [form.email]);

  const updateField = (field: keyof InviteForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setCopyMessage("");
  };

  const submitInvitation = async (options?: { action?: "send" | "resend"; sendAnyway?: boolean }) => {
    setSubmitting(true);
    setError("");
    setCopyMessage("");
    try {
      const response = await sendHubInvitation({
        ...form,
        action: options?.action || "send",
        sendAnyway: options?.sendAnyway,
      });
      if (response.error) throw new Error(response.error);
      setResult(response.data);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Invitation could not be sent right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      setError("Enter a valid email address.");
      return;
    }
    void submitInvitation();
  };

  const sendAnother = () => {
    setForm(initialForm);
    setResult(null);
    setError("");
    setCopyMessage("");
  };

  const copyInvitationLink = async () => {
    if (!result?.invitationLink) return;
    await navigator.clipboard.writeText(result.invitationLink);
    setCopyMessage("Invitation link copied.");
  };

  const renderResult = () => {
    if (!result) return null;

    if (result.status === "existing_account") {
      return (
        <ResultPanel accent="cyan" title="This email already has a Hub account.">
          <div className="flex flex-wrap gap-3">
            <a href={result.hubUrl || HUB_URL}>
              <CampButton type="button">
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Go to Hub
              </CampButton>
            </a>
            <a href={result.resetPasswordUrl || `${HUB_URL}reset-password`}>
              <Button type="button" variant="outline" className="gpe-press border-[3px] border-black font-bold">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Password
              </Button>
            </a>
          </div>
        </ResultPanel>
      );
    }

    if (result.status === "pending_invitation") {
      return (
        <ResultPanel accent="yellow" title="An invitation has already been sent to this email.">
          {result.sentAt ? <p className="text-sm font-bold text-black/65">Sent {formatSentAt(result.sentAt)}</p> : null}
          <div className="flex flex-wrap gap-3">
            <CampButton type="button" disabled={submitting} onClick={() => void submitInvitation({ action: "resend" })}>
              <Send className="mr-2 h-5 w-5" />
              Resend Invitation
            </CampButton>
            <Button type="button" variant="outline" className="gpe-press border-[3px] border-black font-bold" onClick={() => setResult(null)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </ResultPanel>
      );
    }

    if (result.status === "membership_required") {
      return (
        <ResultPanel accent="orange" title="This email isn’t currently associated with a GPE membership.">
          <div className="flex flex-wrap gap-3">
            <a href={result.membershipUrl || GPE_MEMBERSHIP_URL}>
              <CampButton type="button">
                <MailPlus className="mr-2 h-5 w-5" />
                Become a Member
              </CampButton>
            </a>
            {result.canSendAnyway ? (
              <Button
                type="button"
                variant="outline"
                className="gpe-press border-[3px] border-black font-bold"
                disabled={submitting}
                onClick={() => void submitInvitation({ sendAnyway: true })}
              >
                Send Hub Invitation Anyway
              </Button>
            ) : null}
          </div>
        </ResultPanel>
      );
    }

    if (result.status === "sent") {
      return (
        <ResultPanel accent="pink" title={result.message || "Invitation sent successfully ✨"}>
          <dl className="grid gap-2 text-sm font-bold text-black/70 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-black/50">Recipient</dt>
              <dd className="break-words text-black">{recipientEmail}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-black/50">Sent</dt>
              <dd className="text-black">{formatSentAt(result.sentAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-black/50">Status</dt>
              <dd className="text-black">{result.invitationStatus || "sent"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <CampButton type="button" onClick={sendAnother}>
              <MailPlus className="mr-2 h-5 w-5" />
              Send Another Invitation
            </CampButton>
            {result.invitationLink ? (
              <Button type="button" variant="outline" className="gpe-press border-[3px] border-black font-bold" onClick={copyInvitationLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Invitation Link
              </Button>
            ) : null}
          </div>
          {copyMessage ? <p className="text-sm font-bold text-black/70">{copyMessage}</p> : null}
        </ResultPanel>
      );
    }

    return (
      <ResultPanel accent="orange" title={result.message || "Invitation could not be sent right now."}>
        <Button type="button" variant="outline" className="gpe-press border-[3px] border-black font-bold" onClick={() => setResult(null)}>
          Try Again
        </Button>
      </ResultPanel>
    );
  };

  return (
    <div className="gpe-page md:pl-0">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-12">
        <div className="gpe-card gpe-paper w-full p-6 md:p-10">
          <Tape className="mb-5">Hub invitation</Tape>
          <Link to="/" className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase underline">
            <ArrowLeft className="h-4 w-4" />
            Back to Hub
          </Link>
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Sticker accent="pink" className="mb-5">Invite to the Hub</Sticker>
              <h1 className="gpe-heading text-4xl md:text-5xl">Invite a Member</h1>
            </div>
            <Sticker accent="cyan" rotate="right">Supabase Auth</Sticker>
          </div>

          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="invite-email" className="font-bold uppercase">Email address *</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="invite-first-name" className="font-bold uppercase">First name</Label>
                <Input
                  id="invite-first-name"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(event) => updateField("firstName", event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-last-name" className="font-bold uppercase">Last name</Label>
                <Input
                  id="invite-last-name"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(event) => updateField("lastName", event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-message" className="font-bold uppercase">Personal message</Label>
              <Textarea
                id="invite-message"
                rows={4}
                maxLength={1000}
                value={form.personalMessage}
                onChange={(event) => updateField("personalMessage", event.target.value)}
              />
            </div>
            {error ? (
              <div className="gpe-card-sm border-[3px] border-black bg-gpe-orange p-4 text-sm font-bold text-black" role="alert">
                {error}
              </div>
            ) : null}
            <CampButton type="submit" size="lg" disabled={submitting || !canSubmit}>
              <Send className="mr-2 h-5 w-5" />
              {submitting ? "Sending..." : "Send Invitation"}
            </CampButton>
          </form>

          {renderResult()}
        </div>
      </div>
    </div>
  );
};

function ResultPanel({
  accent,
  title,
  children,
}: {
  accent: "pink" | "cyan" | "yellow" | "orange";
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="gpe-card-sm mt-8 space-y-4 border-[3px] border-black bg-white p-5" aria-live="polite">
      <Sticker accent={accent} rotate="right">Status</Sticker>
      <h2 className="gpe-heading text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export default Invite;
