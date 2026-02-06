import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/autumn-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!process.env.AUTUMN_WEBHOOK_SECRET) {
      console.error("[Autumn webhook] AUTUMN_WEBHOOK_SECRET is not set");
      return new Response(
        JSON.stringify({ error: "AUTUMN_WEBHOOK_SECRET is not set" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const payload = await request.text();
    const svixId = request.headers.get("svix-id") ?? "";
    const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
    const svixSignature = request.headers.get("svix-signature") ?? "";

    try {
      const result = await ctx.runAction(internal.autumn.handleAutumnWebhook, {
        payload,
        svixId,
        svixTimestamp,
        svixSignature,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid webhook signature";
      const msg = typeof message === "string" ? message : "";
      const status =
        msg === "Invalid webhook signature"
          ? 401
          : msg.includes("Organization not found")
            ? 503
            : 500;
      console.error("[Autumn webhook] Failed:", message, "status:", status);
      return new Response(
        JSON.stringify({ error: message }),
        {
          status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
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
            firstName: data.first_name ?? undefined,
            lastName: data.last_name ?? undefined,
            profilePictureUrl: data.profile_picture_url ?? undefined,
          });
          // Create user configuration with supermemory enabled
          await ctx.runMutation(internal.userConfiguration.createUserConfiguration, {
            userId: data.id,
            supermemoryEnabled: true,
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
              firstName: data.first_name ?? undefined,
              lastName: data.last_name ?? undefined,
              profilePictureUrl: data.profile_picture_url ?? undefined,
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

          const patch = { name: data.name };

          await ctx.runMutation(internal.organizations.updateOrganization, {
            id: organization._id,
            patch,
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

      console.error("WorkOS webhook processing error:", {
        event,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        payload: bodyText,
      });

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