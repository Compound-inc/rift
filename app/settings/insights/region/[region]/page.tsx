import RegionalInsightsPage from "@/beta/components/regional-insights-page";
import { hasPermission } from "@/lib/permissions";

export default async function RegionalInsightsRoute() {
  const userHasPermission = await hasPermission("VIEW_ORG_ANALYTICS");
  if (!userHasPermission) {
    return (
      <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border">
        <div className="text-sm">No tienes autorización para acceder a esta página</div>
      </div>
    );
  }
  return <RegionalInsightsPage />;
}
