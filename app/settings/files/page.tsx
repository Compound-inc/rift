import { SettingsSection } from "@/components/settings";
import { FilesClient } from "@/components/settings/files-client";
import { getAccessToken } from "@/lib/auth";

export default async function ArchivosPage() {
  await getAccessToken();

  return (
    <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border bg-background dark:bg-popover-main">
      <SettingsSection
        title="Archivos Adjuntos"
        description="Accede a la lista de archivos que has subido en tus conversaciones."
      >
        <FilesClient />
      </SettingsSection>
    </div>
  );
}
