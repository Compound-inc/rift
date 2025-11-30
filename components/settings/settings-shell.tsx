"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface SettingsShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export function SettingsShell({ children, sidebar }: SettingsShellProps) {
  const [isOpen, setIsOpen] = useState(true);
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Close sidebar on navigation on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [pathname, isMobile]);

  // Initial state for mobile
  useEffect(() => {
    if (isMobile) {
      const shouldOpenSidebar = searchParams.get("sidebar") === "true";
      setIsOpen(shouldOpenSidebar);
    } else {
      setIsOpen(true);
    }
  }, [isMobile, searchParams]);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background dark:bg-popover-main">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full flex-col bg-background-settings dark:bg-popover-main transition-transform duration-300 md:relative md:translate-x-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isMobile ? "w-72 shadow-xl" : "w-auto"
        )}
      >
        <div className="flex h-full flex-col overflow-hidden">
             {/* Mobile Close Button */}
             {isMobile && (
                <div className="absolute top-4 right-4 z-50">
                    <button
                        onClick={toggle}
                        className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}
            {sidebar}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={toggle}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex flex-col min-w-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
         {/* Mobile Header / Toggle */}
         {isMobile && (
            <div className="flex items-center p-4 border-b md:hidden flex-shrink-0">
              <button
                onClick={toggle}
                className="mr-4 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="font-semibold">Ajustes</span>
            </div>
          )}
          
        <div className="flex-1 overflow-y-auto relative settings-scroll-container">
             {children}
        </div>
      </main>
    </div>
  );
}
