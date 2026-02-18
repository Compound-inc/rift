"use client";

import { useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  User,
  Clock,
  Target,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Brain,
  BookOpen,
  Award,
  Activity,
  ArrowLeft,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTable } from "@rift/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@rift/ui/button";

type StudentMetric = {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "green" | "red" | "yellow" | "blue";
};

type Student = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: "active" | "inactive" | "at-risk";
  engagementScore: number;
  questionsAsked: number;
  avgResponseTime: string;
  participationLevel: "high" | "medium" | "low";
  aiQuestions: number;
  homeworkCompleted: number;
  homeworkTotal: number;
  aiInteractions: number;
  peerInteractions: number;
  focusTime: string;
  distractions: number;
  grades: { subject: string; score: number; maxScore: number }[];
  notes: string[];
  strengths: string[];
  areasForImprovement: string[];
};

type AIMessage = {
  id: string;
  question: string;
  category: string;
  timestamp: string;
  messageCount: number;
  avgResponseTime: string;
  status: "resolved" | "ongoing";
};

// Mock AI message history for each student (for active class only)
const aiMessageHistory: Record<string, AIMessage[]> = {
  "1": [
    { id: "m1", question: "Can you explain how the equilibrium price is determined when supply and demand curves intersect?", category: "Concept Clarification", timestamp: "2 hours ago", messageCount: 8, avgResponseTime: "2.3s", status: "resolved" },
    { id: "m2", question: "I'm struggling with question 5 about elasticity in Problem Set 3", category: "Problem Solving", timestamp: "1 day ago", messageCount: 12, avgResponseTime: "3.1s", status: "resolved" },
    { id: "m3", question: "What's the difference between monopolistic competition and oligopoly?", category: "Concept Clarification", timestamp: "2 days ago", messageCount: 6, avgResponseTime: "2.8s", status: "resolved" },
  ],
  "2": [
    { id: "m4", question: "How do I use derivatives to find the marginal cost function in this problem?", category: "Problem Solving", timestamp: "3 hours ago", messageCount: 15, avgResponseTime: "4.2s", status: "resolved" },
    { id: "m5", question: "Need help with hypothesis testing problem for statistics homework", category: "Problem Solving", timestamp: "1 day ago", messageCount: 10, avgResponseTime: "3.5s", status: "ongoing" },
  ],
  "3": [
    { id: "m6", question: "I don't understand the concept of opportunity cost, can you explain with examples?", category: "Concept Clarification", timestamp: "5 hours ago", messageCount: 20, avgResponseTime: "5.1s", status: "ongoing" },
    { id: "m7", question: "Can you help me understand how to solve this linear equation step by step?", category: "Problem Solving", timestamp: "1 day ago", messageCount: 18, avgResponseTime: "4.8s", status: "ongoing" },
    { id: "m8", question: "What should I focus on for the midterm exam next week?", category: "Study Tips", timestamp: "3 days ago", messageCount: 7, avgResponseTime: "2.2s", status: "resolved" },
  ],
  "4": [
    { id: "m9", question: "Can you explore the relationship between fiscal and monetary policy in economic growth?", category: "Advanced Topics", timestamp: "1 hour ago", messageCount: 14, avgResponseTime: "3.9s", status: "resolved" },
    { id: "m10", question: "Help me work through this Nash equilibrium example from game theory", category: "Problem Solving", timestamp: "2 days ago", messageCount: 22, avgResponseTime: "4.5s", status: "resolved" },
  ],
  "5": [
    { id: "m11", question: "Could you explain the price discrimination concept from today's lecture?", category: "Concept Clarification", timestamp: "4 hours ago", messageCount: 5, avgResponseTime: "2.1s", status: "resolved" },
    { id: "m12", question: "I'm not sure how to approach homework question 2 about marginal utility", category: "Problem Solving", timestamp: "2 days ago", messageCount: 9, avgResponseTime: "3.2s", status: "resolved" },
  ],
  "6": [
    { id: "m13", question: "I missed the last two classes, can you help me understand what I missed?", category: "Catch Up", timestamp: "6 hours ago", messageCount: 25, avgResponseTime: "6.3s", status: "ongoing" },
  ],
};

const studentMetrics: StudentMetric[] = [
  { label: "Total Students", value: 24, trend: "neutral" },
  { label: "Active Students", value: 22, trend: "up", trendValue: "2", color: "green" },
  { label: "Avg. Engagement", value: "87.3", unit: "%", trend: "up", trendValue: "5%", color: "green" },
  { label: "At-Risk Students", value: 2, trend: "down", trendValue: "1", color: "red" },
];

const students: Student[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.johnson@university.edu",
    status: "active",
    engagementScore: 94,
    questionsAsked: 8,
    avgResponseTime: "2.3s",
    participationLevel: "high",
    aiQuestions: 12,
    homeworkCompleted: 5,
    homeworkTotal: 5,
    aiInteractions: 12,
    peerInteractions: 15,
    focusTime: "45m",
    distractions: 2,
    grades: [
      { subject: "Economics", score: 92, maxScore: 100 },
      { subject: "Math", score: 88, maxScore: 100 },
      { subject: "Statistics", score: 95, maxScore: 100 }
    ],
    notes: ["Excellent participation", "Helps other students"],
    strengths: ["Critical thinking", "Communication"],
    areasForImprovement: ["Time management"]
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "michael.chen@university.edu",
    status: "active",
    engagementScore: 88,
    questionsAsked: 5,
    avgResponseTime: "3.1s",
    participationLevel: "high",
    aiQuestions: 8,
    homeworkCompleted: 4,
    homeworkTotal: 5,
    aiInteractions: 8,
    peerInteractions: 12,
    focusTime: "38m",
    distractions: 4,
    grades: [
      { subject: "Economics", score: 85, maxScore: 100 },
      { subject: "Math", score: 92, maxScore: 100 },
      { subject: "Statistics", score: 78, maxScore: 100 }
    ],
    notes: ["Strong analytical skills"],
    strengths: ["Problem solving", "Technical skills"],
    areasForImprovement: ["Class participation"]
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    email: "emily.rodriguez@university.edu",
    status: "at-risk",
    engagementScore: 65,
    questionsAsked: 2,
    avgResponseTime: "4.2s",
    participationLevel: "low",
    aiQuestions: 3,
    homeworkCompleted: 2,
    homeworkTotal: 5,
    aiInteractions: 3,
    peerInteractions: 5,
    focusTime: "25m",
    distractions: 8,
    grades: [
      { subject: "Economics", score: 72, maxScore: 100 },
      { subject: "Math", score: 68, maxScore: 100 },
      { subject: "Statistics", score: 75, maxScore: 100 }
    ],
    notes: ["Needs additional support", "Struggling with concepts"],
    strengths: ["Creativity"],
    areasForImprovement: ["Focus", "Participation", "Homework completion"]
  },
  {
    id: "4",
    name: "David Kim",
    email: "david.kim@university.edu",
    status: "active",
    engagementScore: 91,
    questionsAsked: 6,
    avgResponseTime: "2.8s",
    participationLevel: "high",
    aiQuestions: 10,
    homeworkCompleted: 5,
    homeworkTotal: 5,
    aiInteractions: 10,
    peerInteractions: 18,
    focusTime: "52m",
    distractions: 1,
    grades: [
      { subject: "Economics", score: 89, maxScore: 100 },
      { subject: "Math", score: 94, maxScore: 100 },
      { subject: "Statistics", score: 91, maxScore: 100 }
    ],
    notes: ["Natural leader", "Peer mentor"],
    strengths: ["Leadership", "Collaboration", "Communication"],
    areasForImprovement: []
  },
  {
    id: "5",
    name: "Lisa Wang",
    email: "lisa.wang@university.edu",
    status: "active",
    engagementScore: 82,
    questionsAsked: 4,
    avgResponseTime: "3.5s",
    participationLevel: "medium",
    aiQuestions: 6,
    homeworkCompleted: 3,
    homeworkTotal: 5,
    aiInteractions: 6,
    peerInteractions: 9,
    focusTime: "35m",
    distractions: 5,
    grades: [
      { subject: "Economics", score: 78, maxScore: 100 },
      { subject: "Math", score: 82, maxScore: 100 },
      { subject: "Statistics", score: 85, maxScore: 100 }
    ],
    notes: ["Quiet but attentive"],
    strengths: ["Attention to detail"],
    areasForImprovement: ["Confidence", "Participation"]
  },
  {
    id: "6",
    name: "Alex Thompson",
    email: "alex.thompson@university.edu",
    status: "inactive",
    engagementScore: 45,
    questionsAsked: 1,
    avgResponseTime: "6.1s",
    participationLevel: "low",
    aiQuestions: 2,
    homeworkCompleted: 1,
    homeworkTotal: 5,
    aiInteractions: 2,
    peerInteractions: 3,
    focusTime: "15m",
    distractions: 12,
    grades: [
      { subject: "Economics", score: 58, maxScore: 100 },
      { subject: "Math", score: 62, maxScore: 100 },
      { subject: "Statistics", score: 55, maxScore: 100 }
    ],
    notes: ["Frequent absences", "Technical issues"],
    strengths: ["Technical aptitude"],
    areasForImprovement: ["Attendance", "Engagement", "Focus"]
  }
];

const TrendIcon = ({ trend }: { trend?: "up" | "down" | "neutral" }) => {
  if (trend === "up") return <TrendingUp className="h-3 w-3" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
};

const StatusBadge = ({ status }: { status: Student["status"] }) => {
  const getStatusStyle = (status: Student["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
      case "inactive":
        return "bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-400";
      case "at-risk":
        return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
      default:
        return "bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-400";
    }
  };

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", getStatusStyle(status))}>
      {status === "at-risk" ? "At Risk" : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const ParticipationBadge = ({ level }: { level: Student["participationLevel"] }) => {
  const getLevelStyle = (level: Student["participationLevel"]) => {
    switch (level) {
      case "high":
        return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
      case "medium":
        return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
      case "low":
        return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
      default:
        return "bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-400";
    }
  };

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", getLevelStyle(level))}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
};

// Column definitions for AI Messages DataTable
const aiMessagesColumns: ColumnDef<AIMessage>[] = [
  {
    accessorKey: "question",
    header: "Question",
    cell: ({ row }) => (
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {row.getValue("question")}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => {
      const category = row.getValue("category") as string;
      const getCategoryStyle = (category: string) => {
        switch (category) {
          case "Concept Clarification":
            return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
          case "Problem Solving":
            return "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400";
          case "Advanced Topics":
            return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
          case "Study Tips":
            return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
          case "Catch Up":
            return "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400";
          default:
            return "bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-400";
        }
      };
      
      return (
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs", getCategoryStyle(category))}>
          {category}
        </span>
      );
    },
  },
  {
    accessorKey: "messageCount",
    header: "Messages",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <MessageSquare className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">{row.getValue("messageCount")}</span>
      </div>
    ),
  },
  {
    accessorKey: "avgResponseTime",
    header: "Response Time",
    cell: ({ row }) => (
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {row.getValue("avgResponseTime")}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <div className="flex items-center gap-1">
          {status === "resolved" ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Clock className="h-4 w-4 text-yellow-600" />
          )}
          <span className="text-sm capitalize">{status}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "timestamp",
    header: "Time",
    cell: ({ row }) => (
      <div className="text-xs text-muted-foreground">
        {row.getValue("timestamp")}
      </div>
    ),
  },
];

// Detailed Student View Component
function StudentDetailView({ student, onBack }: { student: Student; onBack: () => void }) {
  const messages = aiMessageHistory[student.id] || [];
  
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-8 py-6 space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Students
          </Button>
          <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
            Active Class Session Analytics
          </div>
        </div>

        {/* Student Profile Header */}
        <div className="flex items-start gap-6 p-6 border rounded-lg bg-card">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <User className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-semibold">{student.name}</h2>
                <StatusBadge status={student.status} />
              </div>
              <p className="text-sm text-muted-foreground">{student.email}</p>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Engagement</div>
                <div className="text-2xl font-bold">{student.engagementScore}%</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Participation</div>
                <div className="text-2xl font-bold"><ParticipationBadge level={student.participationLevel} /></div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Questions Asked</div>
                <div className="text-2xl font-bold">{student.questionsAsked}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Avg Response Time</div>
                <div className="text-2xl font-bold">{student.avgResponseTime}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Academic Performance */}
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Academic Performance</h3>
            </div>
            
            <div className="space-y-3">
              {student.grades.map((grade) => (
                <div key={grade.subject} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{grade.subject}</span>
                    <span className="text-muted-foreground">
                      {grade.score}/{grade.maxScore} ({Math.round((grade.score / grade.maxScore) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full",
                        (grade.score / grade.maxScore) * 100 >= 85 ? "bg-green-500" : 
                        (grade.score / grade.maxScore) * 100 >= 70 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${(grade.score / grade.maxScore) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Homework Completed</span>
                <span className="text-sm font-medium">{student.homeworkCompleted}/{student.homeworkTotal}</span>
              </div>
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Engagement Metrics</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">AI Interactions</span>
                </div>
                <span className="font-medium">{student.aiInteractions}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Peer Interactions</span>
                </div>
                <span className="font-medium">{student.peerInteractions}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Focus Time</span>
                </div>
                <span className="font-medium">{student.focusTime}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Distractions</span>
                </div>
                <span className="font-medium">{student.distractions}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Strengths and Areas for Improvement */}
        <div className="grid grid-cols-2 gap-6">
          <div className="border rounded-lg p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Strengths</h3>
            </div>
            <ul className="space-y-2">
              {student.strengths.map((strength, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border rounded-lg p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-yellow-600" />
              <h3 className="text-lg font-semibold">Areas for Improvement</h3>
            </div>
            {student.areasForImprovement.length > 0 ? (
              <ul className="space-y-2">
                {student.areasForImprovement.map((area, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No areas for improvement identified</p>
            )}
          </div>
        </div>

        {/* AI Message History */}
        <div className="space-y-4">
          <div className="pt-4">
            <h3 className="text-2xl font-semibold mb-1">AI Message History</h3>
            <p className="text-sm text-muted-foreground">
              Student&apos;s AI interactions during the active class session
            </p>
          </div>
          {messages.length > 0 ? (
            <DataTable
              columns={aiMessagesColumns}
              data={messages}
              onRowClick={(message) => {
                // TODO: Navigate to full chat - not implemented yet
                console.log('Navigate to chat:', message.id);
              }}
            />
          ) : (
            <div className="border rounded-lg p-12 text-center">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No AI message history available for this class session</p>
            </div>
          )}
        </div>

        {/* Teacher Notes */}
        {student.notes.length > 0 && (
          <div className="border rounded-lg p-6 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Teacher Notes</h3>
            </div>
            <ul className="space-y-2">
              {student.notes.map((note, i) => (
                <li key={i} className="text-sm text-muted-foreground">• {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// Column definitions for Students DataTable
const studentsColumns: ColumnDef<Student>[] = [
  {
    accessorKey: "name",
    header: "Student",
    cell: ({ row }) => {
      const student = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{student.name}</div>
            <div className="text-xs text-muted-foreground">{student.email}</div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "engagementScore",
    header: "Engagement",
    cell: ({ row }) => {
      const score = row.getValue("engagementScore") as number;
      const getScoreColor = (score: number) => {
        if (score >= 90) return "text-green-600";
        if (score >= 70) return "text-yellow-600";
        return "text-red-600";
      };
      
      return (
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{score}%</div>
          <div className="w-16 bg-muted rounded-full h-2">
            <div 
              className={cn("h-2 rounded-full", getScoreColor(score))}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "participationLevel",
    header: "Participation",
    cell: ({ row }) => <ParticipationBadge level={row.getValue("participationLevel")} />,
  },
  {
    accessorKey: "questionsAsked",
    header: "Questions",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <MessageSquare className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">{row.getValue("questionsAsked")}</span>
      </div>
    ),
  },
  {
    accessorKey: "aiQuestions",
    header: "AI Questions",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Brain className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">{row.getValue("aiQuestions")}</span>
      </div>
    ),
  },
  {
    accessorKey: "homeworkCompleted",
    header: "Homework",
    cell: ({ row }) => {
      const student = row.original;
      const completed = student.homeworkCompleted;
      const total = student.homeworkTotal;
      const percentage = Math.round((completed / total) * 100);
      
      return (
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{completed}/{total}</div>
          <div className="w-16 bg-muted rounded-full h-2">
            <div 
              className={cn(
                "h-2 rounded-full",
                percentage >= 80 ? "bg-green-500" : percentage >= 60 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "grades",
    header: "Grades",
    cell: ({ row }) => {
      const grades = row.getValue("grades") as { subject: string; score: number; maxScore: number }[];
      const avgGrade = Math.round(grades.reduce((sum, grade) => sum + (grade.score / grade.maxScore) * 100, 0) / grades.length);
      
      return (
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{avgGrade}%</div>
          <div className="w-16 bg-muted rounded-full h-2">
            <div 
              className={cn(
                "h-2 rounded-full",
                avgGrade >= 85 ? "bg-green-500" : avgGrade >= 70 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${avgGrade}%` }}
            />
          </div>
        </div>
      );
    },
  },
];

export function StudentsSection() {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // If a student is selected, show the detailed view
  if (selectedStudent) {
    return (
      <StudentDetailView 
        student={selectedStudent} 
        onBack={() => setSelectedStudent(null)} 
      />
    );
  }

  // Otherwise, show the students list
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold mb-1">Student Performance</h1>
          <p className="text-sm text-muted-foreground">
            Individual student metrics and engagement tracking for the active class session
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-4 gap-4">
          {studentMetrics.map((metric) => (
            <div
              key={metric.label}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{metric.label}</span>
                {metric.trend && (
                  <div
                    className={cn(
                      "flex items-center gap-1 text-xs rounded px-1.5 py-0.5",
                      metric.color === "green" && "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
                      metric.color === "red" && "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
                      metric.color === "yellow" && "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
                      metric.color === "blue" && "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
                      !metric.color && "bg-muted text-muted-foreground"
                    )}
                  >
                    <TrendIcon trend={metric.trend} />
                    {metric.trendValue && <span>{metric.trendValue}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{metric.value}</span>
                {metric.unit && (
                  <span className="text-lg text-muted-foreground">{metric.unit}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Students Table */}
        <div className="space-y-4">
          <div className="pt-4">
            <h3 className="text-2xl font-semibold mb-1">Student Details</h3>
            <p className="text-sm text-muted-foreground">
              Click on a student to view detailed analytics and AI message history
            </p>
          </div>
          <DataTable
            columns={studentsColumns}
            data={students}
            onRowClick={(row) => setSelectedStudent(row)}
          />
        </div>
      </div>
    </div>
  );
}
