"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useHasPermission } from "@/lib/permissions-client";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { BillingContent } from "./BillingContent";
import { BillingSkeleton } from "./BillingSkeleton";

export default function BillingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const canManageBilling = useHasPermission("MANAGE_BILLING");

  // #region agent log
  useEffect(() => {
    const navStartTime = typeof window !== 'undefined' ? (window as any).__navStartTime : null;
    const timeSinceNav = navStartTime ? performance.now() - navStartTime : null;
    fetch('http://127.0.0.1:7242/ingest/047d796f-87bb-4f09-adbd-1a615912b381',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/billing/page.tsx:15',message:'BillingPage component mounted',data:{pathname,canManageBilling,timeSinceNav,navStartTime,currentTime:performance.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  }, [pathname, canManageBilling]);
  // #endregion

  // Redirect if user doesn't have permission
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/047d796f-87bb-4f09-adbd-1a615912b381',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/billing/page.tsx:22',message:'Redirect check useEffect',data:{canManageBilling,willRedirect:!canManageBilling},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (!canManageBilling) {
      router.replace("/settings/profile");
    }
  }, [canManageBilling, router]);

  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border">
      <SettingsSection
        title="Suscripción y Facturación"
        description="Gestiona el plan de tu organización y revisa tu historial de facturación."
      >
        <AuthLoading>
          <BillingSkeleton />
        </AuthLoading>

        <Authenticated>
          {canManageBilling ? (
            <BillingContent />
          ) : (
            <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
              <p className="text-sm text-gray-500 dark:text-text-muted">
                No tienes autorización para acceder a esta página.
              </p>
            </div>
          )}
        </Authenticated>

        <Unauthenticated>
          <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
            <p className="text-sm text-gray-500 dark:text-text-muted">
              Por favor inicia sesión para acceder a esta página.
            </p>
          </div>
        </Unauthenticated>
      </SettingsSection>
    </div>
  );
}

