import { v } from "convex/values";
import { AuthMutation } from "./helpers/authenticated";
import { extractOrganizationIdFromJWT } from "./helpers/identity";

export const report = AuthMutation({
  args: {
    title: v.string(),
    description: v.string(),
    stepsToReproduce: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    browserDetails: v.string(),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    // Extract orgId from JWT if available, but allow it to be null
    const orgId = extractOrganizationIdFromJWT(ctx.identity) || null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", userId))
      .unique();
    const userEmail = user?.email || ctx.identity.email || "";

    const now = Date.now();
    await ctx.db.insert("bugs", {
      userId,
      orgId: orgId || undefined,
      userEmail,
      title: args.title,
      description: args.description,
      stepsToReproduce: args.stepsToReproduce,
      priority: args.priority,
      browserDetails: args.browserDetails,
      reportedAt: now,
    });

    return { ok: true };
  },
});


