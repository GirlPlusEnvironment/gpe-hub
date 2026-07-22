export const USERNAME_PATTERN = /^[a-z0-9._-]{3,20}$/;

export const normalizeUsername = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, "");

export const shortenEmail = (email: string) => {
  const [localPart] = email.split("@");
  return localPart || email;
};

export const getAuthRedirectUrl = (path: string) => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const configuredOrigin =
    import.meta.env.VITE_GPE_HUB_URL ||
    import.meta.env.VITE_SITE_URL ||
    (import.meta.env.PROD ? "https://members.girlplusenvironment.org" : window.location.origin);
  return `${configuredOrigin.replace(/\/$/, "")}${normalizedPath}`;
};

export const getPreferredDisplayName = (args: {
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
}) => {
  const normalizedFullName = args.fullName?.trim() || null;
  const normalizedUsername = args.username?.trim() || null;
  const fullNameLooksLikeEmail = normalizedFullName?.includes("@");

  if (normalizedFullName && !fullNameLooksLikeEmail) {
    return normalizedFullName;
  }

  if (normalizedUsername) {
    return normalizedUsername;
  }

  if (normalizedFullName) {
    return shortenEmail(normalizedFullName);
  }

  if (args.email?.trim()) {
    return shortenEmail(args.email.trim());
  }

  return "Community Member";
};

export type AuthEmailMessageKind = "signup" | "reset" | "resend";

export const getAuthEmailNotice = (kind: AuthEmailMessageKind) => {
  switch (kind) {
    case "signup":
      return "Check your inbox for the confirmation email. Because the GPE Hub sending domain is new, it may appear in Spam or Promotions. Mark it as not spam so future messages reach your inbox.";
    case "reset":
      return "Check your inbox for the reset email. Because the GPE Hub sending domain is new, it may appear in Spam or Promotions. Mark it as not spam so future messages reach your inbox.";
    case "resend":
      return "Check your inbox for the new confirmation email. Because the GPE Hub sending domain is new, it may appear in Spam or Promotions. Mark it as not spam so future messages reach your inbox.";
    default:
      return "";
  }
};

export type SignupErrorState =
  | "signup_failed"
  | "confirmation_email_failed"
  | "email_exists"
  | "rate_limited"
  | "temporary_email_failure";

export const classifySignupError = (message: string | null | undefined): SignupErrorState => {
  const normalized = message?.toLowerCase() ?? "";

  if (
    normalized.includes("already registered") ||
    normalized.includes("user already registered") ||
    normalized.includes("email address is invalid") === false && normalized.includes("already exists")
  ) {
    return "email_exists";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "rate_limited";
  }

  if (normalized.includes("confirmation email") || normalized.includes("sending confirmation email")) {
    return "confirmation_email_failed";
  }

  if (
    normalized.includes("smtp") ||
    normalized.includes("email service") ||
    normalized.includes("send email") ||
    normalized.includes("mail")
  ) {
    return "temporary_email_failure";
  }

  return "signup_failed";
};

export const getSignupErrorMessage = (kind: SignupErrorState) => {
  switch (kind) {
    case "email_exists":
      return "That email is already registered. Try logging in or resend the confirmation email if you haven’t verified the account yet.";
    case "rate_limited":
      return "Too many signup attempts were made recently. Wait a moment, then try again.";
    case "confirmation_email_failed":
      return "Your account may have been created, but the confirmation email could not be sent. Try the resend confirmation action below.";
    case "temporary_email_failure":
      return "Signup could not finish because the email service had a temporary issue. Please try again shortly.";
    case "signup_failed":
    default:
      return "Signup failed before the account could be completed. Please review your details and try again.";
  }
};
