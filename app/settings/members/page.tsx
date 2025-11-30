import { MembersList } from "@/components/settings/MembersList";
import { Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { hasPermission } from "@/lib/permissions";
import "./table.css";
import { getAuditLogPortalLink } from "@/actions/getAuditLogPortalLink";
import { SettingsSection } from "@/components/settings";
import { getPaginatedOrganizationMembers, PaginatedOrganizationData, getOrganizationMemberCount } from "@/actions/getOrganizationMembers";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function MembersPage() {
  const { user, accessToken, organizationId } = await withAuth({
    ensureSignedIn: true,
  });

  if (!organizationId) {
    return (
      <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border">
        <Flex direction="column" gap="3" width="100%">
          <Box>
            <Heading>Gestión de Miembros</Heading>
          </Box>
          <Card>
            <Text>No se encontró organización</Text>
          </Card>
        </Flex>
      </div>
    );
  }

  const userHasPermission = await hasPermission("WIDGETS_USERS_TABLE_MANAGE");
  const canViewAuditLogs = await hasPermission("AUDIT_LOGS");

  // Check organization plan for enterprise features
  const planInfo = await fetchQuery(
    api.organizations.getCurrentOrganizationPlan,
    {},
    { token: accessToken }
  ).catch((e) => {
    console.error("Error fetching organization plan:", e);
    return null;
  });

  const isEnterprise = planInfo?.plan === "enterprise";

  let initialData: PaginatedOrganizationData = { members: [], invitations: [], nextCursor: null, prevCursor: null };
  let seatQuantity: number | null = null;
  let totalMemberCount: number = 0;
  let plan: "free" | "plus" | "pro" | "enterprise" | null = null;

  if (userHasPermission) {
    const [data, seats, count, planResult] = await Promise.all([
      getPaginatedOrganizationMembers(organizationId, 50),
      fetchQuery(api.organizations.getOrganizationSeats, { 
        workos_id: organizationId,
        secret: process.env.CONVEX_SECRET_TOKEN!
      }).catch((e) => {
        console.error("Error fetching seat quantity:", e);
        return null;
      }),
      getOrganizationMemberCount(organizationId).catch((e) => {
        console.error("Error fetching member count:", e);
        return 0;
      }),
      fetchQuery(api.organizations.getOrganizationPlan, {
        workos_id: organizationId,
        secret: process.env.CONVEX_SECRET_TOKEN!
      }).catch((e) => {
        console.error("Error fetching plan:", e);
        return null;
      })
    ]);
    initialData = data;
    seatQuantity = seats;
    totalMemberCount = count;
    plan = planResult;
  }

  let auditLogsLink: string | null = null;
  if (canViewAuditLogs && isEnterprise) {
    try {
      auditLogsLink = await getAuditLogPortalLink(organizationId);
    } catch (e) {
      console.warn("No se pudo obtener el enlace del portal de Audit Logs:", e);
    }
  }

  // If the user has NEITHER permission, show access denied
  if (!userHasPermission && !canViewAuditLogs) {
    return (
      <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border">
        <Flex direction="column" gap="3" width="100%">
          <Box>
            <Heading>Gestión de Miembros</Heading>
          </Box>
          <Card>
            <Text>No tienes autorización para acceder a esta página</Text>
          </Card>
        </Flex>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border">
      <Box className="mb-6">
        <Heading size="6" mb="2">Gestión de Miembros</Heading>
        <Text color="gray" size="2">Gestiona los miembros de tu organización.</Text>
      </Box>
      
      <div className="w-full">
        {userHasPermission ? (
          <MembersList 
            initialData={initialData} 
            organizationId={organizationId} 
            currentUserId={user.id} 
            seatQuantity={seatQuantity} 
            totalMemberCount={totalMemberCount}
            plan={plan}
          />
        ) : (
          <Card>
            <Text>No tienes permisos para ver la lista de miembros.</Text>
          </Card>
        )}
      </div>

      {canViewAuditLogs && (
        <SettingsSection
          title="Audit Logs"
          description="Accede al historial de eventos de tu organización."
          className="mt-8"
        >
          {isEnterprise && auditLogsLink ? (
            <div className="flex items-center justify-between">
              <a
                href={auditLogsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-strong"
              >
                Abrir Audit Logs
              </a>
            </div>
          ) : (
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
          )}
        </SettingsSection>
      )}
    </div>
  );
}
