"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Users,
  ListMusic,
  BookOpen,
  TrendingUp,
  BarChart3,
  Search,
  HelpCircle,
} from "lucide-react";
import { AppLogo } from "@/components/ui/icons/svg-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

const navItems = [
  { icon: Calendar, label: "Calendar" },
  { icon: Users, label: "Meetings" },
  { icon: ListMusic, label: "Playlist" },
  { icon: BookOpen, label: "Stories" },
  { icon: TrendingUp, label: "Deals" },
  { icon: BarChart3, label: "Insights", href: "/settings/insights" },
];

export function ClassroomSidebarClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hideScrollbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

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
        <div className="p-6 flex-shrink-0">
          <div className="flex items-center justify-center">
            <AppLogo className="h-8 text-foreground" />
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Navigation */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto sidebar-scroll-container scrollbar-hidden px-3"
          onMouseEnter={handleScrollContainerMouseEnter}
          onMouseLeave={handleScrollContainerMouseLeave}
        >
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = item.href ? pathname === item.href : false;
              const content = (
                <div
                  className={cn(
                    "group relative flex w-full items-center gap-2 p-2.5 mb-1 rounded-lg cursor-pointer transition-colors overflow-hidden",
                    "hover:bg-hover hover:text-accent-foreground",
                    isActive && "bg-hover text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              );
              return item.href ? (
                <Link key={item.label} href={item.href} className="block">
                  {content}
                </Link>
              ) : (
                <div key={item.label}>{content}</div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="border-t flex-shrink-0 px-3 py-2">
          <button className="flex w-full items-center gap-2 p-2.5 mb-1 rounded-lg text-sm text-muted-foreground transition-colors hover:bg-hover hover:text-accent-foreground">
            <HelpCircle className="h-4 w-4" />
            <span className="font-medium">Help center</span>
          </button>
        </div>
      </div>
    </>
  );
}
