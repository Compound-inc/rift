"use client";

import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useRouter, useSearchParams } from "next/navigation";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useEffect, useState } from "react";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { LoadingIcon } from "@/components/ui/icons/svg-icons";
import { Button } from "@/components/ai/ui/button";
import { landingPlans } from "@/components/landing/data/pricing";

function GradientBackground({ id }: { id: string }) {
  const gradients = {
    "1": (
      <>
        <rect width="300" height="300" fill="url(#paint0_radial_262_665)" />
        <rect width="300" height="300" fill="url(#paint1_radial_262_665)" />
        <rect width="300" height="300" fill="url(#paint2_radial_262_665)" />
        <rect width="300" height="300" fill="url(#paint3_radial_262_665)" />
        <defs>
          <radialGradient id="paint0_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117 300) rotate(-90) scale(181)">
            <stop stopColor="#5767C2" stopOpacity="0.1" />
            <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint1_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)">
            <stop stopColor="#FF6D2E" stopOpacity="0.07" />
            <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint2_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(331 243.5) rotate(-180) scale(208)">
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint3_radial_262_665" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-94 71) scale(150)">
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    "2": (
      <>
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint0_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint1_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint2_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint3_radial_262_666)" />
        <rect width="300" height="300" transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)" fill="url(#paint4_radial_262_666)" />
        <defs>
          <radialGradient id="paint0_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(300 243.5) rotate(-155.81) scale(205)">
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint1_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="rotate(38.6107) scale(273.226)">
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint2_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(103 383) rotate(-89.3415) scale(174.011)">
            <stop stopColor="#FAC507" stopOpacity="0.1" />
            <stop offset="1" stopColor="#FAC507" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint3_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-50 242.5) scale(147.5)">
            <stop stopColor="#CD81F3" stopOpacity="0.07" />
            <stop offset="1" stopColor="#CD81F3" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="paint4_radial_262_666" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(425.5 62) rotate(-178.961) scale(193.032)">
            <stop stopColor="#FF6D2E" stopOpacity="0.07" />
            <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    "3": (
      <>
        <path fill="url(#a)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#b)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#c)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#d)" d="M0 300h300V0H0v300Z" />
        <radialGradient id="a" cx="0" cy="0" r="1" gradientTransform="matrix(0 181 -181 0 183 0)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5767C2" stopOpacity=".1" />
          <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="b" cx="0" cy="0" r="1" gradientTransform="translate(101 220.5) scale(142.5)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6D2E" stopOpacity=".07" />
          <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="c" cx="0" cy="0" r="1" gradientTransform="matrix(208 0 0 208 -31 56.5)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2CC256" stopOpacity=".1" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="d" cx="0" cy="0" r="1" gradientTransform="matrix(-150 0 0 -150 394 229)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2CC256" stopOpacity=".1" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
      </>
    ),
  };

  return (
    <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 inline-block h-full w-full will-change-transform z-[-1]">
      {gradients[id as keyof typeof gradients]}
    </svg>
  );
}

function SubscribePageContent() {
  const { user, organizationId, switchToOrganization } = useAuth();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const cancelAllExistingSubscriptions = searchParams.get("cancel_existing_subscription") === "true";
  const idempotencyKey = searchParams.get("idempotency_key");
  const router = useRouter();
  
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedPlan = landingPlans.find(
    (p) => p.name.toLowerCase() === planParam?.toLowerCase()
  );

  const gradientId = selectedPlan?.gradientId || "1";
  const planName = selectedPlan?.name || planParam;

  // Auto-redirect if user has organization
  useEffect(() => {
    const handleAutoSubscribe = async () => {
      if (user && organizationId && planParam && !loading) {
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
                    subscriptionLevel: planParam.toLowerCase(),
                    cancelAllExistingSubscriptions: cancelAllExistingSubscriptions,
                    idempotencyKey,
                }),
            });

            const { error, url } = await res.json();

            if (!error && url) {
                router.push(url);
            } else if (error && url) {
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
  }, [user, organizationId, planParam, router]);

  if (!planParam) {
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
                organizationId: undefined, // Explicitly undefined for new org
                subscriptionLevel: planParam.toLowerCase(),
            }),
        });

        const { error, url, organizationId: newOrgId } = await res.json();

        if (!error && url) {
            if (newOrgId) {
                await switchToOrganization(newOrgId);
            }
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
    <div className="flex flex-col items-center justify-center min-h-screen p-4 relative overflow-hidden">
      <div className="max-w-md w-full text-center relative z-10">
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
          <GradientBackground id={gradientId} />
          
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white">
                Crea tu Organización
              </h2>
              <p className="mt-2 text-sm text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.6)] dark:text-zinc-400">
                Para suscribirte al plan <span className="font-medium text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white">{planName}</span>, primero necesitas crear una organización.
              </p>
            </div>
            
            <div className="space-y-6 text-left">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white">
                    Nombre de la organización
                  </label>
                  <input
                    placeholder="Ej. Mi Empresa"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full rounded-[50px] h-10 px-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.1)] dark:text-white placeholder:text-zinc-400"
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

                <Button
                    onClick={handleCreateOrgAndSubscribe}
                    disabled={loading}
                    className="hover:bg-white hover:text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] hover:shadow-[rgba(0,0,0,0.1)_0px_0px_0px_1px] relative flex w-full cursor-pointer select-none items-center justify-center bg-white text-sm leading-4 tracking-normal duration-[0.17s] text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 shadow-[rgba(0,0,0,0.05)_0px_0px_0px_1px] rounded-[50px] h-10 border border-zinc-200 dark:border-zinc-800"
                >
                    {loading ? "Creando" : "Continuar"}
                </Button>
            </div>
          </div>
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
