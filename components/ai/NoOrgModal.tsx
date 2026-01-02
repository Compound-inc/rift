"use client";

import { useConvexAuth } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useState } from "react";
import { Button } from "@/components/ai/ui/button";
import { LogOut, Info } from "lucide-react";
import authkitSignOut from "@/actions/signout";
import { useRouter } from "next/navigation";
import { LoadingIcon } from "@/components/ui/icons/svg-icons";

function GradientBackground() {
  return (
    <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 inline-block h-full w-full will-change-transform z-[-1]">
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
    </svg>
  );
}

export function NoOrgModal() {
  const { isAuthenticated } = useConvexAuth();
  const auth = useAuth();
  const [mounted] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { switchToOrganization } = useAuth();
  const router = useRouter();

  if (!mounted || !isAuthenticated || !auth.user) {
    return null;
  }

  // Check if user has an organization
  const hasOrganization = auth.organizationId;

  if (hasOrganization) {
    return null;
  }

  const userName = auth.user.firstName || auth.user.email?.split("@")[0] || "";

  const handleLogout = async () => {
    try {
      await authkitSignOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleCreateOrgAndSubscribe = async () => {
    setLoading(true);
    setError("");
    
    if (orgName.trim() === "") {
        setError("Por favor, ingresa un nombre para tu organización.");
        setLoading(false);
        return;
    }

    if (orgName.length > 50) {
        setError("El nombre de la organización no puede exceder los 50 caracteres.");
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
                userId: auth.user!.id,
                orgName, 
                subscriptionLevel: "free",
            }),
        });

        const data = await res.json();

        if (data.success && data.organizationId) {
            await switchToOrganization(data.organizationId);
            // Force an AuthKit refresh so cookies/JWT include the new org context,
            try {
                await fetch("/api/auth/refresh", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({ organizationId: data.organizationId }),
                });
            } catch {
            }

            if (typeof window !== "undefined") {
                window.location.reload();
            } else {
                router.refresh();
            }
        } else {
            setError(data.error || "Error desconocido al crear la organización");
            setLoading(false);
        }
    } catch (err) {
        console.error(err);
        setError("Error de conexión");
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden relative">
        <GradientBackground />
        
        {/* Content */}
        <div className="p-8 space-y-6 relative z-10">
          {/* Main Title */}
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
            ¡Hola, {userName}!
            </h2>
            <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Crea una organización para comenzar.
            </p>
          </div>

          <div className="space-y-4">
             <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-900 dark:text-white">
                    Nombre de tu organización {orgName.length >= 50 && <span className="text-[10px] text-zinc-500 font-normal">({orgName.length}/50)</span>}
                </label>
                <input
                placeholder="Ej. ACME Corp"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value.slice(0, 50))}
                maxLength={50}
                className="w-full rounded-lg h-11 px-5 border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                    <Info className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                    <span>{error}</span>
                </div>
            )}

            <Button
                onClick={handleCreateOrgAndSubscribe}
                disabled={loading}
                className="w-full h-11 rounded-full text-base font-medium shadow-lg hover:shadow-xl transition-all cursor-pointer"
            >
                {loading ? (
                    <div className="flex items-center gap-2">
                        <LoadingIcon className="size-4 animate-spin" />
                        <span>Creando...</span>
                    </div>
                ) : (
                    "Crear organización"
                )}
            </Button>
          </div>

          {/* Existing Org Info */}
          <div className="rounded-xl bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 p-4 space-y-3">
             <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                ¿Ya tienes una organización?
             </p>
             <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
                <p>
                  Asegúrate de haber iniciado sesión con el correo de tu organización: <span className="text-blue-500">{auth.user.email}</span>
                </p>
                <p>
                  Si te invitaron, pide a tu administrador que te reenvíe la invitación.
                </p>
             </div>
          </div>
          
          {/* Sign out button */}
          <div className="flex justify-center">
            <Button
                onClick={handleLogout}
                variant="ghost"
                className="text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                size="sm"
            >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
