"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { parsePermissionsFromAccessToken, PERMISSIONS } from "@/lib/permissions";
import { Autumn } from "autumn-js";

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

  const autumn = new Autumn({ secretKey });
  const result = await autumn.customers.billingPortal(orgId, {
    return_url: returnUrl?.trim() || undefined,
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
