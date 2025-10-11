// import { stripe } from "../stripe";
// import { workos } from "../workos";
// import { NextRequest, NextResponse } from "next/server";
// import { withAuth } from "@workos-inc/authkit-nextjs";

// export const POST = async (req: NextRequest) => {
//   // Get authenticated user
//   const { accessToken, user } = await withAuth();
//   if (!accessToken || !user) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const { userId, orgName, subscriptionLevel } = await req.json();

//   // Verify that the authenticated user matches the userId in the request
//   if (user.id !== userId) {
//     return NextResponse.json(
//       { error: "Unauthorized - user ID mismatch" },
//       { status: 403 },
//     );
//   }

//   try {
//     let organization;
//     let shouldCreateOrganization = true;

//     // Check if user has existing organizations
//     try {
//       const memberships =
//         await workos.userManagement.listOrganizationMemberships({
//           userId,
//         });

//       if (memberships.data && memberships.data.length > 0) {
//         // User has existing organizations, use the first active one
//         const activeMembership = memberships.data.find(
//           (membership) => membership.status === "active",
//         );

//         if (activeMembership) {
//           // Get the full organization details using the organizationId
//           organization = await workos.organizations.getOrganization(
//             activeMembership.organizationId,
//           );
//           shouldCreateOrganization = false;
//           console.log("Using existing organization:", organization.id);
//         }
//       }
//     } catch (error) {
//       console.error("Error fetching user organizations:", error);
//       // Continue with creating new organization if fetching fails
//     }

//     // Create new organization only if user doesn't have one
//     if (shouldCreateOrganization) {
//       if (!orgName) {
//         return NextResponse.json(
//           { error: "Organization name is required for new organizations" },
//           { status: 400 },
//         );
//       }

//       organization = await workos.organizations.createOrganization({
//         name: orgName,
//       });

//       await workos.userManagement.createOrganizationMembership({
//         organizationId: organization.id,
//         userId,
//         roleSlug: "admin",
//       });

//       console.log("Created new organization:", organization.id);
//     }

//     // Retrieve price ID from Stripe
//     let price;

//     if (!organization) {
//       return NextResponse.json(
//         { error: "Failed to get or create organization" },
//         { status: 500 },
//       );
//     }

//     console.log("Looking up price with subscription level:", subscriptionLevel);

//     try {
//       price = await stripe.prices.list({
//         lookup_keys: [subscriptionLevel],
//       });

//       console.log("Stripe price lookup result:", price);

//       if (!price.data || price.data.length === 0) {
//         console.error(`No price found for lookup key: ${subscriptionLevel}`);
//         return NextResponse.json(
//           {
//             error: `No price found for subscription level: ${subscriptionLevel}. Please check that a price exists in Stripe with this lookup key.`,
//           },
//           { status: 400 },
//         );
//       }
//     } catch (error) {
//       console.error(
//         "Error retrieving price from Stripe. This is likely because the products and prices have not been created yet.",
//         error,
//       );
//       return NextResponse.json(
//         { error: "Error retrieving price from Stripe" },
//         { status: 500 },
//       );
//     }

//     const userDetails = await workos.userManagement.getUser(userId);

//     let stripeCustomerId;

//     // Check if organization already has a Stripe customer ID in Convex
//     if (process.env.CONVEX_HTTP && process.env.CONVEX_SYNC_SECRET) {
//       try {
//         const orgCheckResponse = await fetch(
//           `${process.env.CONVEX_HTTP}/get-organization-by-workos-id`,
//           {
//             method: "POST",
//             headers: {
//               "Content-Type": "application/json",
//               authorization: `Bearer ${process.env.CONVEX_SYNC_SECRET}`,
//             },
//             body: JSON.stringify({
//               workos_id: organization.id,
//             }),
//           },
//         );

//         if (orgCheckResponse.ok) {
//           const { stripeCustomerId: existingCustomerId } =
//             await orgCheckResponse.json();
//           if (existingCustomerId) {
//             stripeCustomerId = existingCustomerId;
//             console.log("Using existing Stripe customer:", stripeCustomerId);
//           }
//         }
//       } catch (error) {
//         console.error("Error checking existing organization:", error);
//         // Continue to create new customer if check fails
//       }
//     }

//     // Create Stripe customer only if one doesn't exist
//     if (!stripeCustomerId) {
//       const customer = await stripe.customers.create({
//         email: userDetails.email,
//         metadata: {
//           workOSOrganizationId: organization.id,
//           userId: userId,
//         },
//       });
//       stripeCustomerId = customer.id;
//       console.log("Created new Stripe customer:", stripeCustomerId);

//       // Update WorkOS organization with Stripe customer ID
//       await workos.organizations.updateOrganization({
//         organization: organization.id,
//         stripeCustomerId: stripeCustomerId,
//       });

//       // Sync Stripe customer ID into Convex organizations table
//       if (process.env.CONVEX_HTTP && process.env.CONVEX_SYNC_SECRET) {
//         try {
//           const res = await fetch(
//             `${process.env.CONVEX_HTTP}/sync-stripe-customer`,
//             {
//               method: "POST",
//               headers: {
//                 "Content-Type": "application/json",
//                 authorization: `Bearer ${process.env.CONVEX_SYNC_SECRET}`,
//               },
//               body: JSON.stringify({
//                 workos_id: organization.id,
//                 stripeCustomerId: stripeCustomerId,
//               }),
//             },
//           );
//           if (!res.ok) {
//             const text = await res.text();
//             console.error("Convex sync failed", res.status, text);
//           }
//         } catch (e) {
//           console.error("Convex sync error", e);
//         }
//       } else {
//         console.warn(
//           "Missing CONVEX_HTTP or CONVEX_SYNC_SECRET; skipping Convex sync",
//         );
//       }
//     }

//     // Create checkout session with existing or new customer
//     const session = await stripe.checkout.sessions.create({
//       customer: stripeCustomerId,
//       billing_address_collection: "auto",
//       line_items: [
//         {
//           price: price.data[0].id,
//           quantity: 1,
//         },
//       ],
//       mode: "subscription",
//       success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?workos_org=${organization.id}`,
//       cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/`,
//     });

//     return NextResponse.json({ url: session.url });
//   } catch (error: unknown) {
//     const errorMessage =
//       error instanceof Error ? error.message : "An error occurred";
//     console.error(errorMessage, error);
//     return NextResponse.json({ error: errorMessage }, { status: 500 });
//   }
// };
