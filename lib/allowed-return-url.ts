/**
 * Validates and normalizes a return/success URL to prevent open redirects.
 * Only allows same-origin URLs or paths relative to the app origin.
 */
export function getAllowedReturnUrl(returnUrl: string | undefined): string {
  const productionDomain =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const origin = productionDomain
    ? `https://${productionDomain}`
    : "http://localhost:3000";

  if (!returnUrl?.trim()) return origin;

  const trimmed = returnUrl.trim();
  if (trimmed.startsWith("/")) {
    try {
      return new URL(trimmed, origin).href;
    } catch {
      return origin;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.origin === new URL(origin).origin) return parsed.href;
  } catch {
    /* invalid URL */
  }
  return origin;
}
