"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { parsePermissionsFromAccessToken, PERMISSIONS } from "@/lib/permissions";
import { Autumn } from "autumn-js";

function getAllowedReturnUrl(returnUrl: string | undefined): string {
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

/**
 * Returns an Autumn billing portal URL for the current user's organization.
 */
export async function getAutumnBillingPortalUrl(
  returnUrl?: string,
): Promise<{ url: string } | { error: string }> {
  const session = await withAuth();
  if (!session?.accessToken) {
    return { error: "Unauthorized" };
  }

  const permissions = parsePermissionsFromAccessToken(session.accessToken);
  if (!permissions.has(PERMISSIONS.MANAGE_BILLING)) {
    return { error: "Forbidden" };
  }

  const orgId = session.organizationId;
  if (!orgId) {
    return { error: "Forbidden" };
  }

  const secretKey = process.env.AUTUMN_SECRET_KEY;
  if (!secretKey) {
    return { error: "AUTUMN_SECRET_KEY is not set" };
  }

  const validatedReturnUrl = getAllowedReturnUrl(returnUrl);
  const autumn = new Autumn({ secretKey });
  const result = await autumn.customers.billingPortal(orgId, {
    return_url: validatedReturnUrl,
  });

  if ("error" in result && result.error) {
    const message = (result.error as { message?: string }).message ?? "Unknown error";
    return { error: message };
  }

  const data = "data" in result ? result.data : null;
  if (!data?.url) {
    return { error: "No billing portal URL returned" };
  }

  return { url: data.url };
}
