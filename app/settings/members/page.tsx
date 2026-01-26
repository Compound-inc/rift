"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useAuth as useWorkOSAuth } from "@workos-inc/authkit-nextjs/components";
import { useHasPermissions } from "@/lib/permissions-client";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { MembersData } from "./MembersData";
import { AuditLogsButton } from "./AuditLogsButton";
import { MembersSkeleton } from "./MembersSkeleton";
import "./table.css";

export default function MembersPage() {
  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border">
      <SettingsSection
        title="Gestión de Miembros"
        description="Gestiona los miembros de tu organización."
      >
        <AuthLoading>
          <MembersSkeleton />
        </AuthLoading>

        <Authenticated>
          <MembersContent />
        </Authenticated>

        <Unauthenticated>
          <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
            <p className="text-sm text-gray-500 dark:text-text-muted">
              Por favor inicia sesión para acceder a esta página.
            </p>
          </div>
        </Unauthenticated>
      </SettingsSection>

      <SettingsSection
        title="Audit Logs"
        description="Accede al historial de eventos de tu organización."
        className="mt-8"
      >
        <AuthLoading>
          {null}
        </AuthLoading>

        <Authenticated>
          <AuditLogsContent />
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

function MembersContent() {
  const { user, organizationId } = useWorkOSAuth();
  const { WIDGETS_USERS_TABLE_MANAGE: userHasPermission } = 
    useHasPermissions(["WIDGETS_USERS_TABLE_MANAGE"]);

  if (!organizationId) {
    return (
      <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <p className="text-sm text-gray-500 dark:text-text-muted">
          No se encontró organización.
        </p>
      </div>
    );
  }

  if (!userHasPermission) {
    return (
      <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <p className="text-sm text-gray-500 dark:text-text-muted">
          No tienes permisos para ver la lista de miembros.
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <MembersData
      currentUserId={user.id}
    />
  );
}

function AuditLogsContent() {
  const { organizationId } = useWorkOSAuth();
  const { AUDIT_LOGS: canViewAuditLogs } = 
    useHasPermissions(["AUDIT_LOGS"]);

  if (!organizationId) {
    return (
      <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <p className="text-sm text-gray-500 dark:text-text-muted">
          No se encontró organización.
        </p>
      </div>
    );
  }

  if (!canViewAuditLogs) {
    return (
      <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <p className="text-sm text-gray-500 dark:text-text-muted">
          No tienes autorización para acceder a esta página.
        </p>
      </div>
    );
  }

  return <AuditLogsButton />;
}
