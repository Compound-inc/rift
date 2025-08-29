import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

/**
 * Helper function to get the authenticated user ID from any Convex context.
 * Throws an error if the user is not authenticated.
 */
export async function getAuthUserId(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Unauthenticated call - user must be logged in");
  }
  return identity.subject;
}

/**
 * Helper function to get the full user identity from any Convex context.
 * Returns null if the user is not authenticated.
 */
export async function getAuthUserIdentity(ctx: QueryCtx | MutationCtx | ActionCtx) {
  return await ctx.auth.getUserIdentity();
} 