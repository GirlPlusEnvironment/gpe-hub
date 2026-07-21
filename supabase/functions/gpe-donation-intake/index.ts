import { assertAllowedOrigin, corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createFormSubmission, publicConfig, updateFormSubmission } from "../_shared/form-submission.ts";
import { safeError } from "../_shared/neon-membership.ts";
import { readJson, sanitizeText, validateFields, validateIdempotencyKey, ValidationError } from "../_shared/validation.ts";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void };

const FORM_KEY = "donation_intake";
const FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true, type: "email" as const },
  { key: "amount", label: "Donation Amount", required: true },
  { key: "amountSource", label: "Donation Amount Source", allowed: ["preset", "custom"] },
  { key: "frequency", label: "Donation Frequency", required: true, allowed: ["one_time", "monthly"] },
  { key: "otherAmount", label: "Other Amount" },
  { key: "phone", label: "Phone Number" },
  { key: "city", label: "City" },
  { key: "state", label: "State/Province" },
  { key: "zip", label: "Zip/Postal Code" },
  { key: "tributeNote", label: "Tribute or donor note", type: "textarea" as const }
];

function paymentUrl(base: string | undefined, fields: Record<string, unknown>, submissionId: string) {
  if (!base) return null;
  try {
    const url = new URL(base);
    url.searchParams.set("amount", String(fields.otherAmount || fields.amount || ""));
    url.searchParams.set("frequency", String(fields.frequency || ""));
    url.searchParams.set("submission_id", submissionId);
    return url.toString();
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  try {
    assertAllowedOrigin(origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return jsonResponse({ message: "Method not allowed." }, 405, origin);
    const body = await readJson(req);
    if (JSON.stringify(body).match(/card|cvv|cvc|payment\\.card/i)) throw new ValidationError("Payment card data must not be submitted to this endpoint.");
    const idempotencyKey = validateIdempotencyKey(req.headers.get("idempotency-key") || body.idempotencyKey);
    const fields = validateFields((body.fields || {}) as Record<string, unknown>, FIELDS);
    const email = String(fields.email).toLowerCase();
    const { submission, duplicate } = await createFormSubmission({
      idempotencyKey,
      formKey: FORM_KEY,
      email,
      payload: { fields, paymentBoundary: "No card data stored. Use configured secure payment URL." },
      membershipRequest: null,
      honeypot: sanitizeText(body.website, 250)
    });
    await updateFormSubmission(String(submission.id), { submission_status: "completed", neon_sync_status: "skipped", membership_outcome: "not_checked" });
    const nextPaymentUrl = paymentUrl(Deno.env.get("GPE_DONATION_PAYMENT_URL"), fields, String(submission.id));
    return jsonResponse({
      duplicate,
      submissionId: submission.id,
      membershipOutcome: "not_checked",
      partialSuccess: false,
      paymentStatus: nextPaymentUrl ? "payment_required" : "payment_configuration_required",
      paymentUrl: nextPaymentUrl,
      ...publicConfig()
    }, 200, origin);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("gpe-donation-intake", safeError(error));
    return jsonResponse({ message: error instanceof ValidationError ? error.message : "Donation intake could not be completed." }, error instanceof ValidationError ? 400 : 500, origin);
  }
});
