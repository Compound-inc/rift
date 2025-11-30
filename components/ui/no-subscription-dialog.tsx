"use client";

import { useState, useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ai/ui/dialog";
import { Button } from "@/components/ai/ui/button";
import { createStripePortalSession } from "@/actions/createStripePortalSession";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { generateUUID } from "@/lib/utils";

interface NoSubscriptionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgName?: string | null;
  stripeCustomerId?: string | null;
  canManageBilling?: boolean;
  subscriptionStatus?: string | null;
}

function GradientBackground() {
  return (
    <svg
      viewBox="0 0 300 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <rect width="300" height="300" fill="url(#nsd_paint0)" />
      <rect width="300" height="300" fill="url(#nsd_paint1)" />
      <rect width="300" height="300" fill="url(#nsd_paint2)" />
      <rect width="300" height="300" fill="url(#nsd_paint3)" />
      <defs>
        <radialGradient
          id="nsd_paint0"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(117 300) rotate(-90) scale(181)"
        >
          <stop stopColor="#5767C2" stopOpacity="0.12" />
          <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id="nsd_paint1"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)"
        >
          <stop stopColor="#FF6D2E" stopOpacity="0.08" />
          <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id="nsd_paint2"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(331 243.5) rotate(-180) scale(208)"
        >
          <stop stopColor="#2CC256" stopOpacity="0.12" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id="nsd_paint3"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(-94 71) scale(150)"
        >
          <stop stopColor="#2CC256" stopOpacity="0.12" />
          <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function NoSubscriptionDialog({
  isOpen,
  onClose,
  orgName,
  stripeCustomerId,
  canManageBilling,
  subscriptionStatus,
}: NoSubscriptionDialogProps) {
  const [isRenewing, setIsRenewing] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const { isAuthenticated } = useConvexAuth();

  const organizationInfo = useQuery(
    api.organizations.getCurrentOrganizationInfo,
    isAuthenticated ? {} : "skip",
  );

  const billingInfo = useQuery(
    api.organizations.getOrganizationBillingInfo,
    isAuthenticated ? {} : "skip",
  );

  const idempotencyKey = useMemo(() => generateUUID(), []);

  const resolved = useMemo(() => {
    const defaultOrgName = orgName ?? organizationInfo?.name ?? billingInfo?.name ?? null;
    const defaultStripeCustomerId = stripeCustomerId ?? billingInfo?.stripeCustomerId ?? null;
    const defaultSubscriptionStatus =
      subscriptionStatus ??
      billingInfo?.subscriptionStatus ??
      organizationInfo?.subscriptionStatus ??
      null;
    const defaultCanManageBilling =
      typeof canManageBilling === "boolean"
        ? canManageBilling
        : Boolean(billingInfo);

    const defaultPlan = organizationInfo?.plan ?? billingInfo?.plan ?? null;

    return {
      orgName: defaultOrgName,
      stripeCustomerId: defaultStripeCustomerId,
      subscriptionStatus: defaultSubscriptionStatus,
      canManageBilling: defaultCanManageBilling,
      plan: defaultPlan,
    };
  }, [
    billingInfo,
    canManageBilling,
    orgName,
    organizationInfo,
    stripeCustomerId,
    subscriptionStatus,
  ]);

  const orgLabel = resolved.orgName ?? "Tu organización";
  const isCanceled = resolved.subscriptionStatus === "canceled";
  const isEnterprise = resolved.plan === "enterprise";

  const handleRenewPlan = async () => {
    if (isRenewing) return;

    if (!resolved.stripeCustomerId) {
      window.location.href = "/settings/billing";
      return;
    }

    setPortalError(null);
    setIsRenewing(true);
    try {
      const { url } = await createStripePortalSession(resolved.stripeCustomerId);
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error) {
      console.error("Failed to open Stripe portal:", error);
      setPortalError(
        "No pudimos abrir el portal de Stripe. Inténtalo de nuevo o visita Ajustes > Facturación.",
      );
    } finally {
      setIsRenewing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg border-none bg-transparent p-0 shadow-none">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/90 shadow-2xl dark:border-zinc-800/60 dark:bg-zinc-950/80">
          <GradientBackground />

          <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-300">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Suscripción requerida
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {isEnterprise ? (
                    "Por favor, contacta al soporte de Rift para reactivar tu suscripción Enterprise."
                  ) : resolved.canManageBilling ? (
                    `${orgLabel} no tiene una suscripción activa. ${
                      isCanceled
                        ? "Elige un nuevo plan para reactivar el acceso."
                        : "Puedes reactivar el acceso desde aquí."
                    }`
                  ) : (
                    `${orgLabel} no tiene una suscripción activa. Pídele a un administrador con permiso de facturación que reactive el plan.`
                  )}
                </DialogDescription>
              </div>
            </div>

            {portalError && (
              <div className="rounded-2xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {portalError}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <Button
                onClick={onClose}
                variant="ghost"
                className="w-full justify-center rounded-2xl border border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white sm:w-auto hover:bg-transparent cursor-pointer"
              >
                Cerrar
              </Button>

              {isEnterprise ? (
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-center rounded-2xl border-zinc-200 bg-white/80 text-zinc-900 hover:bg-white dark:border-zinc-800 dark:bg-transparent dark:text-white dark:hover:bg-zinc-900/60 sm:w-auto"
                >
                  <a href="mailto:enterprise@rift.mx">Contactar Soporte</a>
                </Button>
              ) : resolved.canManageBilling ? (
                <>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full justify-center rounded-2xl border-zinc-200 bg-white/80 text-zinc-900 hover:bg-white dark:border-zinc-800 dark:bg-transparent dark:text-white dark:hover:bg-zinc-900/60 sm:w-auto"
                  >
                    <a href={`/subscribe?plan=free&cancel_existing_subscription=true&idempotency_key=${idempotencyKey}`}>Cambiar a plan gratuito</a>
                  </Button>
                  {isCanceled ? (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full justify-center rounded-2xl border-zinc-200 bg-white/80 text-zinc-900 hover:bg-white dark:border-zinc-800 dark:bg-transparent dark:text-white dark:hover:bg-zinc-900/60 sm:w-auto"
                    >
                      <a href="/#pricing">Ver planes</a>
                    </Button>
                  ) : (
                    <Button
                      onClick={handleRenewPlan}
                      disabled={isRenewing}
                      variant="outline"
                      className="w-full justify-center rounded-2xl border-zinc-200 bg-white/80 text-zinc-900 hover:bg-white dark:border-zinc-800 dark:bg-transparent dark:text-white dark:hover:bg-zinc-900/60 sm:w-auto cursor-pointer"
                    >
                      {isRenewing ? (
                        <>
                          Renovar Plan
                        </>
                      ) : (
                        "Renovar Plan"
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-center rounded-2xl border-zinc-200 bg-white/80 text-zinc-900 hover:bg-white dark:border-zinc-800 dark:bg-transparent dark:text-white dark:hover:bg-zinc-900/60 sm:w-auto"
                >
                  <a href="/#pricing">Ver planes</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
