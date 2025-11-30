import { SettingsSection, SettingsDivider } from "@/components/settings";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { ProfileWidget } from "@/components/settings/widgets/ProfileWidget";
import { AdvancedDebugWidget } from "@/components/settings/widgets/AdvancedDebugWidget";

export default async function ProfilePage() {
  const { user, accessToken } = await withAuth({ ensureSignedIn: true });

  // Process debug information
  let claimsForDebug: unknown = null;
  if (accessToken) {
    try {
      const [, payload] = accessToken.split(".");
      const claims = JSON.parse(
        Buffer.from(payload, "base64").toString("utf8"),
      ) as { permissions?: Array<string> };
      claimsForDebug = claims;
    } catch {
      // ignore decode errors
    }
  }

  const debugUser: string = JSON.stringify(user ?? {}, null, 2);
  const debugClaims: string = JSON.stringify(claimsForDebug ?? {}, null, 2);

  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border">
      {/* WorkOS User Profile Widget */}
      <SettingsSection
        title="Gestión de Perfil"
        description="Gestiona tu información personal y preferencias."
      >
        <ProfileWidget accessToken={accessToken || null} />
      </SettingsSection>

      <SettingsDivider />

      {/* Debug Section*/}
      {process.env.NODE_ENV !== "production" && (
        <SettingsSection
          title="Avanzado"
          description="Información de depuración."
        >
          <AdvancedDebugWidget debugUser={debugUser} debugClaims={debugClaims} />
        </SettingsSection>
      )}
    </div>
  );
}
