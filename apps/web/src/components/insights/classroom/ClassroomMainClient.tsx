"use client";

import { useState } from "react";
import { ClassroomHeaderClient } from "./ClassroomHeaderClient";
import { ClassroomContentClient } from "./ClassroomContentClient";

type ActiveSection = "replay" | "homework" | "students" | "insight" | "geography";

export function ClassroomMainClient() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("replay");

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <ClassroomHeaderClient 
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      {/* Content Area */}
      <ClassroomContentClient activeSection={activeSection} />
    </div>
  );
}
