import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Protected endpoint to sync Stripe customer ID to an organization by WorkOS ID
http.route({
  path: "/sync-stripe-customer",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("authorization") || "";
    const expected = `Bearer ${process.env.CONVEX_SYNC_SECRET ?? ""}`;
    if (!process.env.CONVEX_SYNC_SECRET || authHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { workos_id, stripeCustomerId } = body ?? {};
    if (!workos_id || !stripeCustomerId) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ctx.runMutation(
      internal.organizations.setStripeCustomerIdByWorkOSId,
      {
        workos_id,
        stripeCustomerId,
      },
    );

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Protected endpoint to get organization by WorkOS ID
http.route({
  path: "/get-organization-by-workos-id",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("authorization") || "";
    const expected = `Bearer ${process.env.CONVEX_SYNC_SECRET ?? ""}`;
    if (!process.env.CONVEX_SYNC_SECRET || authHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { workos_id } = body ?? {};
    if (!workos_id) {
      return new Response(JSON.stringify({ error: "Missing workos_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const organization = await ctx.runQuery(
      internal.organizations.getByWorkOSId,
      { workos_id },
    );

    // Return only the stripeCustomerId to minimize data transfer
    const response = {
      stripeCustomerId: organization?.stripeCustomerId || null,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/workos-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const bodyText = await request.text();
    const sigHeader = String(request.headers.get("workos-signature"));

    try {
      await ctx.runAction(internal.workos.verifyWebhook, {
        payload: bodyText,
        signature: sigHeader,
      });

      const { data, event } = JSON.parse(bodyText);

      switch (event) {
        case "user.created": {
          await ctx.runMutation(internal.users.createUser, {
            email: data.email,
            workos_id: data.id,
            firstName: data.first_name,
            lastName: data.last_name,
          });
          break;
        }
        case "user.deleted": {
          const user = await ctx.runQuery(internal.users.getByWorkOSId, {
            workos_id: data.id,
          });

          if (!user?._id) {
            throw new Error(
              `Unhandled event type: User not found: ${data.id}.`,
            );
          }

          await ctx.runMutation(internal.users.deleteUser, {
            id: user._id,
          });

          break;
        }
        case "user.updated": {
          const user = await ctx.runQuery(internal.users.getByWorkOSId, {
            workos_id: data.id,
          });

          if (!user?._id) {
            // TODO: compose more sophisticated error messaging?
            throw new Error(
              `Unhandled event type: User not found: ${data.id}.`,
            );
          }

          await ctx.runMutation(internal.users.updateUser, {
            id: user._id,
            patch: { 
              email: data.email,
              firstName: data.first_name,
              lastName: data.last_name,
            },
          });

          break;
        }
        case "organization.created": {
          await ctx.runMutation(internal.organizations.createOrganization, {
            name: data.name,
            workos_id: data.id,
          });
          break;
        }
        case "organization.deleted": {
          const organization = await ctx.runQuery(
            internal.organizations.getByWorkOSId,
            {
              workos_id: data.id,
            },
          );

          if (!organization?._id) {
            // TODO: compose more sophisticated error messaging?
            throw new Error(
              `Unhandled event type: organization not found: ${data.id}.`,
            );
          }

          await ctx.runMutation(internal.organizations.deleteOrganization, {
            id: organization._id,
          });

          break;
        }
        case "organization.updated": {
          const organization = await ctx.runQuery(
            internal.organizations.getByWorkOSId,
            {
              workos_id: data.id,
            },
          );

          if (!organization?._id) {
            // TODO: compose more sophisticated error messaging?
            throw new Error(
              `Unhandled event type: organization not found: ${data.id}.`,
            );
          }

          await ctx.runMutation(internal.organizations.updateOrganization, {
            id: organization._id,
            patch: { name: data.name },
          });

          break;
        }
        default: {
          throw new Error(`Unhandled event type: ${event}`);
        }
      }

      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes("Unhandled event type")) {
          return new Response(
            JSON.stringify({
              status: "error",
              message: e.message,
            }),
            {
              status: 422,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }

      return new Response(
        JSON.stringify({
          status: "error",
          message: "Internal server error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }),
});

// Stripe webhook endpoint
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const bodyText = await request.text();
    const sigHeader = request.headers.get("stripe-signature");

    if (!sigHeader) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    try {
      // Verify the webhook signature
      const event = await ctx.runAction(internal.stripe.verifyStripeWebhook, {
        payload: bodyText,
        signature: sigHeader,
      });

      // Handle the webhook event
      const result = await ctx.runAction(internal.stripe.processStripeEvent, {
        event,
      });

      return new Response(
        JSON.stringify({
          status: "success",
          eventType: result.eventType,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Stripe webhook error:", error);

      return new Response(
        JSON.stringify({ error: "Webhook processing failed" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }),
});

// Stripe success endpoint
// Eagerly sync Stripe subscription data to minimize race with webhooks
http.route({
  path: "/stripe-success",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Protect with shared secret
      const authHeader = request.headers.get("authorization") || "";
      const expected = `Bearer ${process.env.CONVEX_SYNC_SECRET ?? ""}`;
      if (!process.env.CONVEX_SYNC_SECRET || authHeader !== expected) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await request.json();
      const { workosOrganizationId } = body;

      if (!workosOrganizationId) {
        return new Response(
          JSON.stringify({ error: "Missing workosOrganizationId" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Confirm the organization exists
      const organization = await ctx.runQuery(
        internal.organizations.getByWorkOSId,
        {
          workos_id: workosOrganizationId,
        },
      );

      if (!organization) {
        return new Response(
          JSON.stringify({ error: "Organization not found" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (!organization.stripeCustomerId) {
        return new Response(
          JSON.stringify({
            error: "Organization missing Stripe customer ID",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Eagerly sync latest subscription snapshot from Stripe
      const synced = await ctx.runAction(
        internal.organizations.syncStripeDataWithPeriod,
        {
          stripeCustomerId: organization.stripeCustomerId,
          // billingPeriod can be omitted; current period derived from Stripe
        },
      );

      return new Response(
        JSON.stringify({
          status: "success",
          synced,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Stripe success endpoint error:", error);

      return new Response(JSON.stringify({ error: "Request failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Tool call quota increment endpoint
http.route({
  path: "/increment-tool-call-quota",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("authorization") || "";
    const expected = `Bearer ${process.env.CONVEX_SECRET_TOKEN ?? ""}`;
    if (!process.env.CONVEX_SECRET_TOKEN || authHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { userId, toolCallCount } = body ?? {};
    if (!userId || !toolCallCount) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await ctx.runMutation(internal.threads.incrementToolCallQuotaMutation, {
        secretToken: process.env.CONVEX_SECRET_TOKEN!,
        userId,
        toolCallCount,
      });

      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Tool call quota increment error:", error);
      return new Response(JSON.stringify({ error: "Failed to increment quota" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Admin endpoints - protected with CONVEX_ADMIN_TOKEN
http.route({
  path: "/admin/organizations",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("authorization") || "";
    const expected = `Bearer ${process.env.CONVEX_ADMIN_TOKEN ?? ""}`;
    
    if (!process.env.CONVEX_ADMIN_TOKEN || authHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const organizations = await ctx.runQuery(
        internal.admin.organizations.listAllOrganizations,
        {},
      );

      return new Response(JSON.stringify(organizations), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Admin organizations list error:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch organizations" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/admin/organizations/set-plan",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("authorization") || "";
    const expected = `Bearer ${process.env.CONVEX_ADMIN_TOKEN ?? ""}`;
    if (!process.env.CONVEX_ADMIN_TOKEN || authHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { organizationId, plan } = body ?? {};
      
      if (!organizationId || !plan) {
        return new Response(JSON.stringify({ error: "Missing organizationId or plan" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (plan !== "plus" && plan !== "pro") {
        return new Response(JSON.stringify({ error: "Invalid plan. Must be 'plus' or 'pro'" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(internal.admin.organizations.setOrganizationPlan, {
        organizationId,
        plan,
      });

      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Admin set plan error:", error);
      return new Response(JSON.stringify({ error: "Failed to set organization plan" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/admin/organizations/cancel-now",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("authorization") || "";
    const expected = `Bearer ${process.env.CONVEX_ADMIN_TOKEN ?? ""}`;
    if (!process.env.CONVEX_ADMIN_TOKEN || authHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { organizationId, subscriptionStatus } = body ?? {};
      
      if (!organizationId || !subscriptionStatus) {
        return new Response(JSON.stringify({ error: "Missing organizationId or subscriptionStatus" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const validStatuses = ["active", "canceled", "incomplete", "incomplete_expired", "past_due", "trialing", "unpaid", "none"];
      if (!validStatuses.includes(subscriptionStatus)) {
        return new Response(JSON.stringify({ error: "Invalid subscriptionStatus" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(internal.admin.organizations.cancelOrganizationSubscriptionNow, {
        organizationId,
        subscriptionStatus,
      });

      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Admin cancel now error:", error);
      return new Response(JSON.stringify({ error: "Failed to cancel organization subscription" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/admin/organizations/cancel-at-cycle-end",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("authorization") || "";
    const expected = `Bearer ${process.env.CONVEX_ADMIN_TOKEN ?? ""}`;
    if (!process.env.CONVEX_ADMIN_TOKEN || authHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { organizationId, subscriptionStatus } = body ?? {};
      
      if (!organizationId || !subscriptionStatus) {
        return new Response(JSON.stringify({ error: "Missing organizationId or subscriptionStatus" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const validStatuses = ["active", "canceled", "incomplete", "incomplete_expired", "past_due", "trialing", "unpaid", "none"];
      if (!validStatuses.includes(subscriptionStatus)) {
        return new Response(JSON.stringify({ error: "Invalid subscriptionStatus" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(internal.admin.organizations.cancelOrganizationSubscriptionAtCycleEnd, {
        organizationId,
        subscriptionStatus,
      });

      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Admin cancel at cycle end error:", error);
      return new Response(JSON.stringify({ error: "Failed to schedule organization subscription cancellation" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});


export default http;
