import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import Link from 'next/link';
import { withAuth } from "@workos-inc/authkit-nextjs";
import { hasPermissions } from "@/lib/permissions";
import { SettingsEscapeHandler } from "./settings-escape-handler";
import { SettingsShell } from "@/components/settings/settings-shell";

// Custom scrollbar styles matching the chat interface
const scrollbarStyles = `
  /* Webkit browsers (Chrome, Safari, Edge) */
  .settings-scroll-container::-webkit-scrollbar {
    width: 6px;
    transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    scroll-padding: 0;
    position: absolute;
    right: 0;
  }

  .settings-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .settings-scroll-container::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.3);
    border-radius: 3px;
    transition: background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .settings-scroll-container::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.5);
  }

  /* Firefox */
  .settings-scroll-container {
    scrollbar-width: thin;
    scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
  }

  /* Container setup */
  .settings-scroll-container {
    overflow-y: overlay;
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }
`;

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Batch permission checks to avoid duplicate JWT parsing within this request
  const batch = await hasPermissions([
    "WIDGETS_USERS_TABLE_MANAGE",
    "WIDGETS_DOMAIN_VERIFICATION_MANAGE",
    "VIEW_ORG_ANALYTICS",
    "MANAGE_BILLING",
  ]);
  const canManageMembers = batch.WIDGETS_USERS_TABLE_MANAGE;
  const canManageDomainSso = batch.WIDGETS_DOMAIN_VERIFICATION_MANAGE;
  const canViewAnalytics = batch.VIEW_ORG_ANALYTICS;
  const canManageBilling = batch.MANAGE_BILLING;
  
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <SettingsShell
        sidebar={
          <SettingsSidebar 
            canManageMembers={canManageMembers}
            canManageDomainSso={canManageDomainSso}
            canViewAnalytics={canViewAnalytics}
            canManageBilling={canManageBilling}
          />
        }
      >
        {/* Close button - positioned fixed in top right to stay visible when scrolling */}
        <div className="fixed top-4 right-4 z-30">
          <Link 
            href="/chat"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-background-settings dark:bg-popover-main border dark:border-border shadow-container-small-n hover:bg-hover dark:hover:bg-hover/60 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-border"
            title="Cerrar Ajustes"
          >
            <svg 
              className="w-5 h-5 text-gray-500 dark:text-text-muted group-hover:text-gray-700 dark:group-hover:text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </Link>
        </div>
        <SettingsEscapeHandler />
        {children}
      </SettingsShell>
    </>
  );
}
