import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { AuthMutation, AuthQuery } from "./helpers/authenticated";
import { extractOrganizationIdFromJWT } from "./helpers/identity";
import { ensureServerSecret } from "./helpers/auth";
import { Doc } from "./_generated/dataModel";

export const create = AuthMutation({
  args: {
    title: v.string(),
    description: v.string(),
    icon: v.string(),
    iconColor: v.optional(v.string()),
    instructions: v.string(),
    isSharedWithOrg: v.boolean(),
  },
  handler: async (ctx, args) => {
    const orgId = extractOrganizationIdFromJWT(ctx.identity);
    
    // Validation
    if (args.title.length > 60) throw new Error("Title too long (max 60)");
    if (args.description.length > 180) throw new Error("Description too long (max 180)");
    if (args.instructions.length > 25000) throw new Error("Instructions too long (max 25000)");

    const id = await ctx.db.insert("customInstructions", {
      ...args,
      ownerId: ctx.identity.subject,
      orgId: orgId ?? undefined,
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return id;
  },
});

export const update = AuthMutation({
  args: {
    id: v.id("customInstructions"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    iconColor: v.optional(v.string()),
    instructions: v.optional(v.string()),
    isSharedWithOrg: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const instruction = await ctx.db.get(args.id);
    if (!instruction) {
      throw new Error("Instruction not found");
    }

    if (instruction.ownerId !== ctx.identity.subject) {
      throw new Error("Unauthorized");
    }

    // Validation
    if (args.title && args.title.length > 60) throw new Error("Title too long (max 60)");
    if (args.description && args.description.length > 180) throw new Error("Description too long (max 180)");
    if (args.instructions && args.instructions.length > 25000) throw new Error("Instructions too long (max 25000)");

    const { id, ...updates } = args;
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const remove = AuthMutation({
  args: {
    id: v.id("customInstructions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const instruction = await ctx.db.get(args.id);
    if (!instruction) {
      throw new Error("Instruction not found");
    }

    if (instruction.ownerId !== ctx.identity.subject) {
      throw new Error("Unauthorized");
    }

    // Delete associated share records
    const shares = await ctx.db
      .query("customInstructionShares")
      .withIndex("by_instruction", (q) => q.eq("instructionId", args.id))
      .collect();
    for (const share of shares) {
      await ctx.db.delete(share._id);
    }

    await ctx.db.delete(args.id);
    return null;
  },
});

export const list = AuthQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        _id: v.id("customInstructions"),
        _creationTime: v.number(),
        title: v.string(),
        description: v.string(),
        icon: v.string(),
        iconColor: v.optional(v.string()),
        instructions: v.string(),
        ownerId: v.string(),
        orgId: v.optional(v.string()),
        isSharedWithOrg: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
        ownerName: v.string(),
      })
    )
  ),
  handler: async (ctx) => {
    const userId = ctx.identity.subject;
    const orgId = extractOrganizationIdFromJWT(ctx.identity);

    // Get instructions owned by the user
    const myInstructions = await ctx.db
      .query("customInstructions")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    // Get instructions shared with the org (excluding user's own)
    let orgInstructions: Doc<"customInstructions">[] = [];
    if (orgId) {
      orgInstructions = await ctx.db
        .query("customInstructions")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .filter((q) => 
          q.and(
            q.eq(q.field("isSharedWithOrg"), true),
            q.neq(q.field("ownerId"), userId)
          )
        )
        .collect();
    }

    // Combine user's own instructions with org-shared instructions
    const combined = [...myInstructions, ...orgInstructions];
    
    // Fetch owner information for unique owners only (scales to millions of users)
    const ownerIds = [...new Set(combined.map(inst => inst.ownerId))];
    const owners = await Promise.all(
      ownerIds.map(id => 
        ctx.db
          .query("users")
          .withIndex("by_workos_id", (q) => q.eq("workos_id", id))
          .unique()
      )
    );
    const ownerMap = new Map(
      owners
        .filter((o): o is NonNullable<typeof o> => o !== null)
        .map(o => [o.workos_id, o])
    );
    
    const results = combined.map((inst) => {
      const owner = ownerMap.get(inst.ownerId);
      const { usageCount, ...instWithoutUsage } = inst;
      
      return {
        ...instWithoutUsage,
        ownerName: owner 
          ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() || owner.email 
          : "Usuario",
      };
    });
    
    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = AuthQuery({
  args: {
    id: v.id("customInstructions"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("customInstructions"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.string(),
      icon: v.string(),
      iconColor: v.optional(v.string()),
      instructions: v.string(),
      ownerId: v.string(),
      orgId: v.optional(v.string()),
      isSharedWithOrg: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      ownerName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const orgId = extractOrganizationIdFromJWT(ctx.identity);
    const instruction = await ctx.db.get(args.id);
    
    if (!instruction) {
      return null;
    }

    // Check access
    const isOwner = instruction.ownerId === userId;
    const isOrgMember = orgId && instruction.orgId === orgId && instruction.isSharedWithOrg;

    if (!isOwner && !isOrgMember) {
      return null;
    }

    const owner = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", instruction.ownerId))
      .unique();

    const { usageCount, ...instructionWithoutUsage } = instruction;

    return {
      ...instructionWithoutUsage,
      ownerName: owner 
        ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() || owner.email 
        : "Usuario",
    };
  },
});

export const serverGet = query({
  args: {
    id: v.id("customInstructions"),
    secret: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("customInstructions"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.string(),
      icon: v.string(),
      iconColor: v.optional(v.string()),
      instructions: v.string(),
      ownerId: v.string(),
      orgId: v.optional(v.string()),
      isSharedWithOrg: v.boolean(),
      usageCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);

    const instruction = await ctx.db.get(args.id);
    return instruction;
  },
});

export const serverIncrementUsage = mutation({
  args: {
    id: v.id("customInstructions"),
    secret: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);

    const instruction = await ctx.db.get(args.id);
    if (instruction) {
      await ctx.db.patch(args.id, {
        usageCount: (instruction.usageCount || 0) + 1,
      });
    }
    return null;
  },
});
