import { getEnv, safeError } from "./neon-membership.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
};

export type EmailSendInput = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
};

export type EmailSendResult = {
  status: "sent" | "retry_pending" | "failed";
  provider: string;
  providerMessageId?: string;
  errorSummary?: string;
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function textValue(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
}

export function escapedLines(value: unknown): string {
  return escapeHtml(textValue(value)).replace(/\r\n|\r|\n/g, "<br>");
}

export async function sendTransactionalEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const provider = (Deno.env.get("GPE_EMAIL_PROVIDER") || (Deno.env.get("RESEND_API_KEY") ? "resend" : "")).toLowerCase();
  if (!provider) {
    return {
      status: "retry_pending",
      provider: "not_configured",
      errorSummary: "Transactional email provider is not configured."
    };
  }

  if (provider !== "resend") {
    return {
      status: "retry_pending",
      provider,
      errorSummary: `Unsupported transactional email provider: ${provider}`
    };
  }

  try {
    const apiKey = getEnv("RESEND_API_KEY");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {})
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {})
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        status: res.status >= 500 || res.status === 429 ? "retry_pending" : "failed",
        provider: "resend",
        errorSummary: `Resend ${res.status}: ${String(data.message || data.error || "Email send failed").slice(0, 300)}`
      };
    }
    return {
      status: "sent",
      provider: "resend",
      providerMessageId: String(data.id || "")
    };
  } catch (error) {
    return {
      status: "retry_pending",
      provider: "resend",
      errorSummary: safeError(error)
    };
  }
}
