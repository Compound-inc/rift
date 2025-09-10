import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const createOrganization = internalMutation({
  args: { workos_id: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("organizations", args);
  },
});

export const updateOrganization = internalMutation({
  args: {
    id: v.id("organizations"),
    patch: v.object({
      workos_id: v.optional(v.string()),
      name: v.optional(v.string()),
      stripeCustomerId: v.optional(v.string()),
      billingCycleStart: v.optional(v.number()),
      billingCycleEnd: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, args.patch);
  },
});

export const deleteOrganization = internalMutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
  },
});

export const getByWorkOSId = internalQuery({
  args: { workos_id: v.string() },
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();
    return organization;
  },
});

export const getOrganizationInfo = internalQuery({
  args: { workos_id: v.string() },
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();

    if (!organization) {
      return null;
    }

    return {
      id: organization._id,
      workos_id: organization.workos_id,
      name: organization.name,
      billingCycleStart: organization.billingCycleStart,
      billingCycleEnd: organization.billingCycleEnd,
      hasBillingCycle: !!(
        organization.billingCycleStart && organization.billingCycleEnd
      ),
    };
  },
});

export const updateBillingCycle = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    billingCycleStart: v.number(),
    billingCycleEnd: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.organizationId, {
      billingCycleStart: args.billingCycleStart,
      billingCycleEnd: args.billingCycleEnd,
    });
  },
});

export const setStripeCustomerIdByWorkOSId = internalMutation({
  args: { workos_id: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();

    if (existing?._id) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
      });
      return existing._id;
    }

    return await ctx.db.insert("organizations", {
      workos_id: args.workos_id,
      name: "",
      stripeCustomerId: args.stripeCustomerId,
    });
  },
});

export const getOrganizationByStripeCustomerId = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_stripe_customer_id", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();
    return organization;
  },
});

export const updateBillingCycleFromStripe = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    billingCycleStart: v.number(),
    billingCycleEnd: v.number(),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    console.log('Looking for organization with Stripe customer ID:', args.stripeCustomerId);
    
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_stripe_customer_id", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    console.log('Found organization:', organization);

    if (!organization) {
      console.log('No organization found, checking all organizations with Stripe customer IDs...');
      const allOrgs = await ctx.db.query("organizations").collect();
      const orgsWithStripe = allOrgs.filter(org => org.stripeCustomerId);
      console.log('Organizations with Stripe customer IDs:', orgsWithStripe.map(org => ({ 
        id: org._id, 
        stripeCustomerId: org.stripeCustomerId,
        name: org.name 
      })));
      throw new Error(`Organization not found for Stripe customer ID: ${args.stripeCustomerId}`);
    }

    console.log('Updating organization:', organization._id, 'with billing cycle:', {
      start: args.billingCycleStart,
      end: args.billingCycleEnd
    });

    await ctx.db.patch(organization._id, {
      billingCycleStart: args.billingCycleStart,
      billingCycleEnd: args.billingCycleEnd,
    });

    console.log('Successfully updated organization billing cycle');
    return organization._id;
  },
});
