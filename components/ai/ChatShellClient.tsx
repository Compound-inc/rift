"use client";

import { useCallback, useMemo, useState, useEffect, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { Button } from "@/components/ai/ui/button";
import { UpgradeButton } from "./UpgradeButton";

type SidebarControlContextValue = {
  closeSidebar: () => void;
  isMobile: boolean;
};

const SidebarControlContext = createContext<SidebarControlContextValue>({
  closeSidebar: () => {},
  isMobile: false,
});

export function useChatSidebarControls() {
  return useContext(SidebarControlContext);
}

type ChatShellClientProps = {
  children: React.ReactNode;
  className?: string;
  sidebar?: React.ReactNode;
};

export function ChatShellClient({ children, className, sidebar }: ChatShellClientProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState<boolean>(() => !isMobile);

  // Keyboard shortcut: Cmd/Ctrl + B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setIsOpen(false), []);

  const sidebarWidth = 280; // px

  const sidebarStyle = useMemo<React.CSSProperties>(
    () => isMobile ? {} : ({ width: isOpen ? sidebarWidth : 0 }),
    [isOpen, isMobile]
  );

  const sidebarContextValue = useMemo(
    () => ({
      closeSidebar,
      isMobile,
    }),
    [closeSidebar, isMobile],
  );

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background-secondary">
      <div className="flex h-full w-full">
        <aside
          className={cn(
            "transition-all duration-200 ease-in-out bg-background-secondary",
            isMobile
              ? cn(
                  "fixed inset-y-0 left-0 z-50 w-[280px] shadow-2xl",
                  isOpen ? "translate-x-0" : "-translate-x-full"
                )
              : cn(
                  "relative hidden shrink-0 md:block"
                )
          )}
          style={sidebarStyle}
        >
          <SidebarControlContext.Provider value={sidebarContextValue}>
            {isMobile && isOpen && (
              <button
                onClick={toggle}
                className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-md border bg-background/80 backdrop-blur-sm transition-colors shadow-sm hover:bg-accent dark:bg-popover-main dark:border-border"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
            <div className={cn(
              "absolute inset-0 overflow-y-auto",
              !isOpen && "invisible"
            )}>
              {sidebar}
            </div>
          </SidebarControlContext.Provider>
        </aside>
        {isMobile && isOpen && (
          <div 
            className="fixed inset-0 z-40 md:hidden backdrop-blur-sm"
            onClick={toggle}
          />
        )}

        <main
          className={cn(
            "relative flex h-full min-h-0 flex-1 flex-col bg-transparent p-0 sm:p-0 md:p-2.5",
            className
          )}
        >
          <div className={cn("flex-1 min-h-0")}>
            <div className="relative flex h-full min-h-0 flex-col bg-background rounded-3xl overflow-visible overflow-x-clip border border-border">
              {(!isMobile || !isOpen) && (
                <>
                  <div className="absolute top-4 left-4 z-10 flex gap-2 items-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={toggle}
                      aria-pressed={isOpen}
                      title={`${isOpen ? 'Hide' : 'Show'} sidebar (⌘+B)`}
                    >
                      {isOpen ? (
                        <ChevronLeftIcon className="size-4" />
                      ) : (
                        <ChevronRightIcon className="size-4" />
                      )}
                    </Button>
                    <ThemeToggle size="md" styleType="secondary" />
                  </div>
                  <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
                    <UpgradeButton />
                  </div>
                </>
              )}
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
