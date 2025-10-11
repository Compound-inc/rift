// import { withAuth, refreshSession } from "@workos-inc/authkit-nextjs";
// import { NextResponse } from "next/server";
// import { workos } from "../api/workos";
// import { NextRequest } from "next/server";

// export const GET = async (request: NextRequest) => {
//   try {
//     let session = await withAuth();

//     if (!session || !session.user) {
//       return NextResponse.redirect(new URL("/pricing", request.url));
//     }

//     // Check for organization memberships
//     const memberships = await workos.userManagement.listOrganizationMemberships(
//       {
//         userId: session.user.id,
//       },
//     );

//     const hasActiveOrganization = memberships.data.some(
//       (membership) => membership.status === "active",
//     );

//     if (hasActiveOrganization) {
//       const organizationId = memberships.data[0].organizationId;

//       // If session doesn't have organizationId but user has memberships, refresh session
//       if (!session.organizationId) {
//         try {
//           session = await refreshSession({
//             organizationId: organizationId,
//             ensureSignedIn: true,
//           });
//         } catch (refreshError) {
//           console.warn(
//             "Failed to refresh session, but user has organization:",
//             refreshError,
//           );
//           // Continue with the organization ID we found
//         }
//       }

//       // Create audit log entry
//       try {
//         await workos.auditLogs.createEvent(organizationId, {
//           action: "user.logged_in",
//           occurredAt: new Date(),
//           actor: {
//             type: "user",
//             id: session.user.id,
//             name: `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim(),
//             metadata: {
//               role: session.role || "",
//             },
//           },
//           targets: [
//             {
//               type: "user",
//               id: session.user.id,
//               name: `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim(),
//             },
//           ],
//           context: {
//             location:
//               request.headers.get("x-forwarded-for") ||
//               request.headers.get("x-real-ip") ||
//               "unknown",
//           },
//           metadata: {},
//         });
//       } catch (auditError) {
//         // Continue even if audit log fails
//         console.warn("Failed to create audit log entry:", auditError);
//       }

//       return NextResponse.redirect(new URL("/chat", request.url));
//     } else {
//       return NextResponse.redirect(new URL("/pricing", request.url));
//     }
//   } catch (error) {
//     console.error("Authentication error in router:", error);
//     return NextResponse.redirect(new URL("/pricing", request.url));
//   }
// };
