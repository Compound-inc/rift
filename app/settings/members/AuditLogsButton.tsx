"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAuditLogPortalLink } from "@/actions/getAuditLogPortalLink";
import { useState } from "react";

export function AuditLogsButton() {
  const { isAuthenticated } = useConvexAuth();
  const [auditLogsLink, setAuditLogsLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch plan info using useQuery
  const planInfo = useQuery(
    api.organizations.getCurrentOrganizationPlan,
    isAuthenticated ? {} : "skip"
  );
  
  const handleGetLink = async () => {
    if (auditLogsLink) {
      window.open(auditLogsLink, "_blank", "noopener,noreferrer");
      return;
    }

    setIsLoading(true);
    try {
      const link = await getAuditLogPortalLink();
      setAuditLogsLink(link);
      if (link) {
        window.open(link, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      console.warn("No se pudo obtener el enlace del portal de Audit Logs:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show anything while plan info is loading - wait until we know for sure
  if (planInfo === undefined) {
    return null;
  }

  // Now we know the plan info has loaded - check if enterprise
  const isEnterprise = planInfo?.plan === "enterprise";

  // Show upgrade banner if not enterprise (only after we know for sure)
  if (!isEnterprise) {
    return (
      <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <p className="text-sm text-gray-500 dark:text-text-muted mb-4">
          Si estás interesado en esta funcionalidad, contacta al soporte de Rift.
        </p>
        <a
          href="mailto:features@rift.mx"
          className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-strong transition-colors cursor-pointer"
        >
          Contactar Soporte
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={handleGetLink}
        disabled={isLoading}
        className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Cargando..." : "Abrir Audit Logs"}
      </button>
    </div>
  );
}
