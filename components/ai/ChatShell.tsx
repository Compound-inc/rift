"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type ChatShellProps = {
  children: React.ReactNode;
  className?: string;
  sidebar?: React.ReactNode;
};

export default function ChatShell({ children, className, sidebar }: ChatShellProps) {
  // Always start with true (sidebar open by default)
  const [isOpen, setIsOpen] = useState<boolean>(true);

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

  const sidebarWidth = 280; // px

  const sidebarStyle = useMemo<React.CSSProperties>(
    () => ({ width: isOpen ? sidebarWidth : 0 }),
    [isOpen]
  );

  return (
    <div className="h-[100dvh] w-full overflow-hidden">
      <div className="flex h-full w-full">
        <aside
          className={cn(
            "relative hidden shrink-0 border-r bg-background transition-[width] duration-200 ease-in-out md:block",
          )}
          style={sidebarStyle}
        >
          <div className="absolute inset-0 overflow-y-auto">
            {isOpen ? sidebar : null}
          </div>
        </aside>

        <main className={cn("relative flex h-full min-h-0 flex-1 flex-col", className)}>
          {/* Floating sidebar button */}
          <button
            type="button"
            onClick={toggle}
            aria-pressed={isOpen}
            title={`${isOpen ? 'Hide' : 'Show'} sidebar (⌘+B)`}
            className={cn(
              "absolute top-4 left-4 z-10 inline-flex h-9 items-center rounded-md border bg-background/80 backdrop-blur-sm px-3 text-sm transition-colors shadow-sm",
              "hover:bg-background hover:shadow-md"
            )}
          >
            {isOpen ? "Hide sidebar" : "Show sidebar"}
          </button>

          <div className={cn("flex-1 min-h-0")}> 
            {/* Full-width scroll container; pages/components will center content */}
            <div className="flex h-full min-h-0 flex-col">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 