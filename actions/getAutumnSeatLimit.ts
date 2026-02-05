"use server";

import { Autumn } from "autumn-js";

/**
 * Returns the seat limit for the given organization (Autumn customer id = WorkOS org id).
 * Returns null if the customer is not in Autumn, has no seats feature, or on error.
 *
 * Security: Only pass organizationId from server-side withAuth() (session). Do not pass
 * client-provided values—callers must derive org from the authenticated session.
 */
export async function getAutumnSeatLimitForOrg(
  organizationId: string
): Promise<number | null> {
  try {
    const secretKey = process.env.AUTUMN_SECRET_KEY;
    if (!secretKey) return null;

    const autumn = new Autumn({ secretKey });
    const result = await autumn.check({
      customer_id: organizationId,
      feature_id: "seats",
    });

    if (result.error) return null;
    const data = result.data as
      | {
          allowed?: boolean;
          unlimited?: boolean;
          balance?: number | null;
          usage?: number;
          included_usage?: number;
        }
      | undefined;
    if (!data) return null;

    if (data.unlimited === true) return null;

    if (typeof data.included_usage === "number" && data.included_usage > 0) {
      return data.included_usage;
    }
    const balance = data.balance ?? 0;
    const usage = data.usage ?? 0;
    const total = balance + usage;
    return total > 0 ? total : null;
  } catch (error) {
    console.error("getAutumnSeatLimitForOrg:", error);
    return null;
  }
}
