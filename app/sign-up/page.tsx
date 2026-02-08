"use client";

import { useEffect } from "react";
import { Loader } from "@/components/ai/loader";

export default function SignUpPage() {
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const returnTo = searchParams.get("return_to");
    const plan = searchParams.get("plan");

    const params = new URLSearchParams();
    if (returnTo) params.set("return_to", returnTo);
    if (plan) params.set("plan", plan);

    const apiUrl = `/api/sign-up${params.toString() ? `?${params.toString()}` : ""}`;
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
