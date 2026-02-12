import { ThreadSidebarHeader } from "./thread-sidebar-header";
import { ThreadSidebarInteractive } from "../thread-sidebar-interactive";
import { UserProfileSection } from "./user-profile-section";

export function ThreadSidebarLayout() {
  return (
    <div className="h-full w-full bg-transparent flex flex-col">
      {/* Header and Search */}
      <ThreadSidebarHeader />

      {/* Thread List with Search */}
      <div className="flex-1 min-h-0 relative">
        <ThreadSidebarInteractive />
      </div>

      {/* User Profile Section */}
      <UserProfileSection />
    </div>
  );
}
