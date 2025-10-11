// "use server";

// import { redirect } from "next/navigation";
// import { stripe } from "../app/api/stripe";
// import { workos } from "@/app/api/workos";
// import { withAuth } from "@workos-inc/authkit-nextjs";
// import type Stripe from "stripe";

// /**
//  * Redirects users to Stripe's billing portal with optional flow configuration.
//  *
//  * Supported flows:
//  * - subscription_update: Direct to subscription update page (currently used for plan changes)
//  * - subscription_cancel: Direct to subscription cancellation page (reserved for future use)
//  * - payment_method_update: Direct to payment method update page (reserved for future use)
//  *
//  * If no flow is specified, opens the general billing portal.
//  */

// interface BillingPortalOptions {
//   path: string;
//   flow?:
//     | "subscription_update"
//     | "subscription_cancel"
//     | "payment_method_update";
//   subscriptionId?: string;
// }

// export default async function redirectToBillingPortal(
//   pathOrOptions: string | BillingPortalOptions,
// ) {
//   const { organizationId } = await withAuth();

//   // Check if user has an organization
//   if (!organizationId) {
//     throw new Error(
//       "User must be part of an organization to access billing portal",
//     );
//   }

//   // Handle both old string parameter and new options object
//   const options: BillingPortalOptions =
//     typeof pathOrOptions === "string" ? { path: pathOrOptions } : pathOrOptions;

//   const response = await fetch(
//     `${workos.baseURL}/organizations/${organizationId}`,
//     {
//       headers: {
//         Authorization: `Bearer ${process.env.WORKOS_API_KEY}`,
//         "content-type": "application/json",
//       },
//     },
//   );

//   if (!response.ok) {
//     throw new Error(`Failed to fetch organization: ${response.statusText}`);
//   }

//   const workosOrg = await response.json();

//   // Check if organization has a Stripe customer ID
//   if (!workosOrg?.stripe_customer_id) {
//     throw new Error(
//       "Organization must have a Stripe customer ID to access billing portal",
//     );
//   }

//   const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

//   // Get subscription ID if needed for subscription_update flow
//   let subscriptionId = options.subscriptionId;
//   if (options.flow === "subscription_update" && !subscriptionId) {
//     // Fetch the customer's active subscription from Stripe
//     const subscriptions = await stripe.subscriptions.list({
//       customer: workosOrg?.stripe_customer_id,
//       status: "active",
//       limit: 1,
//     });

//     if (subscriptions.data.length > 0) {
//       subscriptionId = subscriptions.data[0].id;
//     } else {
//       // No active subscription found, fallback to general billing portal
//       console.warn(
//         "No active subscription found for subscription_update flow, using general billing portal",
//       );
//       const billingPortalSession = await stripe.billingPortal.sessions.create({
//         customer: workosOrg?.stripe_customer_id,
//         return_url: `${baseUrl}/settings/${options.path}`,
//       });
//       return redirect(billingPortalSession?.url);
//     }
//   }

//   // Configure billing portal session with flow-specific options
//   const sessionConfig: Stripe.BillingPortal.SessionCreateParams = {
//     customer: workosOrg?.stripe_customer_id,
//     return_url: `${baseUrl}/settings/${options.path}`,
//   };

//   // Add flow configuration if specified
//   if (options.flow) {
//     if (options.flow === "subscription_update" && subscriptionId) {
//       sessionConfig.flow_data = {
//         type: "subscription_update",
//         subscription_update: {
//           subscription: subscriptionId,
//         },
//         after_completion: {
//           type: "redirect",
//           redirect: {
//             return_url: `${baseUrl}/settings/${options.path}`,
//           },
//         },
//       };
//     } else if (options.flow === "subscription_cancel" && subscriptionId) {
//       sessionConfig.flow_data = {
//         type: "subscription_cancel",
//         subscription_cancel: {
//           subscription: subscriptionId,
//         },
//         after_completion: {
//           type: "redirect",
//           redirect: {
//             return_url: `${baseUrl}/settings/${options.path}`,
//           },
//         },
//       };
//     } else if (options.flow === "payment_method_update") {
//       sessionConfig.flow_data = {
//         type: "payment_method_update",
//         after_completion: {
//           type: "redirect",
//           redirect: {
//             return_url: `${baseUrl}/settings/${options.path}`,
//           },
//         },
//       };
//     } else if (
//       (options.flow === "subscription_update" ||
//         options.flow === "subscription_cancel") &&
//       !subscriptionId
//     ) {
//       // If no subscription ID found for subscription flows, don't add flow_data
//       console.warn(
//         `No subscription ID found for ${options.flow} flow, using general billing portal`,
//       );
//     }
//   }

//   const billingPortalSession =
//     await stripe.billingPortal.sessions.create(sessionConfig);

//   redirect(billingPortalSession?.url);
// }
