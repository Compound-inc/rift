import { SettingsSection } from "@/components/settings";
import { SecurityWidget } from "@/components/settings/widgets/SecurityWidget";
import { withAuth } from "@workos-inc/authkit-nextjs";

export default async function SecurityPage() {
  const { user, accessToken } = await withAuth({ ensureSignedIn: true });

  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border">
      <SettingsSection
        title="Configuración de Seguridad"
        description="Gestiona tu contraseña y metodos de autenticación."
      >
        <SecurityWidget accessToken={accessToken || null} userId={user.id} />
      </SettingsSection>
    </div>
  );
}
