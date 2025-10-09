"use client";

import { useState } from "react";
import { Button } from "@/components/ai/ui/button";
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
} from "@/components/ai/ui/breadcrumb";
import { ClassroomSidebar } from "./ClassroomSidebar";
import { VideoPlayer } from "./VideoPlayer";
import { OverviewSection } from "./OverviewSection";
import { TranscriptSidebar } from "./TranscriptSidebar";
import { InsightsSection } from "./InsightsSection";
import { StudentsSection } from "./StudentsSection";
import { GeographySection } from "./GeographySection";

type TranscriptMessage = {
  id: string;
  speaker: string;
  timestamp: string;
  text: string;
  highlight?: boolean;
};

type Segment = {
  label: string;
  from: string;
  to?: string;
};

const transcriptMessages: TranscriptMessage[] = [
  {
    id: "1",
    speaker: "Nolan",
    timestamp: "0:00-0:00",
    text: "Hey John, thanks for jumping on. I wanted to walk through some of the feedback we've been hearing and get your thoughts — especially on the new timeline editor.",
  },
  {
    id: "2",
    speaker: "John",
    timestamp: "0:00-0:50",
    text: "Hey John, thanks for jumping on. I wanted to walk through some of the feedback we've been hearing and get your thoughts — especially on the new timeline editor.",
  },
  {
    id: "3",
    speaker: "Nolan",
    timestamp: "0:50-1:30",
    text: "That's helpful. Yeah, we've heard that from 2 other users. We're thinking of adding a clearer \"in-point/out-point\" marker with haptic feedback or maybe a snap-to-timestamp behavior.",
    highlight: true,
  },
  {
    id: "4",
    speaker: "John",
    timestamp: "1:30-2:20",
    text: "Snap-to sounds like a good idea. Also, I'd surface the keyboard shortcuts earlier in the flow. I only found out about them halfway through editing.",
  },
  {
    id: "5",
    speaker: "Nolan",
    timestamp: "2:20-3:30",
    text: "Snap-to sounds like a good idea. Also, I'd surface the keyboard shortcuts earlier in the flow. I only found out about them halfway through editing.",
  },
];

const keyPoints: Segment[] = [
  { label: "Introduction & Context Setting", from: "0:00-2:30" },
  { label: "Design Feedback", from: "2:30-6:00" },
  { label: "Feature-Specific Discussion", from: "6:00-10:00" },
];


export default function ClassroomDashboard() {
  const [currentTime] = useState("02:24");
  const totalTime = "12:56";
  const currentSegment = "1/5";
  const segmentName = "Introduction";
  const [activeSection, setActiveSection] = useState<"replay" | "homework" | "students" | "insight" | "geography">("replay");

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Left Sidebar */}
      <div className="w-[230px] flex-shrink-0">
        <ClassroomSidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
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
              onClick={() => setActiveSection("replay")}
            >
              Replay
            </Button>
            <Button 
              variant={activeSection === "homework" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setActiveSection("homework")}
            >
              Homework
            </Button>
            <Button 
              variant={activeSection === "students" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setActiveSection("students")}
            >
              students
            </Button>
            <Button 
              variant={activeSection === "insight" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setActiveSection("insight")}
            >
              Insight
            </Button>
            <Button 
              variant={activeSection === "geography" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setActiveSection("geography")}
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

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {activeSection === "replay" ? (
            <>
              {/* Video and Details */}
              <div className="flex flex-1 flex-col overflow-y-auto px-4">
                <div className="p-6">
                  {/* Recorded Meeting Section */}
                  <VideoPlayer
                    currentTime={currentTime}
                    totalTime={totalTime}
                    currentSegment={currentSegment}
                    segmentName={segmentName}
                    subtitle="That's helpful. Yeah, we've heard that from 2 other users."
                    progress={18.7}
                  />

                  {/* Overview Section */}
                  <OverviewSection keyPoints={keyPoints} />
                </div>
              </div>

              {/* Right Sidebar - Transcript */}
              <TranscriptSidebar messages={transcriptMessages} />
            </>
          ) : activeSection === "insight" ? (
            <InsightsSection />
          ) : activeSection === "students" ? (
            <StudentsSection />
          ) : activeSection === "geography" ? (
            <GeographySection />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-muted-foreground mb-2 capitalize">{activeSection}</h2>
                <p className="text-muted-foreground">Coming soon...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


