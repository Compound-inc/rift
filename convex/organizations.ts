import {
  query,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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

export const getByWorkOSIdPublic = query({
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
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .first();
    return organization;
  },
});

export const syncStripeSubscriptionData = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    subscriptionData: v.object({
      subscriptionId: v.optional(v.string()),
      status: v.string(),
      priceId: v.optional(v.union(v.string(), v.null())),
      billingCycleStart: v.optional(v.union(v.number(), v.null())),
      billingCycleEnd: v.optional(v.union(v.number(), v.null())),
      cancelAtPeriodEnd: v.optional(v.boolean()),
      paymentMethodBrand: v.optional(v.union(v.string(), v.null())),
      paymentMethodLast4: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .first();

    if (!organization) {
      throw new Error(
        `Organization not found for Stripe customer ID: ${args.stripeCustomerId}`,
      );
    }

    await ctx.db.patch(organization._id, {
      subscriptionId: args.subscriptionData.subscriptionId,
      subscriptionStatus: args.subscriptionData.status as any,
      priceId: args.subscriptionData.priceId || undefined,
      cancelAtPeriodEnd: args.subscriptionData.cancelAtPeriodEnd,
      paymentMethodBrand: args.subscriptionData.paymentMethodBrand || undefined,
      paymentMethodLast4: args.subscriptionData.paymentMethodLast4 || undefined,
      // Update billing cycle fields (used by quota system)
      billingCycleStart: args.subscriptionData.billingCycleStart || undefined,
      billingCycleEnd: args.subscriptionData.billingCycleEnd || undefined,
    });
    return organization._id;
  },
});

export const syncStripeDataWithPeriod = internalAction({
  args: {
    stripeCustomerId: v.string(),
    billingPeriod: v.optional(
      v.object({
        start: v.number(),
        end: v.number(),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    subscriptionId?: string;
    status: string;
    priceId?: string;
    billingCycleStart?: number;
    billingCycleEnd?: number;
    cancelAtPeriodEnd?: boolean;
    paymentMethodBrand?: string;
    paymentMethodLast4?: string;
  }> => {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_API_KEY!);

    try {
      // Fetch latest subscription data from Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: args.stripeCustomerId,
        limit: 1,
        status: "all",
        expand: ["data.default_payment_method"],
      });

      let subscriptionData;

      if (subscriptions.data.length === 0) {
        subscriptionData = {
          status: "none",
          billingCycleStart: undefined,
          billingCycleEnd: undefined,
        };
      } else {
        const subscription = subscriptions.data[0];

        subscriptionData = {
          subscriptionId: subscription.id,
          status: subscription.status,
          priceId: subscription.items.data[0]?.price?.id || null,
          billingCycleStart: args.billingPeriod?.start,
          billingCycleEnd: args.billingPeriod?.end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          paymentMethodBrand:
            subscription.default_payment_method &&
            typeof subscription.default_payment_method !== "string"
              ? (subscription.default_payment_method as any).card?.brand || null
              : null,
          paymentMethodLast4:
            subscription.default_payment_method &&
            typeof subscription.default_payment_method !== "string"
              ? (subscription.default_payment_method as any).card?.last4 || null
              : null,
        };
      }

      // Store the data in Convex
      await ctx.runMutation(internal.organizations.syncStripeSubscriptionData, {
        stripeCustomerId: args.stripeCustomerId,
        subscriptionData,
      });

      // Convert null values to undefined for return type compatibility
      return {
        ...subscriptionData,
        priceId: subscriptionData.priceId || undefined,
        billingCycleStart: subscriptionData.billingCycleStart || undefined,
        billingCycleEnd: subscriptionData.billingCycleEnd || undefined,
        paymentMethodBrand: subscriptionData.paymentMethodBrand || undefined,
        paymentMethodLast4: subscriptionData.paymentMethodLast4 || undefined,
      };
    } catch (error) {
      console.error(
        "Failed to sync Stripe data for customer:",
        args.stripeCustomerId,
        error,
      );
      throw error;
    }
  },
});

export const getSubscriptionData = internalQuery({
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
      subscriptionId: organization.subscriptionId,
      subscriptionStatus: organization.subscriptionStatus || "none",
      priceId: organization.priceId,
      billingCycleStart: organization.billingCycleStart,
      billingCycleEnd: organization.billingCycleEnd,
      cancelAtPeriodEnd: organization.cancelAtPeriodEnd,
      paymentMethodBrand: organization.paymentMethodBrand,
      paymentMethodLast4: organization.paymentMethodLast4,
      stripeCustomerId: organization.stripeCustomerId,
    };
  },
});
