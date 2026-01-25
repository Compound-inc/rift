"use client";

import { useEffect, Suspense } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  
  // #region agent log
  useEffect(() => {
    const navStartTime = typeof window !== 'undefined' ? (window as any).__navStartTime : null;
    const timeSinceNav = navStartTime ? performance.now() - navStartTime : null;
    fetch('http://127.0.0.1:7242/ingest/047d796f-87bb-4f09-adbd-1a615912b381',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/layout.tsx:55',message:'Layout render/mount',data:{pathname,timeSinceNav,navStartTime,currentTime:performance.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }, [pathname]);
  // #endregion
  
  // Layout is non-blocking - permissions are parsed client-side instantly
  // No server-side loading needed - client-side JWT parsing gives same result immediately
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <PermissionsProvider>
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
      </PermissionsProvider>
    </>
  );
}
