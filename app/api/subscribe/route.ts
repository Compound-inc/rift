import { stripe } from "../stripe";
import { workos } from "../workos";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest) => {
  const { userId, orgName, subscriptionLevel } = await req.json();

  try {
    const organization = await workos.organizations.createOrganization({
      name: orgName,
    });

    await workos.userManagement.createOrganizationMembership({
      organizationId: organization.id,
      userId,
      roleSlug: "admin",
    });

    // Retrieve price ID from Stripe
    // The Stripe look up key for the price *must* be the same as the subscription level string
    let price;

    console.log("Looking up price with subscription level:", subscriptionLevel);

    try {
      price = await stripe.prices.list({
        lookup_keys: [subscriptionLevel],
      });

      console.log("Stripe price lookup result:", price);

      if (!price.data || price.data.length === 0) {
        console.error(`No price found for lookup key: ${subscriptionLevel}`);
        return NextResponse.json(
          {
            error: `No price found for subscription level: ${subscriptionLevel}. Please check that a price exists in Stripe with this lookup key.`,
          },
          { status: 400 },
        );
      }
    } catch (error) {
      console.error(
        "Error retrieving price from Stripe. This is likely because the products and prices have not been created yet. Run the setup script `pnpm run setup` to automatically create them.",
        error,
      );
      return NextResponse.json(
        { error: "Error retrieving price from Stripe" },
        { status: 500 },
      );
    }

    const user = await workos.userManagement.getUser(userId);

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        workOSOrganizationId: organization.id,
        userId: userId, // This is key for the sync approach
      },
    });

    // Update WorkOS organization with Stripe customer ID
    // This will allow WorkOS to automatically add entitlements to the access token
    await workos.organizations.updateOrganization({
      organization: organization.id,
      stripeCustomerId: customer.id,
    });

    // Sync Stripe customer ID into Convex organizations table (protected endpoint)
    if (!process.env.CONVEX_HTTP || !process.env.CONVEX_SYNC_SECRET) {
      console.warn(
        "Missing CONVEX_HTTP or CONVEX_SYNC_SECRET; skipping Convex sync",
      );
    } else {
      try {
        const res = await fetch(
          `${process.env.CONVEX_HTTP}/sync-stripe-customer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${process.env.CONVEX_SYNC_SECRET}`,
            },
            body: JSON.stringify({
              workos_id: organization.id,
              stripeCustomerId: customer.id,
            }),
          },
        );
        if (!res.ok) {
          const text = await res.text();
          console.error("Convex sync failed", res.status, text);
        }
      } catch (e) {
        console.error("Convex sync error", e);
      }
    }

    // ALWAYS create checkout with a stripeCustomerId
    const session = await stripe.checkout.sessions.create({
      customer: customer.id, // Customer is guaranteed to exist at this point
      billing_address_collection: "auto",
      line_items: [
        {
          price: price.data[0].id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?workos_org=${organization.id}`, // Point to payment success page with org ID
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An error occurred";
    console.error(errorMessage, error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
};
