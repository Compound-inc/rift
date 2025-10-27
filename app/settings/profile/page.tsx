import { SettingsSection, SettingsDivider } from "@/components/settings";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { workos } from "@/app/api/workos";
import { ProfileWidget } from "@/components/settings/widgets/ProfileWidget";
import { AdvancedDebugWidget } from "@/components/settings/widgets/AdvancedDebugWidget";

export default async function ProfilePage() {
  const { user, organizationId, accessToken } = await withAuth({ ensureSignedIn: true });

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

  // Show fallback content immediately, load WorkOS widget asynchronously
  const authTokenPromise = organizationId 
    ? workos.widgets.getToken({
        organizationId,
        userId: user.id,
        scopes: ["widgets:users-table:manage"],
      }).catch((error) => {
        console.error("Error al obtener el token:", error);
        return null;
      })
    : Promise.resolve(null);

  return (
    <div className="pt-12 pb-12 pl-12 pr-12 flex flex-col max-w-4xl min-w-[520px] w-full min-h-full box-border">
      {/* WorkOS User Profile Widget */}
      <SettingsSection
        title="Gestión de Perfil"
        description="Gestiona tu información personal y preferencias."
      >
        <ProfileWidget authTokenPromise={authTokenPromise} />
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
