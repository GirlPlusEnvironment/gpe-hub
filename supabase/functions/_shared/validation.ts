export class ValidationError extends Error {}

export type FieldSchema = {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "email" | "tel" | "textarea" | "select" | "checkbox" | "radio" | "number" | "url";
  allowed?: string[];
  maxLength?: number;
};

export function sanitizeText(value: unknown, max = 2000): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeEmail(value: unknown): string {
  return sanitizeText(value, 320).toLowerCase();
}

export async function readJson(req: Request, maxBytes = 120_000) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) throw new ValidationError("Content-Type must be application/json.");
  const body = await req.text();
  if (new TextEncoder().encode(body).length > maxBytes) throw new ValidationError("Request body is too large.");
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch (_) {
    throw new ValidationError("Malformed JSON.");
  }
}

export function validateIdempotencyKey(value: unknown) {
  const key = sanitizeText(value, 120);
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) throw new ValidationError("Invalid idempotency key.");
  return key;
}

export function validateFields(values: Record<string, unknown>, schema: FieldSchema[]) {
  const sanitized: Record<string, unknown> = {};
  for (const field of schema) {
    const raw = values[field.key];
    if (field.type === "checkbox") {
      const rawList = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const list = rawList.map((item) => sanitizeText(item, 120)).filter(Boolean);
      if (field.required && list.length === 0) throw new ValidationError(`${field.label} is required.`);
      if (field.allowed && list.some((item) => !field.allowed?.includes(item))) throw new ValidationError(`${field.label} contains an unsupported option.`);
      sanitized[field.key] = list;
      continue;
    }
    const value = sanitizeText(raw, field.maxLength || (field.type === "textarea" ? 5000 : 1000));
    if (field.required && !value) throw new ValidationError(`${field.label} is required.`);
    if (value && field.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) throw new ValidationError(`${field.label} must be a valid email.`);
    if (value && field.type === "url" && !/^https?:\/\/\S+\.\S+/.test(value)) throw new ValidationError(`${field.label} must be a valid URL.`);
    if (field.allowed && value && !field.allowed.includes(value)) throw new ValidationError(`${field.label} contains an unsupported option.`);
    sanitized[field.key] = value;
  }
  return sanitized;
}
