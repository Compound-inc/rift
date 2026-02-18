"use client";

import { useState } from "react";
import { Button } from "@rift/ui/button";
import {
  MoreVertical,
  Settings,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@rift/ui/breadcrumb";

type ActiveSection = "replay" | "homework" | "students" | "insight" | "geography";

interface ClassroomHeaderClientProps {
  onSectionChange: (section: ActiveSection) => void;
  activeSection: ActiveSection;
}

export function ClassroomHeaderClient({ onSectionChange, activeSection }: ClassroomHeaderClientProps) {
  return (
    <div className="flex items-center justify-between border-b px-6 py-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/classroom">Classroom</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/classroom/economia">Economía</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Clase 2021</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-2">
        <Button 
          variant={activeSection === "replay" ? "default" : "ghost"} 
          size="sm"
          onClick={() => onSectionChange("replay")}
        >
          Replay
        </Button>
        <Button 
          variant={activeSection === "homework" ? "default" : "ghost"} 
          size="sm"
          onClick={() => onSectionChange("homework")}
        >
          Homework
        </Button>
        <Button 
          variant={activeSection === "students" ? "default" : "ghost"} 
          size="sm"
          onClick={() => onSectionChange("students")}
        >
          students
        </Button>
        <Button 
          variant={activeSection === "insight" ? "default" : "ghost"} 
          size="sm"
          onClick={() => onSectionChange("insight")}
        >
          Insight
        </Button>
        <Button 
          variant={activeSection === "geography" ? "default" : "ghost"} 
          size="sm"
          onClick={() => onSectionChange("geography")}
        >
          Geography
        </Button>
        <button className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted">
          <Settings className="h-4 w-4" />
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
