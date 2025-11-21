"use client";

import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useRouter, useSearchParams } from "next/navigation";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useEffect, useState } from "react";
import { SettingsInput } from "@/components/settings";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { LoadingIcon } from "@/components/ui/icons/svg-icons";

function SubscribePageContent() {
  const { user, organizationId } = useAuth();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const seatsParam = searchParams.get("seats");
  const router = useRouter();
  const seatCount = (() => {
    if (!seatsParam) {
      return 1;
    }
    const parsed = Number.parseInt(seatsParam, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return 1;
    }
    return parsed;
  })();
  
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-redirect if user has organization
  useEffect(() => {
    const handleAutoSubscribe = async () => {
      if (user && organizationId && plan && !loading) {
        setLoading(true);
        try {
            const res = await fetch("/api/subscribe", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userId: user.id,
                    organizationId,
                    subscriptionLevel: plan.toLowerCase(),
                    seatQuantity: seatCount,
                }),
            });

            const { error, url } = await res.json();

            if (!error && url) {
                router.push(url);
            } else {
                setError(error || "Error desconocido al iniciar suscripción");
                setLoading(false);
            }
        } catch (err) {
            setError("Error de conexión al iniciar suscripción");
            setLoading(false);
        }
      }
    };

    handleAutoSubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, organizationId, plan, router, seatCount]);

  if (!plan) {
     return <div>Error: No plan selected.</div>;
  }
  
  if (!user) {
      return null; 
  }

  // Show loading state while auto-redirecting
  if (organizationId) {
      return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="flex flex-col items-center space-y-4">
                <LoadingIcon className="size-8 animate-spin" />
                <p className="text-sm text-muted-foreground">Redirigiendo a Stripe...</p>
                {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
        </div>
      );
  }

  // Handle manual subscription for users without organization
  const handleCreateOrgAndSubscribe = async () => {
    setLoading(true);
    setError("");
    
    if (orgName.trim() === "") {
        setError("Por favor, ingresa un nombre para tu organización.");
        setLoading(false);
        return;
    }

    try {
        const res = await fetch("/api/subscribe", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId: user.id,
                orgName, 
                subscriptionLevel: plan.toLowerCase(),
                seatQuantity: seatCount,
            }),
        });

        const { error, url } = await res.json();

        if (!error && url) {
            router.push(url);
        } else {
            setError(error || "Error desconocido");
            setLoading(false);
        }
    } catch (err) {
        setError("Error de conexión");
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="max-w-md w-full space-y-8 text-center bg-white p-8 rounded-xl shadow-sm border">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Crea tu Organización
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Para suscribirte al plan {plan.charAt(0).toUpperCase() + plan.slice(1)}, primero necesitas crear una organización.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Seleccionaste {seatCount} {seatCount === 1 ? "asiento" : "asientos"} para tu plan.
          </p>
        </div>
        
        <div className="space-y-6 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la organización
              </label>
              <SettingsInput
                placeholder="Ej. Mi Empresa"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                width="w-full"
              />
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-center">
                    <InfoCircledIcon className="w-4 h-4 text-red-600 mr-2 flex-shrink-0" />
                    <span className="text-sm text-red-700 ml-2">{error}</span>
                  </div>
                </div>
            )}

            <button
                onClick={handleCreateOrgAndSubscribe}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {loading ? "Creando y redirigiendo..." : "Continuar a Stripe"}
            </button>
        </div>
      </div>
    </div>
  );
}

function UnauthenticatedRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.push("/");
    }, [router]);

    return null;
}

export default function SubscribePage() {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
            <LoadingIcon className="size-8 animate-spin" />
        </div>
      </AuthLoading>
      <Authenticated>
        <SubscribePageContent />
      </Authenticated>
      <Unauthenticated>
         <UnauthenticatedRedirect />
      </Unauthenticated>
    </>
  );
}
