"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, CreditCard } from "lucide-react";
import { BillingButton } from "./BillingButton";
import { BillingSkeleton } from "./BillingSkeleton";

// Precios estimados en MXN (Hardcoded para visualización)
// Plus: ~$10 USD -> $200 MXN
// Pro: ~$27 USD -> $540 MXN
const PLAN_PRICES_MXN = {
  plus: 190,
  pro: 540,
  enterprise: 0,
} as const;

function StatusBadge({ status }: { status: string }) {
  const styles = {
    active:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    canceled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    incomplete:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    past_due:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    trialing:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    none: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  } as const;

  const labels = {
    active: "Activo",
    canceled: "Cancelado",
    incomplete: "Incompleto",
    past_due: "Pago Pendiente",
    trialing: "Prueba Gratuita",
    none: "Sin Suscripción",
  } as const;

  const statusKey = (status as keyof typeof styles) || "none";

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[statusKey]}`}
    >
      {labels[statusKey as keyof typeof labels] || status}
    </span>
  );
}

function getBasePlan(plan: string): string {
  return plan.replace(/_api$/i, "");
}

function capitalizePlan(plan: string): string {
  const basePlan = getBasePlan(plan);
  return basePlan.charAt(0).toUpperCase() + basePlan.slice(1);
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

export function BillingContent() {
  const { isAuthenticated } = useConvexAuth();

  // Fetch billing info using useQuery
  const billingInfo = useQuery(
    api.organizations.getOrganizationBillingInfo,
    isAuthenticated ? {} : "skip",
  );

  // Show skeleton while loading
  if (billingInfo === undefined) {
    return <BillingSkeleton />;
  }

  // Show error if query failed or no data
  if (billingInfo === null) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50 flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
            No se encontró información
          </h3>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">
            No pudimos cargar la información de facturación de tu organización.
            Por favor intenta más tarde.
          </p>
        </div>
      </div>
    );
  }

  const basePlan = getBasePlan(billingInfo.plan || "plus");
  const planKey = (basePlan as keyof typeof PLAN_PRICES_MXN) || "plus";
  const seatQuantity = billingInfo.seatQuantity ?? 1;
  const unitPrice = PLAN_PRICES_MXN[planKey] || 0;
  const totalPrice = unitPrice * seatQuantity;

  return (
    <div className="space-y-6">
      {/* Plan Card */}
      <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Plan Actual
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold capitalize text-gray-900 dark:text-white">
                {billingInfo.plan ? capitalizePlan(billingInfo.plan) : "Free"}
              </span>
              <StatusBadge status={billingInfo.subscriptionStatus} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100 dark:border-border/50">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-text-muted mb-2">
              Inicio ciclo de facturación
            </p>
            <div className="flex flex-col space-y-1 text-gray-900 dark:text-white text-sm">
              <div className="flex items-center">
                <span>{formatDate(billingInfo.billingCycleStart)}</span>
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-text-muted mb-2">
                Vence el
              </p>
              <div className="flex items-center">
                <span>{formatDate(billingInfo.billingCycleEnd)}</span>
              </div>
            </div>
            {basePlan !== "enterprise" && (
              <div className="mt-4">
                <BillingButton
                  stripeCustomerId={billingInfo.stripeCustomerId}
                />
              </div>
            )}
          </div>

          {basePlan !== "enterprise" && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-text-muted mb-2">
                Método de Pago
              </p>
              <div className="flex items-center text-gray-900 dark:text-white mb-4">
                <CreditCard className="w-4 h-4 mr-2 text-gray-400" />
                <span>
                  {billingInfo.paymentMethodBrand &&
                  billingInfo.paymentMethodLast4
                    ? `${billingInfo.paymentMethodBrand.toUpperCase()} •••• ${billingInfo.paymentMethodLast4}`
                    : "No configurado"}
                </span>
              </div>

              <p className="text-sm font-medium text-gray-500 dark:text-text-muted mb-2">
                Pago mensual actual
              </p>
              <div className="flex items-center text-gray-900 dark:text-white">
                <span className="text-lg font-semibold">
                  {formatPrice(totalPrice)}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({seatQuantity} {seatQuantity === 1 ? "asiento" : "asientos"})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
