"use client";

import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useAuth as useWorkOSAuth } from "@workos-inc/authkit-nextjs/components";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { DomainSsoWidget } from "@/components/settings/widgets/DomainSsoWidget";
import { Flex } from "@radix-ui/themes";
import { AdminPortalSsoConnection, WorkOsWidgets } from "@workos-inc/widgets";
import { useHasPermission } from "@/lib/permissions-client";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getWorkOSWidgetToken } from "@/actions/getWorkOSWidgetToken";

function getBasePlan(plan: string | null | undefined): string {
  if (!plan) return "";
  return plan.replace(/_api$/i, "");
}

const UpgradeBanner = () => (
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

export default function DomainSsoPage() {
  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border">
      {/* Domain Verification Section */}
      <SettingsSection
        title="Verificación de Dominio"
        description="Los usuarios que intenten registrarse desde un dominio verificado, podrán ser agregados a la organizacion automáticamente."
      >
        <AuthLoading>{null}</AuthLoading>

        <Authenticated>
          <DomainVerificationContent />
        </Authenticated>

        <Unauthenticated>
          <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
            <p className="text-sm text-gray-500 dark:text-text-muted">
              Por favor inicia sesión para acceder a esta página.
            </p>
          </div>
        </Unauthenticated>
      </SettingsSection>

      {/* SSO Connections Section */}
      <div className="mt-8">
        <SettingsSection
          title="Conexiones SSO"
          description="Configura las conexiones de Inicio de Sesión Único (SSO) para permitir la autenticación segura a través de proveedores de identidad."
        >
          <AuthLoading>{null}</AuthLoading>

          <Authenticated>
            <SsoConnectionsContent />
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
    </div>
  );
}

function DomainVerificationContent() {
  const { user, organizationId } = useWorkOSAuth();
  const { isAuthenticated } = useConvexAuth();
  const userHasPermission = useHasPermission(
    "WIDGETS_DOMAIN_VERIFICATION_MANAGE",
  );
  const [authTokenPromise, setAuthTokenPromise] = useState<Promise<
    string | null
  > | null>(null);

  // Fetch plan info using useQuery
  const planInfo = useQuery(
    api.organizations.getCurrentOrganizationPlan,
    isAuthenticated ? {} : "skip",
  );

  const isEnterprise = getBasePlan(planInfo?.plan) === "enterprise";

  // Load WorkOS widget token when enterprise plan is confirmed
  // This hook must be called before any conditional returns
  useEffect(() => {
    if (isEnterprise && user && organizationId && !authTokenPromise) {
      const promise = getWorkOSWidgetToken([
        "widgets:domain-verification:manage",
      ] as const).then((result) => {
        if (result.success) {
          return result.token;
        } else {
          console.error("Error al obtener el token:", result.error);
          return null;
        }
      });
      setAuthTokenPromise(promise);
    }
  }, [isEnterprise, user, organizationId, authTokenPromise]);

  if (planInfo === undefined) {
    return null;
  }

  if (!userHasPermission) {
    return (
      <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <p className="text-sm text-gray-500 dark:text-text-muted">
          No tienes autorización para acceder a esta página.
        </p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <p className="text-sm text-gray-500 dark:text-text-muted">
          No se encontró organización.
        </p>
      </div>
    );
  }

  // Now we know the plan info has loaded - check if enterprise
  if (isEnterprise) {
    if (!authTokenPromise) {
      return null;
    }
    return <DomainSsoWidget authTokenPromise={authTokenPromise} />;
  }

  // Show upgrade banner if not enterprise (only after we know for sure)
  return <UpgradeBanner />;
}

function SsoConnectionsContent() {
  const { user, organizationId } = useWorkOSAuth();
  const { isAuthenticated } = useConvexAuth();
  const userHasPermission = useHasPermission(
    "WIDGETS_DOMAIN_VERIFICATION_MANAGE",
  );
  const [authTokenPromise, setAuthTokenPromise] = useState<Promise<
    string | null
  > | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch plan info using useQuery
  const planInfo = useQuery(
    api.organizations.getCurrentOrganizationPlan,
    isAuthenticated ? {} : "skip",
  );

  const isEnterprise = getBasePlan(planInfo?.plan) === "enterprise";

  // Load WorkOS widget token when enterprise plan is confirmed
  // These hooks must be called before any conditional returns
  useEffect(() => {
    if (isEnterprise && user && organizationId && !authTokenPromise) {
      const promise = getWorkOSWidgetToken([
        "widgets:sso:manage",
      ] as const).then((result) => {
        if (result.success) {
          return result.token;
        } else {
          console.error("Error al obtener el token:", result.error);
          return null;
        }
      });
      setAuthTokenPromise(promise);
    }
  }, [isEnterprise, user, organizationId, authTokenPromise]);

  useEffect(() => {
    if (authTokenPromise) {
      authTokenPromise.then((token) => {
        setAuthToken(token);
        setLoading(false);
      });
    }
  }, [authTokenPromise]);

  // Don't show anything while plan info is loading - wait until we know for sure
  if (planInfo === undefined) {
    return null;
  }

  if (!userHasPermission) {
    return (
      <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <p className="text-sm text-gray-500 dark:text-text-muted">
          No tienes autorización para acceder a esta página.
        </p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <p className="text-sm text-gray-500 dark:text-text-muted">
          No se encontró organización.
        </p>
      </div>
    );
  }

  // Now we know the plan info has loaded - check if enterprise
  if (isEnterprise) {
    // Wait for auth token to load before showing anything
    if (loading || !authToken) {
      return null;
    }
    return (
      <Flex direction="column" gap="3" width="100%">
        <WorkOsWidgets
          theme={{
            appearance: "inherit",
            accentColor: "blue",
            radius: "medium",
            fontFamily: "Inter",
            panelBackground: "solid",
          }}
        >
          <AdminPortalSsoConnection authToken={authToken} />
        </WorkOsWidgets>
      </Flex>
    );
  }

  // Show upgrade banner if not enterprise (only after we know for sure)
  return <UpgradeBanner />;
}
