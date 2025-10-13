"use client";

import { Button } from "@/components/ai/ui/button";

import Link from "next/link";
import { ThreadSidebarInteractive } from "./thread-sidebar-interactive";
import { UserProfileSection } from "./user-profile-section";
import { useRef, useEffect } from "react";
import { AppLogo } from "@/components/ui/icons/svg-icons";
import { Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";

// Custom scrollbar styles with auto-hide functionality
const scrollbarStyles = `
  /* Webkit browsers (Chrome, Safari, Edge) */
  .sidebar-scroll-container::-webkit-scrollbar {
    width: 6px;
    transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    scroll-padding: 0;
    position: absolute;
    right: 0;
  }

  .sidebar-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-scroll-container::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.3);
    border-radius: 3px;
    transition: background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-scroll-container::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.5);
  }

  /* Firefox */
  .sidebar-scroll-container {
    scrollbar-width: thin;
    scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
  }

  /* Auto-hide scrollbar */
  .sidebar-scroll-container.scrollbar-hidden::-webkit-scrollbar {
    opacity: 0;
  }

  .sidebar-scroll-container.scrollbar-hidden {
    scrollbar-width: none;
  }

  /* Container setup */
  .sidebar-scroll-container {
    overflow-y: overlay;
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }

  /* Fallback for browsers that don't support overlay */
  @supports not (overflow-y: overlay) {
    .sidebar-scroll-container {
      overflow-y: auto;
    }
  }
`;

interface ThreadSidebarClientProps {
  preloadedThreads?: Preloaded<typeof api.threads.getUserThreadsPaginatedSafe>;
}

export function ThreadSidebarClient({
  preloadedThreads,
}: ThreadSidebarClientProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hideScrollbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle scrollbar auto-hide
  const handleScrollContainerMouseEnter = () => {
    if (hideScrollbarTimeoutRef.current) {
      clearTimeout(hideScrollbarTimeoutRef.current);
      hideScrollbarTimeoutRef.current = null;
    }

    if (scrollContainerRef.current) {
      scrollContainerRef.current.classList.remove("scrollbar-hidden");
    }
  };

  const handleScrollContainerMouseLeave = () => {
    if (scrollContainerRef.current) {
      // Hide scrollbar after 2 seconds
      hideScrollbarTimeoutRef.current = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.classList.add("scrollbar-hidden");
        }
      }, 2000);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideScrollbarTimeoutRef.current) {
        clearTimeout(hideScrollbarTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <style jsx global>
        {scrollbarStyles}
      </style>
      <div
        className="h-full w-full bg-background dark:bg-popover-main dark:backdrop-blur-sm border-r border-[#EAEAEA] dark:border-border flex flex-col"
      >
        {/* Header */}
        <div className="p-6 flex-shrink-0">
          <div className="flex items-center justify-center">
            <AppLogo className="h-8 text-foreground dark:text-white" />
          </div>
        </div>

        <div className="px-3 pb-3 flex-shrink-0">
          <div className="mb-3">
            <Link href="/chat">
              <Button size="lg" variant="outline" className="w-full dark:bg-[#111111] dark:border-border outline-none">
                Nuevo Chat
              </Button>
            </Link>
          </div>
          <input
            id="thread-search-input"
            type="text"
            placeholder="Buscar chats..."
            className="w-full px-2 py-1.5 text-xs border border-transparent rounded-sm bg-transparent text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-background focus:text-foreground focus:border-input/50 transition-all duration-200"
            readOnly
          />
        </div>

        {/* Thread List with Search - Interactive Part */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto sidebar-scroll-container scrollbar-hidden"
          onMouseEnter={handleScrollContainerMouseEnter}
          onMouseLeave={handleScrollContainerMouseLeave}
        >
          <ThreadSidebarInteractive preloadedThreads={preloadedThreads} />
        </div>

        {/* User Profile Section - Fixed at bottom */}
        <UserProfileSection />
      </div>
    </>
  );
}
