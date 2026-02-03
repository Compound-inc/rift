import {
    internalQuery,
    internalMutation,
    mutation,
  } from "../_generated/server";
  import { v } from "convex/values";
  import { internal } from "../_generated/api";
  import { productStatusValidator } from "../schema";
  import { serverSecretArg, ensureServerSecret } from "../helpers/auth";
  
  // Plan configurations for admin dashboard
  const ADMIN_PLAN_CONFIGS = {
    free: {
      standardQuotaLimit: 20,
      premiumQuotaLimit: 1,
    },
    plus: {
      standardQuotaLimit: 1000,
      premiumQuotaLimit: 100,
    },
    pro: {
      standardQuotaLimit: 1500,
      premiumQuotaLimit: 300,
    },
  } as const;
    
  /**
   * List all organizations with their data for admin dashboard.
   */
  export const listAllOrganizations = internalQuery({
    args: {},
    returns: v.array(
      v.object({
        _id: v.id("organizations"),
        _creationTime: v.number(),
        workos_id: v.string(),
        name: v.string(),
        plan: v.optional(v.union(v.literal("free"), v.literal("plus"), v.literal("pro"), v.literal("enterprise"))),
        standardQuotaLimit: v.optional(v.number()),
        premiumQuotaLimit: v.optional(v.number()),
        seatQuantity: v.optional(v.number()),
        productId: v.optional(v.string()),
        productStatus: v.optional(productStatusValidator),
        currentPeriodStart: v.optional(v.number()),
        currentPeriodEnd: v.optional(v.number()),
        subscriptionIds: v.optional(v.array(v.string())),
        cancelAtPeriodEnd: v.optional(v.boolean()),
      }),
    ),
    handler: async (ctx) => {
      return await ctx.db.query("organizations").collect();
    },
  });
  
  /**
   * Set organization plan and update quotas
   */
  export const setOrganizationPlan = internalMutation({
    args: {
      organizationId: v.id("organizations"),
      plan: v.union(v.literal("free"), v.literal("plus"), v.literal("pro"), v.literal("enterprise")),
      customStandardQuotaLimit: v.optional(v.number()),
      customPremiumQuotaLimit: v.optional(v.number()),
      seatQuantity: v.optional(v.number()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const organization = await ctx.db.get(args.organizationId);
      
      if (!organization) {
        throw new Error(`Organization not found: ${args.organizationId}`);
      }
  
      let standardQuotaLimit: number;
      let premiumQuotaLimit: number;

      if (args.plan === "enterprise") {
        if (args.customStandardQuotaLimit === undefined || args.customPremiumQuotaLimit === undefined) {
             throw new Error("Custom quotas required for enterprise plan");
        }
        standardQuotaLimit = args.customStandardQuotaLimit;
        premiumQuotaLimit = args.customPremiumQuotaLimit;
      } else {
        const planConfig = ADMIN_PLAN_CONFIGS[args.plan];
        standardQuotaLimit = planConfig.standardQuotaLimit;
        premiumQuotaLimit = planConfig.premiumQuotaLimit;
      }

      await ctx.db.patch(args.organizationId, {
        plan: args.plan,
        standardQuotaLimit,
        premiumQuotaLimit,
        seatQuantity: args.seatQuantity,
        productStatus: "active",
      });
    },
  });
  
  
  /**
   * Clear legacy organization fields so they can be removed from the schema.
   * Run via: bun run scripts/clear-org-legacy-fields.ts
   */
  export const clearOrganizationsLegacyFields = mutation({
    args: { ...serverSecretArg },
    returns: v.object({ updated: v.number() }),
    handler: async (ctx, args) => {
      ensureServerSecret(args.secret);
      const orgs = await ctx.db.query("organizations").collect();
      const legacyPatch = {
        billingCycleStart: undefined,
        billingCycleEnd: undefined,
        stripeCustomerId: undefined,
        subscriptionId: undefined,
        subscriptionStatus: undefined,
        priceId: undefined,
        paymentMethodBrand: undefined,
        paymentMethodLast4: undefined,
      };
      for (const org of orgs) {
        await ctx.db.patch(org._id, legacyPatch);
      }
      return { updated: orgs.length };
    },
  });

  /**
   * Get organization by ID for admin operations
   */
  export const getOrganizationById = internalQuery({
    args: {
      organizationId: v.id("organizations"),
    },
    returns: v.union(
      v.object({
        _id: v.id("organizations"),
        _creationTime: v.number(),
        workos_id: v.string(),
        name: v.string(),
        plan: v.optional(v.union(v.literal("free"), v.literal("plus"), v.literal("pro"), v.literal("enterprise"))),
        standardQuotaLimit: v.optional(v.number()),
        premiumQuotaLimit: v.optional(v.number()),
        seatQuantity: v.optional(v.number()),
        productId: v.optional(v.string()),
        productStatus: v.optional(productStatusValidator),
        currentPeriodStart: v.optional(v.number()),
        currentPeriodEnd: v.optional(v.number()),
        subscriptionIds: v.optional(v.array(v.string())),
        cancelAtPeriodEnd: v.optional(v.boolean()),
      }),
      v.null(),
    ),
    handler: async (ctx, args) => {
      return await ctx.db.get(args.organizationId);
    },
  });

  /**
   * Cancel organization subscription immediately
   */
  export const cancelOrganizationSubscriptionNow = internalMutation({
    args: {
      organizationId: v.id("organizations"),
      subscriptionStatus: v.union(
        v.literal("active"),
        v.literal("canceled"),
        v.literal("incomplete"),
        v.literal("incomplete_expired"),
        v.literal("past_due"),
        v.literal("trialing"),
        v.literal("unpaid"),
        v.literal("none"),
      ),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const organization = await ctx.db.get(args.organizationId);
      
      if (!organization) {
        throw new Error(`Organization not found: ${args.organizationId}`);
      }

      await ctx.db.patch(args.organizationId, {
        productStatus: args.subscriptionStatus,
        plan: undefined,
        standardQuotaLimit: undefined,
        premiumQuotaLimit: undefined,
        currentPeriodStart: undefined,
        currentPeriodEnd: undefined,
        subscriptionIds: undefined,
        productId: undefined,
        cancelAtPeriodEnd: undefined,
      });
    },
  });

  /**
   * Cancel organization subscription at end of billing cycle
   */
  export const cancelOrganizationSubscriptionAtCycleEnd = internalMutation({
    args: {
      organizationId: v.id("organizations"),
      subscriptionStatus: v.union(
        v.literal("active"),
        v.literal("canceled"),
        v.literal("incomplete"),
        v.literal("incomplete_expired"),
        v.literal("past_due"),
        v.literal("trialing"),
        v.literal("unpaid"),
        v.literal("none"),
      ),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const organization = await ctx.db.get(args.organizationId);
      
      if (!organization) {
        throw new Error(`Organization not found: ${args.organizationId}`);
      }

      if (!organization.currentPeriodEnd) {
        throw new Error(`Organization has no billing cycle end date: ${args.organizationId}`);
      }

      await ctx.db.patch(args.organizationId, {
        cancelAtPeriodEnd: true,
      });
    },
  });

  /**
   * Execute cancellation at the end of billing cycle
   */
  export const executeCancellationAtCycleEnd = internalMutation({
    args: {
      organizationId: v.id("organizations"),
      subscriptionStatus: v.union(
        v.literal("active"),
        v.literal("canceled"),
        v.literal("incomplete"),
        v.literal("incomplete_expired"),
        v.literal("past_due"),
        v.literal("trialing"),
        v.literal("unpaid"),
        v.literal("none"),
      ),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      // Simply call the existing immediate cancellation function
      await ctx.runMutation(internal.admin.organizations.cancelOrganizationSubscriptionNow, {
        organizationId: args.organizationId,
        subscriptionStatus: args.subscriptionStatus,
      });
    },
  });