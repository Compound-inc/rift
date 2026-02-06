import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { serverSecretArg, ensureServerSecret } from "../helpers/auth";

/**
 * Clear legacy user fields so they can be removed from the schema.
 * Run via: bun run scripts/clear-legacy-fields.ts
 */
export const clearUsersLegacyFields = mutation({
  args: { ...serverSecretArg },
  returns: v.object({ updated: v.number() }),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    const users = await ctx.db.query("users").collect();
    const legacyPatch = {
      standardQuotaUsage: undefined,
      premiumQuotaUsage: undefined,
      lastQuotaResetAt: undefined,
    };
    for (const user of users) {
      await ctx.db.patch(user._id, legacyPatch);
    }
    return { updated: users.length };
  },
});
