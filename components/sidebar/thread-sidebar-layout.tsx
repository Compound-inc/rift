import { ThreadSidebarHeader } from "./thread-sidebar-header";
import { ThreadSidebarInteractive } from "../thread-sidebar-interactive";
import { UserProfileSection } from "./user-profile-section-server";
import { Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";

interface ThreadSidebarLayoutProps {
  preloadedThreads?: Preloaded<typeof api.threads.getUserThreadsPaginatedSafe>;
}

export function ThreadSidebarLayout({ preloadedThreads }: ThreadSidebarLayoutProps) {
  return (
    <div className="h-full w-full bg-background dark:bg-popover-main dark:backdrop-blur-sm border-r border-[#EAEAEA] dark:border-border flex flex-col">
      {/* Header and Search */}
      <ThreadSidebarHeader />

      {/* Thread List with Search */}
      <div className="flex-1 overflow-y-auto sidebar-scroll-container scrollbar-hidden">
        <ThreadSidebarInteractive preloadedThreads={preloadedThreads} />
      </div>

      {/* User Profile Section */}
      <UserProfileSection />
    </div>
  );
}
