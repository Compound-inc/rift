"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SettingsSection } from "@/components/settings";
import { Loader2, AlertTriangle, CreditCard, Calendar, DollarSign } from "lucide-react";

import { BillingButton } from "./BillingButton";

// Precios estimados en MXN (Hardcoded para visualización)
// Plus: ~$10 USD -> $200 MXN
// Pro: ~$27 USD -> $540 MXN
const PLAN_PRICES_MXN = {
  plus: 190,
  pro: 540,
  enterprise: 0,
};

function BillingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-40 bg-gray-100 dark:bg-popover-secondary rounded-lg"></div>
      <div className="h-60 bg-gray-100 dark:bg-popover-secondary rounded-lg"></div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    canceled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    incomplete: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    past_due: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    trialing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    none: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };

  const labels = {
    active: "Activo",
    canceled: "Cancelado",
    incomplete: "Incompleto",
    past_due: "Pago Pendiente",
    trialing: "Prueba Gratuita",
    none: "Sin Suscripción",
  };

  const statusKey = (status as keyof typeof styles) || "none";

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[statusKey]}`}>
      {labels[statusKey as keyof typeof labels] || status}
    </span>
  );
}

export function BillingPageContent() {
  const billingInfo = useQuery(api.organizations.getOrganizationBillingInfo);

  if (billingInfo === undefined) {
    return (
      <div className="pt-12 pb-12 pl-12 pr-12 max-w-4xl w-full">
        <BillingSkeleton />
      </div>
    );
  }

  if (billingInfo === null) {
    return (
      <div className="pt-12 pb-12 pl-12 pr-12 max-w-4xl w-full">
        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">No se encontró información</h3>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
              No pudimos cargar la información de facturación de tu organización. Por favor intenta más tarde.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const planKey = (billingInfo.plan as keyof typeof PLAN_PRICES_MXN) || "plus";
  const seatQuantity = billingInfo.seatQuantity ?? 1;
  const unitPrice = PLAN_PRICES_MXN[planKey] || 0;
  const totalPrice = unitPrice * seatQuantity;

  return (
    <div className="pt-12 pb-12 pl-12 pr-12 flex flex-col max-w-4xl min-w-[520px] w-full min-h-full box-border">
      <SettingsSection
        title="Suscripción y Facturación"
        description="Gestiona el plan de tu organización y revisa tu historial de facturación."
      >
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
                    {billingInfo.plan || "Free"}
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
                  <p className="text-sm font-medium text-gray-500 dark:text-text-muted mb-2">Vence el</p>
                  <div className="flex items-center">
                    <span>{formatDate(billingInfo.billingCycleEnd)}</span>
                  </div>
                </div>
                {billingInfo.plan !== "enterprise" && (
                  <div className="mt-4">
                    <BillingButton stripeCustomerId={billingInfo.stripeCustomerId} />
                  </div>
                )}
              </div>
              
              {billingInfo.plan !== "enterprise" && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-text-muted mb-2">
                    Método de Pago
                  </p>
                  <div className="flex items-center text-gray-900 dark:text-white mb-4">
                    <CreditCard className="w-4 h-4 mr-2 text-gray-400" />
                    <span>
                      {billingInfo.paymentMethodBrand && billingInfo.paymentMethodLast4
                        ? `${billingInfo.paymentMethodBrand.toUpperCase()} •••• ${billingInfo.paymentMethodLast4}`
                        : "No configurado"}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-gray-500 dark:text-text-muted mb-2">
                     Pago mensual actual
                  </p>
                  <div className="flex items-center text-gray-900 dark:text-white">
                    <DollarSign className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-lg font-semibold">
                      {formatPrice(totalPrice)}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({seatQuantity} {seatQuantity === 1 ? 'asiento' : 'asientos'})
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
