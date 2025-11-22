"use server";

import { stripe } from "@/app/api/stripe";
import { headers } from "next/headers";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { hasPermissions } from "@/lib/permissions";

export async function createStripePortalSession(stripeCustomerId: string) {
  try {
    const { organizationId } = await withAuth();

    if (!organizationId) {
      throw new Error("Unauthorized: No organization ID found in session.");
    }

    const permissions = await hasPermissions(["MANAGE_BILLING"]);
    if (!permissions.MANAGE_BILLING) {
      throw new Error("Unauthorized: Missing 'manage-billing' permission.");
    }

    const headersList = await headers();
    const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/settings/billing`,
    });

    return { url: session.url };
  } catch (error) {
    console.error("Error creating portal session:", error);
    throw new Error("Failed to create portal session");
  }
}
