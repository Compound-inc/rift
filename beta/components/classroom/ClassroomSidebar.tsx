import { ClassroomSidebarClient } from "./ClassroomSidebarClient";
import { UserProfileSection } from "@/components/sidebar/user-profile-section";

export function ClassroomSidebar() {
  return (
    <div className="h-full w-full bg-background border-r flex flex-col" style={{ borderColor: "#EAEAEA" }}>
      {/* Interactive Sidebar Content */}
      <ClassroomSidebarClient />
      
      {/* User Profile Section - Fixed at bottom */}
      <UserProfileSection />
    </div>
  );
}
