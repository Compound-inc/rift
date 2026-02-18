import { ClassroomSidebar } from "./ClassroomSidebar";
import { ClassroomMainClient } from "./ClassroomMainClient";

export default function ClassroomDashboard() {
  return (
    <div className="flex h-screen w-full bg-background">
      {/* Left Sidebar */}
      <div className="w-[230px] flex-shrink-0">
        <ClassroomSidebar />
      </div>

      {/* Main Content - Client Component */}
      <ClassroomMainClient />
    </div>
  );
}


