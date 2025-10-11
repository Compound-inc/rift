// "use client";

// import { useEffect } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// // removed useAuth import

// export default function PaymentSuccessPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   // removed signOut extraction

//   useEffect(() => {
//     const handleSyncAndRedirect = async () => {
//       try {
//         const workosOrgId = searchParams.get("workos_org");

//         // Build endpoints
//         const convexUrl =
//           process.env.NEXT_PUBLIC_CONVEX_URL?.replace("/api/query", "") || "";
//         const refreshUrl = workosOrgId
//           ? `/api/auth/refresh?organization_id=${encodeURIComponent(workosOrgId)}`
//           : `/api/auth/refresh`;

//         // Run sync and refresh in parallel
//         const tasks: Promise<unknown>[] = [
//           fetch(refreshUrl, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             cache: "no-store",
//           }),
//         ];

//         if (workosOrgId) {
//           tasks.push(
//             fetch(`/api/convex/stripe-success`, {
//               method: "POST",
//               headers: {
//                 "Content-Type": "application/json",
//               },
//               body: JSON.stringify({
//                 workosOrganizationId: workosOrgId,
//               }),
//             }),
//           );
//         }

//         await Promise.allSettled(tasks);
//         // Redirect to router so middleware/session reflect changes immediately
//         router.push("/router");
//       } catch (error) {
//         console.error("Error during sync or refresh:", error);
//         // Redirect to router; middleware will handle session state
//         router.push("/router");
//       }
//     };

//     handleSyncAndRedirect();
//   }, [router, searchParams]);

//   // Estado de carga mientras sincronizamos y actualizamos la sesión
//   return (
//     <div className="min-h-screen w-full flex items-center justify-center bg-white">
//       <div className="flex flex-col items-center text-center gap-4 p-8 rounded-lg border border-gray-200 bg-gray-50">
//         <div
//           className="h-8 w-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin"
//           aria-label="Cargando"
//         />
//         <h1 className="text-lg font-semibold text-gray-900">
//           Actualizando tu suscripción…
//         </h1>
//         <p className="text-sm text-gray-600">
//           Esto puede tardar unos segundos.
//         </p>
//       </div>
//     </div>
//   );
// }
