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

    await ctx.runMutation(internal.organizations.setStripeCustomerIdByWorkOSId, {
      workos_id,
      stripeCustomerId,
    });

    return new Response(JSON.stringify({ status: "ok" }), {
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
            patch: { email: data.email },
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
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      // Verify the webhook signature
      const event = await ctx.runAction(internal.stripe.verifyStripeWebhook, {
        payload: bodyText,
        signature: sigHeader,
      });

      // Handle the webhook event
      const result = await ctx.runAction(internal.stripe.handleStripeWebhook, {
        event,
      });

      return new Response(JSON.stringify({ 
        status: "success", 
        eventType: result.eventType 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      
      return new Response(JSON.stringify({ 
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
