import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

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

export default http;
