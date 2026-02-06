"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { parsePermissionsFromAccessToken, PERMISSIONS } from "@/lib/permissions";
import { Autumn } from "autumn-js";

const PAID_PLANS = ["plus", "pro"] as const;

/**
 * Returns an Autumn checkout URL for subscribing to a paid plan.
 * Only users in an org with MANAGE_BILLING can subscribe.
 */
export async function getSubscribeCheckoutUrl(
  productId: string,
  successUrl: string,
): Promise<{ url: string } | { attached: true } | { error: string }> {
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

  const plan = productId?.toLowerCase();
  if (!plan || !PAID_PLANS.includes(plan as (typeof PAID_PLANS)[number])) {
    return { error: "Invalid plan" };
  }

  const secretKey = process.env.AUTUMN_SECRET_KEY;
  if (!secretKey) {
    return { error: "AUTUMN_SECRET_KEY is not set" };
  }

  const autumn = new Autumn({ secretKey });
  const result = await autumn.attach({
    customer_id: orgId,
    product_id: plan,
    success_url: successUrl,
  });

  if ("error" in result && result.error) {
    const message =
      (result.error as { message?: string }).message ?? "Checkout failed";
    return { error: message };
  }

  const data = "data" in result ? result.data : null;
  if (data?.checkout_url) {
    return { url: data.checkout_url };
  }

  return { attached: true };
}
