import { stripe } from '@/app/api/stripe';
import { workos } from '@/app/api/workos';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getPermissions, checkPermission, PERMISSIONS } from '@/lib/permissions';
// import { checkBotId } from 'botid/server';

export const POST = async (req: NextRequest) => {
  /*
  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json(
        { error: 'Bot detected. Access denied.' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Bot verification failed', error);
    return NextResponse.json(
      { error: 'Bot verification failed' },
      { status: 403 }
    );
  }
  */

  const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const baseUrl = productionDomain ? `https://${productionDomain}` : "http://localhost:3000";

  const {
    userId,
    orgName,
    subscriptionLevel,
    organizationId: providedOrgId,
    cancelAllExistingSubscriptions,
    idempotencyKey,
  } = await req.json();

  try {
    let targetOrganizationId = providedOrgId;
    let isExistingOrg = false;

    // If no organization ID provided, try to find one or create one
    if (!targetOrganizationId) {
       // Check if user has existing memberships
       const memberships = await workos.userManagement.listOrganizationMemberships({
         userId,
       });

       if (memberships.data.length > 0) {
         // User has organizations, use the first one (or logic to pick "active" if possible)
         // Ideally frontend sends the active one, but this is a fallback.
         targetOrganizationId = memberships.data[0].organizationId;
         isExistingOrg = true;
       } else {
         // No existing organizations, create a new one
         if (!orgName) {
             return NextResponse.json({ error: 'Organization Name is required to create a new organization' }, { status: 400 });
         }
         if (orgName.length > 50) {
             return NextResponse.json({ error: 'Organization Name must be at most 50 characters' }, { status: 400 });
         }
         const organization = await workos.organizations.createOrganization({
           name: orgName,
         });
         
         await workos.userManagement.createOrganizationMembership({
           organizationId: organization.id,
           userId,
           roleSlug: 'admin',
         });
         
         targetOrganizationId = organization.id;
       }
    } else {
      // Organization ID was provided, so this is an existing org
      isExistingOrg = true;
    }

    // Map subscription level to Price ID from env
    const priceIds: Record<string, string | undefined> = {
      free: process.env.FREE_PRICE_ID,
      plus: process.env.PLUS_PRICE_ID,
      pro: process.env.PRO_PRICE_ID,
    };
    const priceId = priceIds[subscriptionLevel];

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID not configured for this plan" },
        { status: 500 },
      );
    }

    const user = await workos.userManagement.getUser(userId);

    // Check if organization already has a Stripe customer ID
    const workosOrg = await workos.organizations.getOrganization(targetOrganizationId);
    let customerId = workosOrg.stripeCustomerId;

    // Create Stripe customer only if one doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          metadata: {
            workOSOrganizationId: targetOrganizationId,
          },
        },
        {
          idempotencyKey: `create_stripe_customer_${targetOrganizationId}`,
        },
      );
      customerId = customer.id;

      // Update WorkOS organization with Stripe customer ID
      await workos.organizations.updateOrganization({
        organization: targetOrganizationId,
        stripeCustomerId: customerId,
      });
    }

    // Sync Stripe customer ID to Convex organization
    try {
      const convexBase = process.env.CONVEX_SITE_URL;
      const secret = process.env.CONVEX_SYNC_SECRET;

      if (convexBase && secret) {
        await fetch(`${convexBase}/sync-stripe-customer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${secret}`,
          },
          body: JSON.stringify({
            workos_id: targetOrganizationId,
            stripeCustomerId: customerId,
          }),
        });
      } else {
        console.warn("CONVEX_SITE_URL or CONVEX_SYNC_SECRET not set, skipping Convex sync");
      }
    } catch (error) {
      // Log error but don't fail the subscription flow
      console.error("Failed to sync Stripe customer ID to Convex:", error);
    }

    // Handle FREE plan subscription immediately
    if (subscriptionLevel === 'free') {
        // If requested, cancel existing subscriptions
        if (cancelAllExistingSubscriptions && customerId) {
            // Check permissions before cancelling
            const permissions = await getPermissions();
            if (!checkPermission(permissions, "MANAGE_BILLING")) {
                return NextResponse.json(
                    { error: "Unauthorized: You do not have permission to manage billing." },
                    { status: 403 }
                );
            }

            try {
                const existingSubscriptions = await stripe.subscriptions.list({
                    customer: customerId,
                    limit: 100,
                });

                for (const sub of existingSubscriptions.data) {
                    if (sub.status !== 'canceled') {
                        await stripe.subscriptions.cancel(sub.id);
                    }
                }
            } catch (error: any) {
                // Ignore 'resource_missing' error as it means subscription was already cancelled/deleted
                if (error?.code !== 'resource_missing') {
                    console.error("Error canceling existing subscriptions:", error);
                }
                // Continue to create the free subscription even if cancellation failed
                // to ensure the user regains access
            }
        }

        // Check if there is already an active subscription for this price to avoid duplicates
        // This handles race conditions where multiple requests might try to create the subscription simultaneously
        const existingSubscriptions = await stripe.subscriptions.list({
            customer: customerId,
            price: priceId,
            status: 'active',
            limit: 1,
        });

        if (existingSubscriptions.data.length > 0) {
            const subscription = existingSubscriptions.data[0];
            return NextResponse.json({ 
                success: true, 
                organizationId: targetOrganizationId,
                subscriptionId: subscription.id,
                url: `${baseUrl}/chat`
            });
        }

        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
        }, {
            idempotencyKey: idempotencyKey ? `sub_create_${idempotencyKey}` : undefined,
        });

        // If subscription is active (free plan usually is immediately active), return success
        // We don't need a checkout URL
        return NextResponse.json({ 
            success: true, 
            organizationId: targetOrganizationId,
            subscriptionId: subscription.id,
            url: `${baseUrl}/chat`
        });
    }

    // For paid plans, check permissions if user already has an organization
    if (isExistingOrg) {
      const permissions = await getPermissions();
      if (!checkPermission(permissions, "MANAGE_BILLING")) {
        console.log(`User ${userId} attempted to subscribe but lacks billing permission for organization ${targetOrganizationId}`);
        return NextResponse.json({ 
          error: "Unauthorized: You do not have permission to manage billing.",
          url: `${baseUrl}/chat`
        }, { status: 403 });
      }
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      billing_address_collection: 'auto',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: `${baseUrl}/chat`,
      cancel_url: `${baseUrl}/`,
    });

    return NextResponse.json({ url: session.url, organizationId: targetOrganizationId });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    console.error(errorMessage, error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
};
