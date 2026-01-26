"use client";

import { Suspense } from "react";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import Link from 'next/link';
import { SettingsShell } from "@/components/settings/settings-shell";
import { PermissionsProvider } from "@/contexts/permissions-context";

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

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layout is non-blocking - permissions are parsed client-side instantly
  // No server-side loading needed - client-side JWT parsing gives same result immediately
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <PermissionsProvider>
        <Suspense fallback={
          <div className="flex h-[100dvh] w-full overflow-hidden bg-background dark:bg-popover-main">
            <div className="flex-1 overflow-hidden relative flex flex-col min-w-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
              <div className="flex-1 overflow-y-auto relative settings-scroll-container">
                {children}
              </div>
            </div>
          </div>
        }>
          <SettingsShell
            sidebar={<SettingsSidebar />}
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
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </SettingsShell>
        </Suspense>
      </PermissionsProvider>
    </>
  );
}
