"use client";

import { Button } from "@/components/ai/ui/button";

import Link from "next/link";
import { ThreadSidebarWorking } from "./thread-sidebar-working";
import { UserProfileSection } from "./user-profile-section";
import { useRef, useEffect } from "react";
import Image from "next/image";
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
        className="h-full w-full bg-background border-r flex flex-col"
        style={{ borderColor: "#EAEAEA" }}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Chats</h2>
            <Link href="/">
              <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                <Image src="/plus.svg" alt="Plus" width={16} height={16} />
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative px-4 py-3 flex-shrink-0 border-b border-border">
          <input
            id="thread-search-input"
            type="text"
            placeholder="Search chats..."
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
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
          <ThreadSidebarWorking preloadedThreads={preloadedThreads} />
        </div>

        {/* User Profile Section - Fixed at bottom */}
        <UserProfileSection />
      </div>
    </>
  );
}
