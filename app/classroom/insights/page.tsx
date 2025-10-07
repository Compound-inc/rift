"use client";

import { ClassroomSidebar } from "@/components/classroom/ClassroomSidebar";
import { GeographySection } from "@/components/classroom/GeographySection";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ai/ui/breadcrumb";

export default function ClassroomInsightsPage() {
  return (
    <div className="flex h-screen w-full bg-background">
      <div className="w-[230px] flex-shrink-0">
        <ClassroomSidebar />
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/classroom">Classroom</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Insights</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <GeographySection />
        </div>
      </div>
    </div>
  );
}



