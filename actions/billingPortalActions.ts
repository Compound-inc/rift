// "use server";

// import redirectToBillingPortal from "./redirectToBillingPortal";

// /**
//  * Billing Portal Actions
//  *
//  * Currently only redirectToSubscriptionUpdate is actively used for plan upgrades/downgrades.
//  * Other functions are kept for future use cases.
//  */

// export async function redirectToSubscriptionUpdate(
//   path: string = "plans",
//   subscriptionId?: string,
// ) {
//   return redirectToBillingPortal({
//     path,
//     flow: "subscription_update",
//     subscriptionId,
//   });
// }

// export async function redirectToGeneralBilling(path: string = "plans") {
//   await redirectToBillingPortal(path);
// }
