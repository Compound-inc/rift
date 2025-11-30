import { NextRequest, NextResponse } from "next/server";
import { stripe } from '@/app/api/stripe';
import { workos } from '@/app/api/workos';

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_URL!.replace('.convex.cloud', '.convex.site');
const CONVEX_ADMIN_TOKEN = process.env.CONVEX_ADMIN_TOKEN!;

// Map internal features to Stripe feature lookup keys
const FEATURE_LOOKUP_KEYS = {
  domainVerification: "domain-verification",
  directorySync: "directory-sync",
  sso: "sso",
  auditLogs: "audit-logs",
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, plan, workos_id, customStandardQuotaLimit, customPremiumQuotaLimit, seatQuantity, features } = body;

    if (!organizationId || !plan) {
      return NextResponse.json(
        { error: "Missing organizationId or plan" },
        { status: 400 }
      );
    }

    if (plan !== "plus" && plan !== "pro" && plan !== "enterprise") {
      return NextResponse.json(
        { error: "Invalid plan. Must be 'plus', 'pro' or 'enterprise'" },
        { status: 400 }
      );
    }

    // Handle Enterprise Stripe Subscription
    if (plan === 'enterprise') {
        if (!workos_id) {
             return NextResponse.json({ error: "Missing workos_id for enterprise plan" }, { status: 400 });
        }
        
        // 1. Get WorkOS Org to check for Stripe Customer
        const workosOrg = await workos.organizations.getOrganization(workos_id);
        let customerId = workosOrg.stripeCustomerId;

        // 2. Create Stripe Customer if needed
        if (!customerId) {
            const customer = await stripe.customers.create(
                {
                    name: workosOrg.name,
                    metadata: {
                        workOSOrganizationId: workos_id,
                    },
                },
                {
                    idempotencyKey: `create_stripe_customer_${workos_id}`,
                },
            );
            customerId = customer.id;
            
            await workos.organizations.updateOrganization({
                organization: workos_id,
                stripeCustomerId: customerId,
            });
        }
        
        // 3. Handle Subscription (Create or Update)
        const priceId = process.env.ENTERPRISE_PRICE_ID;
        if (!priceId) {
             return NextResponse.json({ error: "ENTERPRISE_PRICE_ID not configured" }, { status: 500 });
        }

        // Check for existing active subscriptions
        const existingSubscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 1,
        });

        const existingSubscription = existingSubscriptions.data[0];
        let subscriptionId = existingSubscription?.id;

        if (existingSubscription) {
            // Check if it's the same price
            const isSamePrice = existingSubscription.items.data.some(item => item.price.id === priceId);

            if (isSamePrice) {
                // Update quantity if needed
                if (existingSubscription.items.data[0].quantity !== (seatQuantity || 1)) {
                    await stripe.subscriptions.update(existingSubscription.id, {
                        items: [{
                            id: existingSubscription.items.data[0].id,
                            quantity: seatQuantity || 1,
                        }],
                    });
                }
            } else {
                // Cancel old subscription and create new one (Upgrade/Switch)
                const itemId = existingSubscription.items.data[0].id;
                const updatedSubscription = await stripe.subscriptions.update(existingSubscription.id, {
                    items: [{
                        id: itemId,
                        price: priceId,
                        quantity: seatQuantity || 1,
                    }],
                    payment_behavior: 'default_incomplete',
                    expand: ['latest_invoice.payment_intent'],
                });
                subscriptionId = updatedSubscription.id;
            }
        } else {
            // No active subscription, create new one
            const subscriptionParams: any = {
                customer: customerId,
                items: [{ price: priceId, quantity: seatQuantity || 1 }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                expand: ['latest_invoice.payment_intent'],
            };

            const subscription = await stripe.subscriptions.create(subscriptionParams);
            subscriptionId = subscription.id;
        }

        // 4. Handle Entitlements (Features)
        if (subscriptionId && features) {
            // Refetch the subscription to get the current state after any updates
            // This ensures we have the latest subscription items for feature entitlement checks
            const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
            const activeItems = currentSubscription.items.data;
            
            for (const [key, enabled] of Object.entries(features)) {
                if (enabled) {
                    const lookupKey = FEATURE_LOOKUP_KEYS[key as keyof typeof FEATURE_LOOKUP_KEYS];
                    if (!lookupKey) continue;

                    // Check if already has this item
                    const hasItem = activeItems.some(item => item.price.lookup_key === lookupKey);
                    
                    if (!hasItem) {
                        // Find price for this feature
                        const prices = await stripe.prices.list({
                            lookup_keys: [lookupKey],
                            limit: 1,
                        });
                        
                        if (prices.data.length > 0) {
                            await stripe.subscriptionItems.create({
                                subscription: subscriptionId,
                                price: prices.data[0].id,
                                quantity: 1,
                            });
                        } else {
                            console.warn(`No price found for feature lookup key: ${lookupKey}`);
                        }
                    }
                } else {
                    // If disabled, remove the item if it exists
                    const lookupKey = FEATURE_LOOKUP_KEYS[key as keyof typeof FEATURE_LOOKUP_KEYS];
                    const itemToRemove = activeItems.find(item => item.price.lookup_key === lookupKey);
                    if (itemToRemove) {
                        await stripe.subscriptionItems.del(itemToRemove.id);
                    }
                }
            }
        }
        
        // Sync to Convex
        try {
            const secret = process.env.CONVEX_SYNC_SECRET;
            if (CONVEX_SITE_URL && secret) {
                await fetch(`${CONVEX_SITE_URL}/sync-stripe-customer`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${secret}`,
                    },
                    body: JSON.stringify({
                        workos_id: workos_id,
                        stripeCustomerId: customerId,
                    }),
                });
            }
        } catch (e) {
            console.error("Failed to sync stripe customer", e);
        }
    }

    const response = await fetch(`${CONVEX_SITE_URL}/admin/organizations/set-plan`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CONVEX_ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ organizationId, plan, customStandardQuotaLimit, customPremiumQuotaLimit, seatQuantity }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || "Failed to set organization plan" },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin set plan API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
