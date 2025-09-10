'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { Stripe } from 'stripe';
import { internal } from './_generated/api';

export const verifyStripeWebhook = internalAction({
  args: v.object({
    payload: v.string(),
    signature: v.string(),
  }),
  handler: async (ctx, args) => {
    const stripe = new Stripe(process.env.STRIPE_API_KEY as string);

    return await stripe.webhooks.constructEvent(
      args.payload,
      args.signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  },
});



export const handleStripeWebhook = internalAction({
  args: {
    event: v.any(),
  },
  handler: async (ctx, args) => {
    const event = args.event as Stripe.Event;
    
    console.log('Processing Stripe webhook event:', event.type);
    console.log('Event data:', JSON.stringify(event.data, null, 2));

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          const customerId = typeof subscription.customer === 'string' 
            ? subscription.customer 
            : subscription.customer.id;
          
          // Extract billing period from subscription items
          let currentPeriodStart: number | null = null;
          let currentPeriodEnd: number | null = null;
          
          console.log('Subscription items:', subscription.items);
          
          if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
            const firstItem = subscription.items.data[0];
            currentPeriodStart = firstItem.current_period_start;
            currentPeriodEnd = firstItem.current_period_end;
            console.log('Extracted from items - Start:', currentPeriodStart, 'End:', currentPeriodEnd);
          }
          
          // Fallback to subscription-level properties if items don't have them
          if (!currentPeriodStart || !currentPeriodEnd) {
            currentPeriodStart = subscription.current_period_start;
            currentPeriodEnd = subscription.current_period_end;
            console.log('Fallback to subscription level - Start:', currentPeriodStart, 'End:', currentPeriodEnd);
          }
          
          console.log('Final billing cycle - Start:', currentPeriodStart, 'End:', currentPeriodEnd);
          console.log('Customer ID:', customerId);
          
          if (currentPeriodStart && currentPeriodEnd) {
            console.log('Updating billing cycle for customer:', customerId);
            await ctx.runMutation(internal.organizations.updateBillingCycleFromStripe, {
              stripeCustomerId: customerId,
              billingCycleStart: currentPeriodStart,
              billingCycleEnd: currentPeriodEnd,
            });
            console.log('Billing cycle updated successfully');
          } else {
            console.log('No valid billing cycle found, skipping update');
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          const customerId = typeof subscription.customer === 'string' 
            ? subscription.customer 
            : subscription.customer.id;
          
          // Clear billing cycle when subscription is deleted
          await ctx.runMutation(internal.organizations.updateBillingCycleFromStripe, {
            stripeCustomerId: customerId,
            billingCycleStart: 0,
            billingCycleEnd: 0,
          });
          break;
        }

        case 'customer.subscription.trial_will_end': {
          const subscription = event.data.object as any;
          const customerId = typeof subscription.customer === 'string' 
            ? subscription.customer 
            : subscription.customer.id;
          
          // Extract billing period from subscription items
          let currentPeriodStart: number | null = null;
          let currentPeriodEnd: number | null = null;
          
          if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
            const firstItem = subscription.items.data[0];
            currentPeriodStart = firstItem.current_period_start;
            currentPeriodEnd = firstItem.current_period_end;
          }
          
          // Fallback to subscription-level properties if items don't have them
          if (!currentPeriodStart || !currentPeriodEnd) {
            currentPeriodStart = subscription.current_period_start;
            currentPeriodEnd = subscription.current_period_end;
          }
          
          if (currentPeriodStart && currentPeriodEnd) {
            await ctx.runMutation(internal.organizations.updateBillingCycleFromStripe, {
              stripeCustomerId: customerId,
              billingCycleStart: currentPeriodStart,
              billingCycleEnd: currentPeriodEnd,
            });
          }
          break;
        }

        case 'invoice.payment_action_required':
        case 'invoice.payment_failed':
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as any;
          const customerId = typeof invoice.customer === 'string' 
            ? invoice.customer 
            : invoice.customer?.id;
          
          if (invoice.subscription && customerId) {
            // Get the subscription to get current period
            const stripe = new Stripe(process.env.STRIPE_API_KEY as string);
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string) as any;
            
            if (subscription.current_period_start && subscription.current_period_end) {
              await ctx.runMutation(internal.organizations.updateBillingCycleFromStripe, {
                stripeCustomerId: customerId,
                billingCycleStart: subscription.current_period_start,
                billingCycleEnd: subscription.current_period_end,
              });
            }
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { success: true, eventType: event.type };
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      throw error;
    }
  },
});
