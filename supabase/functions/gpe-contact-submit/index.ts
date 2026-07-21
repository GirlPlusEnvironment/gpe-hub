import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, logSync, publicConfig, updateFormSubmission } from "../_shared/form-submission.ts";
import { escapedLines, escapeHtml, sendTransactionalEmail, textValue } from "../_shared/email.ts";
import { resolveOrCreateAccount } from "../_shared/neon-account.ts";
import { createActivity } from "../_shared/neon-activity.ts";
import { getEnv, safeError } from "../_shared/neon-membership.ts";
import { readJson, sanitizeText, validateFields, validateIdempotencyKey, ValidationError } from "../_shared/validation.ts";

declare const Deno: { serve(handler: (req: Request) => Response | Promise<Response>): void };

const FORM_KEY = "contact";
const CONTACT_NOTIFICATION_TO = "hello@girlplusenvironment.org";
const FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true, type: "email" as const },
  { key: "phone", label: "Phone 1", type: "tel" as const },
  { key: "phoneType", label: "Phone Type", allowed: ["M", "H", "W"] },
  { key: "organization", label: "Organization", maxLength: 250 },
  { key: "contactReason", label: "Contact Reason", maxLength: 250 },
  { key: "subject", label: "Subject", maxLength: 250 },
  { key: "message", label: "Message", type: "textarea" as const, maxLength: 3000 },
  { key: "fileAttachment", label: "File Attachment", type: "url" as const, maxLength: 3000 }
];

function formatSubmittedAt(value: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Chicago"
    }).format(value) + " CT";
  } catch {
    return value.toISOString();
  }
}

function fieldRow(label: string, value: unknown, options: { highlight?: boolean; multiline?: boolean } = {}) {
  const safeValue = options.multiline ? escapedLines(value) : escapeHtml(textValue(value) || "Not provided");
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:2px solid #000;font-weight:900;text-transform:uppercase;width:190px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;border-bottom:2px solid #000;vertical-align:top;${options.highlight ? "background:#fde047;padding-left:10px;padding-right:10px;font-weight:900;" : "font-weight:700;"}">${safeValue}</td>
    </tr>`;
}

function buildContactNotification(input: {
  fields: Record<string, unknown>;
  submissionId: string;
  identityState: string;
  submittedAt: string;
  sourcePage: string;
  neonSyncStatus: string;
}) {
  const firstName = textValue(input.fields.firstName);
  const lastName = textValue(input.fields.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const email = textValue(input.fields.email);
  const subjectName = fullName || "";
  const subject = subjectName ? `New Contact Form Message from ${subjectName}` : "New Contact Form Message";
  const replyLabel = firstName || "Sender";
  const mailto = email ? `mailto:${encodeURIComponent(email)}` : "mailto:hello@girlplusenvironment.org";

  const rows = [
    fieldRow("First name", firstName),
    fieldRow("Last name", lastName),
    fieldRow("Email", email, { highlight: true }),
    fieldRow("Phone", input.fields.phone),
    fieldRow("Phone type", input.fields.phoneType),
    fieldRow("Organization", input.fields.organization),
    fieldRow("Reason / subject", input.fields.subject || input.fields.contactReason || input.fields.reason),
    fieldRow("Message", input.fields.message, { multiline: true }),
    fieldRow("File / attachment link", input.fields.fileAttachment),
    fieldRow("Membership / Hub status", input.identityState),
    fieldRow("Submitted", input.submittedAt),
    fieldRow("Source page", input.sourcePage),
    fieldRow("Neon sync status", input.neonSyncStatus),
    fieldRow("Submission reference", input.submissionId)
  ].join("");

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#fbd3d3;font-family:'Courier New',Courier,monospace;color:#000;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbd3d3;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#ffffff;border:4px solid #000;box-shadow:8px 8px 0 #000;">
          <tr>
            <td style="background:#d53f8c;padding:24px;border-bottom:4px solid #000;">
              <div style="font-family:Arial Black,Arial,sans-serif;font-size:28px;font-weight:900;line-height:1;text-transform:uppercase;color:#fff;">
                New Contact Message
              </div>
              <div style="margin-top:10px;font-size:14px;font-weight:700;color:#fff;">Girl Plus Environment Website</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <div style="display:inline-block;background:#fde047;border:3px solid #000;padding:8px 12px;font-weight:700;margin-bottom:24px;">
                CONTACT FORM RESPONSE
              </div>
              <div style="height:12px;"></div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:14px;line-height:1.5;">
                ${rows}
              </table>
              <div style="margin-top:28px;">
                <a href="${escapeHtml(mailto)}" style="display:inline-block;background:#000;color:#fff;border:3px solid #000;padding:14px 22px;font-family:Arial Black,Arial,sans-serif;font-size:16px;font-weight:900;text-decoration:none;text-transform:uppercase;">
                  Reply to ${escapeHtml(replyLabel)}
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#67e8f9;border-top:4px solid #000;padding:16px 24px;font-size:12px;font-weight:700;">
              Submission ID: ${escapeHtml(input.submissionId)}<br>
              Received: ${escapeHtml(input.submittedAt)}<br>
              Neon status: ${escapeHtml(input.neonSyncStatus)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "NEW CONTACT FORM MESSAGE",
    `Name: ${fullName || "Not provided"}`,
    `Email: ${email || "Not provided"}`,
    `Phone: ${textValue(input.fields.phone) || "Not provided"}`,
    `Phone type: ${textValue(input.fields.phoneType) || "Not provided"}`,
    `Organization: ${textValue(input.fields.organization) || "Not provided"}`,
    `Reason / subject: ${textValue(input.fields.subject || input.fields.contactReason || input.fields.reason) || "Not provided"}`,
    "Message:",
    textValue(input.fields.message) || "Not provided",
    `File / attachment link: ${textValue(input.fields.fileAttachment) || "Not provided"}`,
    `Membership / Hub status: ${input.identityState}`,
    `Submitted: ${input.submittedAt}`,
    `Source page: ${input.sourcePage}`,
    `Submission ID: ${input.submissionId}`,
    `Neon sync: ${input.neonSyncStatus}`
  ].join("\n");

  return { subject, html, text, replyTo: email };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  let submissionId: string | null = null;
  try {
    assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);

    const body = await readJson(req);
    const idempotencyKey = validateIdempotencyKey(req.headers.get("idempotency-key") || body.idempotencyKey);
    const fields = validateFields((body.fields || {}) as Record<string, unknown>, FIELDS);
    const email = String(fields.email).toLowerCase();
    const identityState = sanitizeText(body.identityState || "not_checked", 80);
    const sourcePage = sanitizeText(body.sourcePage || req.headers.get("referer") || "contact.html", 300);

    const { submission, duplicate } = await createFormSubmission({
      idempotencyKey,
      formKey: FORM_KEY,
      email,
      payload: {
        formId: 12,
        fields,
        neonCustomFields: [
          { id: 134, key: "message", label: "Message" },
          { id: 135, key: "fileAttachment", label: "File Attachment" }
        ],
        identityState,
        sourcePage
      },
      membershipRequest: null,
      honeypot: sanitizeText(body.website, 250)
    });
    submissionId = String(submission.id);
    if (duplicate) {
      return jsonResponse({ duplicate: true, submissionId, status: "duplicate", ...publicConfig() }, 200, origin);
    }

    let contactStatus = "received";
    let identityReviewRequired = identityState === "ambiguous_match" || identityState === "lookup_unavailable";

    try {
      const account = await resolveOrCreateAccount({
        email,
        firstName: String(fields.firstName),
        lastName: String(fields.lastName),
        phone: String(fields.phone || ""),
        allowCreate: identityState !== "ambiguous_match"
      });

      if (account.status === "ambiguous" || !account.neonAccountId) {
        identityReviewRequired = true;
        contactStatus = "identity_review_required";
        await logSync({
          submissionId,
          integration: "neon",
          operation: "contact_account_match",
          success: false,
          errorSummary: "Ambiguous or unavailable Neon account match."
        });
      } else {
        await createActivity({
          neonAccountId: account.neonAccountId,
          subject: "Contact Us Message",
          type: "Contact",
          note: {
            formKey: FORM_KEY,
            formId: 12,
            customFields: {
              "134": fields.message || "",
              "135": fields.fileAttachment || ""
            },
            fields,
            identityState
          }
        });
        await updateFormSubmission(submissionId, {
          neon_account_id: account.neonAccountId,
          neon_sync_status: "succeeded"
        });
        await logSync({ submissionId, integration: "neon", operation: "contact_activity", success: true });
        contactStatus = "neon_synced";
      }
    } catch (error) {
      contactStatus = "neon_sync_pending";
      await updateFormSubmission(submissionId, { neon_sync_status: "pending" }).catch(() => undefined);
      await logSync({
        submissionId,
        integration: "neon",
        operation: "contact_activity",
        success: false,
        errorSummary: safeError(error)
      });
    }

    await updateFormSubmission(submissionId, {
      submission_status: identityReviewRequired ? "requires_manual_review" : "completed",
      membership_outcome: "not_applicable",
      neon_sync_status: contactStatus === "neon_synced" ? "succeeded" : contactStatus === "neon_sync_pending" ? "pending" : "skipped"
    });

    const submittedAt = formatSubmittedAt(new Date());
    const neonSyncStatus = contactStatus === "neon_synced" ? "succeeded" : contactStatus === "neon_sync_pending" ? "pending" : "skipped";
    const notification = buildContactNotification({
      fields,
      submissionId,
      identityState,
      submittedAt,
      sourcePage,
      neonSyncStatus
    });
    const notificationResult = await sendTransactionalEmail({
      to: getEnv("GPE_CONTACT_NOTIFICATION_TO", false) || CONTACT_NOTIFICATION_TO,
      from: getEnv("GPE_TRANSACTIONAL_EMAIL_FROM", false) || "Girl Plus Environment Website <hello@girlplusenvironment.org>",
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
      replyTo: notification.replyTo,
      idempotencyKey: `contact-staff-${submissionId}`
    });
    await updateFormSubmission(submissionId, {
      staff_notification_status: notificationResult.status,
      staff_notification_provider: notificationResult.provider,
      staff_notification_message_id: notificationResult.providerMessageId || null,
      staff_notification_sent_at: notificationResult.status === "sent" ? new Date().toISOString() : null,
      staff_notification_last_error: notificationResult.errorSummary || null,
      staff_notification_retry_count: notificationResult.status === "sent" ? 0 : 1
    }).catch(() => undefined);
    await logSync({
      submissionId,
      integration: "email",
      operation: "contact_staff_notification",
      success: notificationResult.status === "sent",
      responseSummary: notificationResult.providerMessageId || notificationResult.status,
      errorSummary: notificationResult.errorSummary
    });

    return jsonResponse({
      ok: true,
      submissionId,
      status: contactStatus,
      notificationStatus: notificationResult.status,
      identityReviewRequired,
      message: "Message received.",
      ...publicConfig()
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    if (submissionId) await updateFormSubmission(submissionId, { submission_status: "partial_failure" }).catch(() => undefined);
    console.error("gpe-contact-submit", safeError(error));
    return jsonResponse({
      message: error instanceof ValidationError ? error.message : "Contact message could not be completed."
    }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
