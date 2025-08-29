import { mutation } from "./_generated/server";

export const myMutation = mutation({
  args: {
    
  },
  handler: async (ctx, args) => {
    console.log("server identity", await ctx.auth.getUserIdentity());
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Unauthenticated call to mutation");
    }
    //...
  },
});