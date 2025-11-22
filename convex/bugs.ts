import { v } from "convex/values";
import { AuthOrgMutation } from "./helpers/authenticated";

export const report = AuthOrgMutation({
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
    const orgId = ctx.orgId;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", userId))
      .unique();
    const userEmail = user?.email || ctx.identity.email || "";

    const now = Date.now();
    await ctx.db.insert("bugs", {
      userId,
      orgId,
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


