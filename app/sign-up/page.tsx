"use client";

import { useEffect } from "react";
import { Loader } from "@/components/ai/loader";

export default function SignUpPage() {
  useEffect(() => {
    // Get query parameters from the current URL
    const searchParams = new URLSearchParams(window.location.search);
    const returnTo = searchParams.get("return_to");
    const plan = searchParams.get("plan");
    
    // Build the API route URL with any query parameters
    const params = new URLSearchParams();
    if (returnTo) {
      params.set("return_to", returnTo);
    }
    if (plan) {
      params.set("plan", plan);
    }

    const apiUrl = `/api/sign-up${params.toString() ? `?${params.toString()}` : ""}`;
    
    // Immediately redirect to the API route which will handle WorkOS redirect
    // Using replace() instead of href to avoid leaving /sign-up in browser history
    window.location.replace(apiUrl);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader size={32} className="mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Redirigiendo...</p>
      </div>
    </div>
  );
}
