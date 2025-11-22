import { SettingsSection } from "@/components/settings/SettingsSection";
import { DomainSsoWidget } from "@/components/settings/widgets/DomainSsoWidget";
import { SsoWidget } from "@/components/settings/widgets/SsoWidget";
import { Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { workos } from "@/app/api/workos";
import { hasPermission } from "@/lib/permissions";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function DomainSsoPage() {
  const { user, accessToken, organizationId } = await withAuth({
    ensureSignedIn: true,
  });

  const userHasPermission = await hasPermission("WIDGETS_DOMAIN_VERIFICATION_MANAGE");
  if (!userHasPermission) {
    return (
      <div className="pt-12 pb-12 pl-12 pr-12 flex flex-col max-w-4xl min-w-[520px] w-full min-h-full box-border">
        <Flex direction="column" gap="3" width="100%">
          <Box>
            <Heading>Gestión de Dominio y SSO</Heading>
          </Box>
          <Card>
            <Text>No tienes autorización para acceder a esta página</Text>
          </Card>
        </Flex>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="pt-12 pb-12 pl-12 pr-12 flex flex-col max-w-4xl min-w-[520px] w-full min-h-full box-border">
        <Flex direction="column" gap="3" width="100%">
          <Box>
            <Heading>Gestión de Dominio y SSO</Heading>
          </Box>
          <Card>
            <Text>No se encontró organización</Text>
          </Card>
        </Flex>
      </div>
    );
  }

  // Check organization plan
  const planInfo = await fetchQuery(
    api.organizations.getCurrentOrganizationPlan,
    {},
    { token: accessToken }
  );

  const isEnterprise = planInfo?.plan === "enterprise";

  // Show section headers immediately, load WorkOS widget asynchronously only if enterprise
  let authTokenPromise: Promise<string | null> | null = null;
  
  if (isEnterprise) {
    authTokenPromise = workos.widgets.getToken({
      organizationId,
      userId: user.id,
      scopes: ["widgets:domain-verification:manage", "widgets:sso:manage"],
    }).catch((error) => {
      console.error("Error al obtener el token:", error);
      return null;
    });
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

  return (
    <div className="pt-12 pb-12 pl-12 pr-12 flex flex-col max-w-4xl min-w-[520px] w-full min-h-full box-border">
      {/* Domain Verification Section */}
      <SettingsSection
        title="Verificación de Dominio"
        description="Los usuarios que intenten registrarse desde un dominio verificado, podrán ser agregados a la organizacion automáticamente."
      >
        {isEnterprise && authTokenPromise ? (
          <DomainSsoWidget authTokenPromise={authTokenPromise} />
        ) : (
          <UpgradeBanner />
        )}
      </SettingsSection>

      {/* SSO Connections Section */}
      <div className="mt-8">
        {isEnterprise && authTokenPromise ? (
          <SsoWidget authTokenPromise={authTokenPromise} />
        ) : (
          <SettingsSection
            title="Conexiones SSO"
            description="Configura las conexiones de Inicio de Sesión Único (SSO) para permitir la autenticación segura a través de proveedores de identidad."
          >
            <UpgradeBanner />
          </SettingsSection>
        )}
      </div>
    </div>
  );
}
