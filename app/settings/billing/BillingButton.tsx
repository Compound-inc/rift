"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createStripePortalSession } from "@/actions/createStripePortalSession";

export function BillingButton({ stripeCustomerId }: { stripeCustomerId?: string }) {
  const [loading, setLoading] = useState(false);

  const handleManageBilling = async () => {
    if (!stripeCustomerId) return;
    
    setLoading(true);
    try {
      const { url } = await createStripePortalSession(stripeCustomerId);
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Failed to redirect to billing portal:", error);
      alert("No se pudo acceder al portal de facturación. Por favor intenta más tarde.");
    } finally {
      setLoading(false);
    }
  };

  if (!stripeCustomerId) return null;

  return (
    <button
      onClick={handleManageBilling}
      disabled={loading}
      className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Cargando...
        </>
      ) : (
        "Gestionar Suscripción"
      )}
    </button>
  );
}
