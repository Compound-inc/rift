import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SettingsSection } from "@/components/settings";
import { QuotaClient } from "@/components/settings/quota-client";
import { getAccessToken } from "@/lib/auth";

export default async function UsagePage() {
  // Get the access token for server-side authentication
  const token = await getAccessToken();
  
  // Preload the quota data on the server with authentication
  const preloadedQuotaInfo = await preloadQuery(
    api.users.getUserFullQuotaInfo,
    {},
    { token }
  );

  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border bg-background dark:bg-popover-main">
      <SettingsSection
        title="Uso y Limites"
        description="Monitorea el uso actual de tu cuota de mensajes Standard y Premium."
      >
        <QuotaClient preloadedQuotaInfo={preloadedQuotaInfo} />
      </SettingsSection>
    </div>
  );
}
