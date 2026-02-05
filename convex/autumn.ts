"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Webhook } from "svix";

// All customer.products.updated scenarios that indicate a billing/plan change (per Autumn docs).
const PRODUCT_UPDATE_SCENARIOS = new Set([
  "new",
  "upgrade",
  "downgrade",
  "renew",
  "cancel",
  "expired",
  "past_due",
  "scheduled",
]);

// Product status values we store
const VALID_PRODUCT_STATUSES = new Set([
  "active",
  "expired",
  "scheduled",
  "trialing",
  "past_due",
  "canceled",
  "none",
  "incomplete",
  "incomplete_expired",
  "unpaid",
]);

function normalizeProductStatus(status: string | undefined): "active" | "expired" | "scheduled" | "trialing" | "past_due" | "canceled" | "none" | "incomplete" | "incomplete_expired" | "unpaid" {
  if (status && VALID_PRODUCT_STATUSES.has(status)) {
    return status as "active" | "expired" | "scheduled" | "trialing" | "past_due" | "canceled" | "none" | "incomplete" | "incomplete_expired" | "unpaid";
  }
  return "none";
}

type WebhookProduct = {
  id: string;
  status?: string;
  current_period_start?: number | null;
  current_period_end?: number | null;
  subscription_ids?: string[] | null;
};

type WebhookUpdatedProduct = { id: string; name?: string | null };

type WebhookCustomer = {
  id: string;
  products?: WebhookProduct[];
};

function isCustomerProductsUpdatedEvent(
  value: unknown,
): value is {
  type: "customer.products.updated";
  data: {
    scenario: string;
    customer?: WebhookCustomer;
    updated_product?: WebhookUpdatedProduct;
  };
} {
  if (!value || typeof value !== "object") return false;
  const e = value as { type?: string; data?: { scenario?: string; customer?: { id?: string } } };
  return e.type === "customer.products.updated" && typeof e.data?.scenario === "string";
}

function getActiveProduct(products: WebhookProduct[]): WebhookProduct | undefined {
  const active = products.find((p) => p.status === "active");
  if (active) return active;
  const withPeriod = products.find((p) => p.current_period_end != null);
  if (withPeriod) return withPeriod;
  return undefined;
}

/** Resolve the product to sync: prefer updated_product from event, then active product from customer.products. */
function getProductToSync(
  products: WebhookProduct[],
  updatedProductId: string | undefined,
): WebhookProduct | undefined {
  if (updatedProductId) {
    const match = products.find((p) => p.id === updatedProductId);
    if (match) return match;
  }
  return getActiveProduct(products);
}

type AutumnWebhookResult =
  | { status: "ignored" }
  | {
      status: "ok";
      scenario: string;
      organization?: {
        id: string;
        workos_id: string;
        name: string;
        plan: string | null;
      };
    };

export const handleAutumnWebhook = internalAction({
  args: {
    payload: v.string(),
    svixId: v.string(),
    svixTimestamp: v.string(),
    svixSignature: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal("ok"), v.literal("ignored")),
    scenario: v.optional(v.string()),
    organization: v.optional(
      v.object({
        id: v.string(),
        workos_id: v.string(),
        name: v.string(),
        plan: v.union(v.string(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, args): Promise<AutumnWebhookResult> => {
    const webhookSecret = process.env.AUTUMN_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Autumn webhook] AUTUMN_WEBHOOK_SECRET is not set");
      throw new Error("AUTUMN_WEBHOOK_SECRET is not set");
    }

    let event: unknown;
    try {
      event = new Webhook(webhookSecret).verify(args.payload, {
        "svix-id": args.svixId,
        "svix-timestamp": args.svixTimestamp,
        "svix-signature": args.svixSignature,
      });
    } catch (verifyErr) {
      console.error("[Autumn webhook] Signature verification failed:", verifyErr);
      throw new Error("Invalid webhook signature");
    }

    if (!isCustomerProductsUpdatedEvent(event)) {
      console.warn("[Autumn webhook] Ignored: unsupported event type", (event as { type?: string })?.type);
      return { status: "ignored" as const };
    }

    const scenario = event.data.scenario;
    if (!PRODUCT_UPDATE_SCENARIOS.has(scenario)) {
      console.warn("[Autumn webhook] Ignored: scenario not in product update set", scenario);
      return { status: "ignored" as const };
    }

    const workos_id = event.data.customer?.id;
    if (!workos_id) {
      console.error("[Autumn webhook] Missing customer id in event data");
      throw new Error("Missing customer id");
    }

    const updatedProductId = event.data.updated_product?.id;
    const products = event.data.customer?.products ?? [];
    const productToSync = getProductToSync(products, updatedProductId);

    const product = {
      productId: productToSync?.id ?? null,
      status: normalizeProductStatus(productToSync?.status),
    };

    await ctx.runMutation(internal.organizations.syncAutumnSubscriptionData, {
      workos_id,
      product,
    });

    const org = await ctx.runQuery(
      internal.organizations.getOrganizationInfo,
      { workos_id },
    );
    return {
      status: "ok" as const,
      scenario,
      organization: org
        ? {
            id: org.id,
            workos_id: org.workos_id,
            name: org.name,
            plan: org.plan ?? null,
          }
        : undefined,
    };
  },
});
