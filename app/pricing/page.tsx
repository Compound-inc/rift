// import React from "react";
// import { withAuth } from "@workos-inc/authkit-nextjs";
// import Pricing from "@/components/landing/subcomponents/pricing";
// import Navbar from "@/components/landing/navbar";
// import Footer from "@/components/landing/footer";

// export default async function PricingPage() {
//   const { user } = await withAuth();

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
//       <Navbar />
//       <div className="container mx-auto px-4 py-16">
//         <div className="text-center mb-16">
//           <span className="transition-opacity duration-150 ease-out text-emerald-500 font-semibold gap-1.5 items-center flex justify-center">
//             Suscripción
//           </span>
//           <h1 className="text-4xl leading-[54.4px] tracking-[-0.5px] font-bold m-0 mt-2 mb-4">
//             Precios
//           </h1>
//           <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
//             Escoge el plan que más se adapte a tus requerimientos.
//           </p>
//         </div>

//         <div className="max-w-6xl mx-auto">
//           <Pricing
//             user={user}
//             showComparisonTable={true}
//             containerWidth="wide"
//           />
//         </div>
//       </div>
//       <Footer />
//     </div>
//   );
// }
