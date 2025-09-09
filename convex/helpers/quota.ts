import { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Extract organization ID from JWT token claims
 */
export function extractOrganizationIdFromJWT(
  identity: { org_id?: string } & Record<string, unknown>,
): string | null {
  try {
    return identity?.org_id || null;
  } catch (error) {
    console.error("Error extracting organization ID from JWT:", error);
    return null;
  }
}

/**
 * Extract entitlements from JWT token claims
 */
export function extractEntitlementsFromJWT(
  identity: { entitlements?: string[] } & Record<string, unknown>,
): { messageLimit: number; planType: string } | null {
  try {
    // Check if entitlements exist in the JWT token
    if (!identity?.entitlements || !Array.isArray(identity.entitlements)) {
      return null;
    }

    // Find the first entitlement that matches the expected format
    const entitlement = identity.entitlements.find(
      (ent: string) => typeof ent === "string" && ent.includes("-"),
    );

    if (!entitlement) {
      return null;
    }

    // Parse entitlement format: "200-standard"
    const parts = entitlement.split("-");
    if (parts.length !== 2) {
      return null;
    }

    const messageLimit = parseInt(parts[0], 10);
    const planType = parts[1];

    if (isNaN(messageLimit) || messageLimit <= 0) {
      return null;
    }

    return { messageLimit, planType };
  } catch (error) {
    console.error("Error extracting entitlements from JWT:", error);
    return null;
  }
}

/**
 * Check if user is within quota limits
 */
export async function checkQuotaLimit(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  messageLimit: number,
  billingCycleStart?: number,
): Promise<{ allowed: boolean; currentUsage: number; limit: number }> {
  try {
    // Get user's current quota usage
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("workos_id"), userId))
      .first();

    if (!user) {
      throw new Error(`User not found with workos_id: ${userId}`);
    }

    const currentUsage = user.quotaUsage || 0;
    const lastResetAt = user.lastQuotaResetAt || 0;

    // If we have billing cycle info, check if quota should be reset
    let effectiveUsage = currentUsage;
    if (billingCycleStart && lastResetAt < billingCycleStart) {
      effectiveUsage = 0;
    }

    const allowed = effectiveUsage < messageLimit;

    return {
      allowed,
      currentUsage: effectiveUsage,
      limit: messageLimit,
    };
  } catch (error) {
    console.error("Error checking quota limit:", error);
    throw error;
  }
}

/**
 * Increment user's quota usage
 */
export async function incrementQuotaUsage(
  ctx: MutationCtx,
  userId: string,
  billingCycleStart?: number,
): Promise<number> {
  try {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("workos_id"), userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const currentUsage = user.quotaUsage || 0;
    const lastResetAt = user.lastQuotaResetAt || 0;
    const now = Date.now();

    // If billing cycle started after last reset, reset usage
    let newUsage: number;
    let newResetAt: number;

    if (billingCycleStart && lastResetAt < billingCycleStart) {
      newUsage = 1; // Start fresh with this message
      newResetAt = now;
    } else {
      newUsage = currentUsage + 1;
      newResetAt = lastResetAt || now;
    }

    // Update user's quota usage
    await ctx.db.patch(user._id, {
      quotaUsage: newUsage,
      lastQuotaResetAt: newResetAt,
    });

    return newUsage;
  } catch (error) {
    console.error("Error incrementing quota usage:", error);
    throw error;
  }
}

/**
 * Get organization billing cycle info by WorkOS organization ID
 */
export async function getOrganizationBillingCycle(
  ctx: QueryCtx | MutationCtx,
  orgWorkosId: string,
): Promise<{ billingCycleStart?: number; billingCycleEnd?: number } | null> {
  try {
    const organization = await ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("workos_id"), orgWorkosId))
      .first();

    if (!organization) {
      return null;
    }

    return {
      billingCycleStart: organization.billingCycleStart,
      billingCycleEnd: organization.billingCycleEnd,
    };
  } catch (error) {
    console.error("Error getting organization billing cycle:", error);
    return null;
  }
}
