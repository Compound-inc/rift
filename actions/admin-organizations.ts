"use server";

import { after } from "next/server";
import { Autumn } from "autumn-js";
import { isAdmin } from "@/lib/admin-auth";

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL ?? "";
const CONVEX_ADMIN_TOKEN = process.env.CONVEX_ADMIN_TOKEN ?? "";
const VALID_PLANS = ["plus", "pro", "enterprise"] as const;
const VALID_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "trialing",
  "unpaid",
  "none",
]);

export type OrganizationRow = {
  _id: string;
  _creationTime: number;
  workos_id: string;
  name: string;
  plan?: "free" | "plus" | "pro" | "enterprise";
  productStatus?: string;
};

export async function listOrganizationsAction(): Promise<
  { data: OrganizationRow[] } | { error: string }
> {
  const ok = await isAdmin();
  if (!ok) {
    return { error: "Forbidden" };
  }

  if (!CONVEX_SITE_URL || !CONVEX_ADMIN_TOKEN) {
    return { error: "Server configuration error" };
  }

  try {
    const response = await fetch(`${CONVEX_SITE_URL}/admin/organizations`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${CONVEX_ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: (errorData as { error?: string }).error ?? "Failed to fetch organizations" };
    }

    const data = (await response.json()) as OrganizationRow[];
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    after(() => {
      console.error("Admin list organizations error:", err);
    });
    return { error: message };
  }
}

export type SetPlanParams = {
  organizationId: string;
  workos_id: string;
  plan: "plus" | "pro" | "enterprise";
  /** Organization name to set on the Autumn customer. */
  organizationName?: string;
  /** Only used when plan === "enterprise". Sets the seats balance in Autumn. */
  enterpriseSeats?: number;
};

export async function setOrganizationPlanAction(
  params: SetPlanParams
): Promise<{ success: true } | { error: string }> {
  const ok = await isAdmin();
  if (!ok) {
    return { error: "Forbidden" };
  }

  const { organizationId, workos_id, plan, organizationName, enterpriseSeats } = params;

  if (!organizationId || !plan || !workos_id) {
    return { error: "Missing organizationId, plan, or workos_id" };
  }

  if (!VALID_PLANS.includes(plan)) {
    return { error: "Invalid plan. Must be 'plus', 'pro' or 'enterprise'" };
  }

  const secretKey = process.env.AUTUMN_SECRET_KEY;
  if (!secretKey) {
    after(() => {
      console.error("Admin set plan: AUTUMN_SECRET_KEY is not set");
    });
    return { error: "Server configuration error" };
  }

  const autumn = new Autumn({ secretKey });

  // Attach first; we cancel other products after attach so we never call customers.get
  // when the customer might not exist (which triggers Autumn's "Customer not found" error log).
  const attachParams: Parameters<Autumn["attach"]>[0] = {
    customer_id: workos_id,
    product_id: plan,
  };

  const attachResult = await autumn.attach(attachParams);

  if (attachResult.error) {
    const message =
      (attachResult.error as { message?: string }).message ?? "Autumn attach failed";
    const isNotFound =
      typeof message === "string" &&
      (message.includes("not found") || message.includes("customer"));

    if (isNotFound) {
      try {
        await autumn.customers.create({
          id: workos_id,
          ...(organizationName != null && organizationName !== ""
            ? { name: organizationName }
            : {}),
        });
        const retryResult = await autumn.attach(attachParams);
        if (retryResult.error) {
          after(() => {
            console.error("Admin set plan: Autumn attach retry failed", retryResult.error);
          });
          const retryMessage =
            (retryResult.error as { message?: string }).message ??
            "Failed to attach plan in Autumn";
          return { error: retryMessage };
        }
      } catch (createErr) {
        after(() => {
          console.error("Admin set plan: Autumn customer create failed", createErr);
        });
        return { error: "Failed to create Autumn customer and attach plan" };
      }
    } else {
      after(() => {
        console.error("Admin set plan: Autumn attach failed", attachResult.error);
      });
      return { error: message || "Failed to attach plan in Autumn" };
    }
  }

  // Cancel any other products (e.g. default "free") so only the attached plan is active.
  // Needed when the customer was just created by attach (we skipped the pre-attach cancel loop).
  const customerAfterAttach = await autumn.customers.get(workos_id);
  if (!customerAfterAttach.error && customerAfterAttach.data?.products?.length) {
    for (const p of customerAfterAttach.data.products) {
      const isActive = p.status === "active" || p.status === "scheduled";
      if (isActive && p.id !== plan) {
        const cancelResult = await autumn.cancel({
          customer_id: workos_id,
          product_id: p.id,
          cancel_immediately: true,
        });
        if (cancelResult.error) {
          after(() => {
            console.warn(
              "Admin set plan: Autumn cancel (post-attach) failed for product",
              p.id,
              cancelResult.error
            );
          });
        }
      }
    }
  }

  // Set or update the Autumn customer name to match the organization
  if (organizationName != null && organizationName !== "") {
    const updateResult = await autumn.customers.update(workos_id, {
      name: organizationName,
    });
    if (updateResult.error) {
      after(() => {
        console.warn(
          "Admin set plan: Autumn customer update (name) failed",
          updateResult.error
        );
      });
    }
  }

  // Set enterprise seats balance when plan is enterprise and seats were specified.
  // SDK expects the balance list (or single object) as second arg, not { balances: [...] }.
  if (
    plan === "enterprise" &&
    enterpriseSeats != null &&
    Number(enterpriseSeats) > 0
  ) {
    const seatsBalance = Number(enterpriseSeats);
    const balanceResult = await autumn.customers.updateBalances(workos_id, [
      { feature_id: "seats", balance: seatsBalance },
    ]);
    if (balanceResult.error) {
      after(() => {
        console.warn(
          "Admin set plan: Autumn updateBalances (seats) failed",
          balanceResult.error
        );
      });
    }
  }

  return { success: true };
}

export type CancelSubscriptionParams = {
  organizationId: string;
  workos_id?: string;
  productId?: string;
  cancelType: "now" | "end_of_cycle";
  subscriptionStatus: string;
};

export async function cancelOrganizationSubscriptionAction(
  params: CancelSubscriptionParams
): Promise<{ success: true } | { error: string }> {
  const ok = await isAdmin();
  if (!ok) {
    return { error: "Forbidden" };
  }

  const {
    organizationId,
    workos_id,
    productId,
    cancelType,
    subscriptionStatus,
  } = params;

  if (!organizationId || !cancelType || !subscriptionStatus) {
    return { error: "Missing organizationId, cancelType, or subscriptionStatus" };
  }

  if (cancelType !== "now" && cancelType !== "end_of_cycle") {
    return { error: "Invalid cancelType. Must be 'now' or 'end_of_cycle'" };
  }

  if (!VALID_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
    return { error: "Invalid subscriptionStatus" };
  }

  if (!CONVEX_SITE_URL || !CONVEX_ADMIN_TOKEN) {
    return { error: "Server configuration error" };
  }

  const cancelImmediately = cancelType === "now";

  if (workos_id && productId && process.env.AUTUMN_SECRET_KEY) {
    try {
      const autumn = new Autumn({
        secretKey: process.env.AUTUMN_SECRET_KEY,
      });
      const cancelResult = await autumn.cancel({
        customer_id: workos_id,
        product_id: productId,
        cancel_immediately: cancelImmediately,
      });
      if (cancelResult.error) {
        after(() => {
          console.warn(
            "Admin cancel: Autumn cancel failed (org may have no product)",
            cancelResult.error
          );
        });
      }
    } catch (err) {
      after(() => {
        console.warn("Admin cancel: Autumn cancel error", err);
      });
    }
  }

  const endpoint =
    cancelType === "now"
      ? "/admin/organizations/cancel-now"
      : "/admin/organizations/cancel-at-cycle-end";

  const response = await fetch(`${CONVEX_SITE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONVEX_ADMIN_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ organizationId, subscriptionStatus }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as { error?: string };
    return {
      error: errorData.error ?? "Failed to cancel subscription",
    };
  }

  return { success: true };
}
