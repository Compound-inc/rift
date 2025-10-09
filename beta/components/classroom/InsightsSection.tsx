"use client";

import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ai/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { EngagementChart } from "./EngagementChart";

type InsightMetric = {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "green" | "red" | "yellow" | "blue";
};

type InsightItem = {
  id: string;
  type: "observation" | "recommendation" | "highlight" | "concern";
  title: string;
  description: string;
  timestamp: string;
  metrics?: { label: string; value: string }[];
  category: string;
};

type AIQuestion = {
  id: string;
  prompt: string;
  studentCount: number;
  category: string;
  avgResponseTime: string;
  satisfaction: number;
};

const metrics: InsightMetric[] = [
  { label: "Engagement Score", value: "94.3", unit: "%", trend: "up", trendValue: "12%", color: "green" },
  { label: "Key Topics", value: 8, trend: "neutral" },
  { label: "Questions Asked", value: 23, trend: "up", trendValue: "8%", color: "blue" },
  { label: "Avg. Focus Time", value: "42", unit: "min", trend: "down", trendValue: "5%", color: "yellow" },
];

const detailedMetrics = [
  { label: "P50", value: "8.2", unit: "min", trend: "up", trendValue: "15%", color: "red" },
  { label: "P75", value: "12.5", unit: "min", trend: "neutral", trendValue: "0%", color: "blue" },
  { label: "P90", value: "18.3", unit: "min", trend: "down", trendValue: "8%", color: "green" },
  { label: "P95", value: "24.7", unit: "min", trend: "up", trendValue: "3%", color: "yellow" },
  { label: "P99", value: "35.2", unit: "min", trend: "down", trendValue: "12%", color: "green" },
];

const aiQuestions: AIQuestion[] = [
  {
    id: "1",
    prompt: "Can you explain the difference between price elasticity of demand and income elasticity?",
    studentCount: 8,
    category: "Concept Clarification",
    avgResponseTime: "2.3s",
    satisfaction: 4.8
  },
  {
    id: "2",
    prompt: "How do I calculate the equilibrium price when given supply and demand equations?",
    studentCount: 12,
    category: "Problem Solving",
    avgResponseTime: "3.1s",
    satisfaction: 4.6
  },
  {
    id: "3",
    prompt: "What are some real-world examples of perfectly inelastic demand?",
    studentCount: 6,
    category: "Application",
    avgResponseTime: "2.8s",
    satisfaction: 4.9
  },
  {
    id: "4",
    prompt: "Can you help me understand the concept of consumer surplus with a graph?",
    studentCount: 9,
    category: "Visual Learning",
    avgResponseTime: "4.2s",
    satisfaction: 4.7
  },
  {
    id: "5",
    prompt: "What happens to market equilibrium when there's a shift in supply?",
    studentCount: 11,
    category: "Concept Clarification",
    avgResponseTime: "2.9s",
    satisfaction: 4.5
  },
  {
    id: "7",
    prompt: "Can you provide a step-by-step solution to this elasticity problem?",
    studentCount: 14,
    category: "Problem Solving",
    avgResponseTime: "3.4s",
    satisfaction: 4.6
  },
  {
    id: "8",
    prompt: "What's the difference between normal and inferior goods?",
    studentCount: 7,
    category: "Concept Clarification",
    avgResponseTime: "2.1s",
    satisfaction: 4.9
  }
];

const insights: InsightItem[] = [
  {
    id: "1",
    type: "highlight",
    title: "Strong Understanding of Core Concepts",
    description: "Students demonstrated excellent comprehension during the discussion on supply and demand equilibrium, with 89% providing accurate responses.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "accuracy", value: "89%" },
      { label: "participation", value: "high" }
    ],
    category: "Comprehension"
  },
  {
    id: "2",
    type: "concern",
    title: "Declining Engagement in Mid-Session",
    description: "Notable drop in interaction between minutes 15-25. Consider adding interactive elements or break points in future sessions.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "segment", value: "15-25 min" },
      { label: "engagement", value: "-35%" },
      { label: "questions", value: "2" }
    ],
    category: "Engagement"
  },
  {
    id: "3",
    type: "recommendation",
    title: "Opportunity for Deeper Dive",
    description: "Multiple students requested more examples on elasticity calculations. Consider dedicating next session's first 10 minutes to this topic.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "requests", value: "7" },
      { label: "topic", value: "elasticity" }
    ],
    category: "Content"
  },
  {
    id: "4",
    type: "observation",
    title: "Effective Use of Visual Aids",
    description: "Graph demonstrations correlated with 40% increase in student questions and active participation during those segments.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "engagement", value: "+40%" },
      { label: "visual_segments", value: "3" }
    ],
    category: "Teaching Method"
  },
  {
    id: "5",
    type: "highlight",
    title: "Peer Learning Observed",
    description: "Students initiated collaborative problem-solving without prompting during the market equilibrium exercise.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "peer_interactions", value: "12" },
      { label: "spontaneous", value: "yes" }
    ],
    category: "Collaboration"
  },
];

const TrendIcon = ({ trend }: { trend?: "up" | "down" | "neutral" }) => {
  if (trend === "up") return <TrendingUp className="h-3 w-3" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
};

const InsightIcon = ({ type }: { type: InsightItem["type"] }) => {
  switch (type) {
    case "highlight":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "concern":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case "recommendation":
      return <Lightbulb className="h-5 w-5 text-yellow-500" />;
    case "observation":
      return <MessageSquare className="h-5 w-5 text-blue-500" />;
  }
};

// Column definitions for AI Questions DataTable
const aiQuestionsColumns: ColumnDef<AIQuestion>[] = [
  {
    accessorKey: "prompt",
    header: "Question",
    cell: ({ row }) => (
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {row.getValue("prompt")}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "studentCount",
    header: "Students",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Users className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">{row.getValue("studentCount")}</span>
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
          case "Application":
            return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
          case "Visual Learning":
            return "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400";
          case "Advanced Topics":
            return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
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
    accessorKey: "satisfaction",
    header: "Satisfaction",
    cell: ({ row }) => {
      const satisfaction = row.getValue("satisfaction") as number;
      return (
        <div className="flex items-center gap-1">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-sm",
                  i < Math.floor(satisfaction)
                    ? "bg-yellow-400"
                    : "bg-muted"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-1">
            {satisfaction}
          </span>
        </div>
      );
    },
  },
];

export function InsightsSection() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold mb-1">Class Insights</h1>
          <p className="text-sm text-muted-foreground">
            AI-generated analysis of class performance and engagement
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-4 gap-4">
          {metrics.map((metric) => (
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

        {/* Detailed Percentile Metrics */}
        <div className="grid grid-cols-5 gap-3">
          {detailedMetrics.map((metric) => (
            <div
              key={metric.label}
              className="border rounded-lg p-3 relative overflow-hidden"
            >
              <div
                className={cn(
                  "absolute top-0 right-0 px-2 py-0.5 text-xs rounded-bl",
                  metric.color === "green" && "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
                  metric.color === "red" && "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
                  metric.color === "yellow" && "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
                  metric.color === "blue" && "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                )}
              >
                {metric.trend === "up" && "↑"}
                {metric.trend === "down" && "↓"}
                {metric.trendValue}
              </div>
              <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-semibold">{metric.value}</span>
                <span className="text-xs text-muted-foreground">{metric.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Combined Engagement & Activity Chart */}
        <EngagementChart />

        {/* AI Questions Section */}
        <div className="space-y-4">
          <div className="pt-4">
            <h3 className="text-2xl font-semibold mb-1">Most Asked Questions to AI</h3>
            <p className="text-sm text-muted-foreground">
              Student interactions with AI during class
            </p>
          </div>
          <DataTable
            columns={aiQuestionsColumns}
            data={aiQuestions}
          />
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <div className="pt-4">
            <h3 className="text-2xl font-semibold mb-1">AI-Generated Insights Timeline</h3>
            <p className="text-sm text-muted-foreground">
              What&apos;s happening in your class
            </p>
          </div>
          <div className="border rounded-lg">
            <div className="divide-y">
            <div className="grid grid-cols-[140px_1fr_200px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
              <div>Type</div>
              <div>Insights</div>
              <div>Timestamp</div>
            </div>
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="grid grid-cols-[140px_1fr_200px] gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <InsightIcon type={insight.type} />
                  <span className="text-sm capitalize">{insight.type}</span>
                </div>
                <div className="space-y-1">
                  <div className="font-medium text-sm">{insight.title}</div>
                  <div className="text-xs text-muted-foreground">{insight.description}</div>
                  {insight.metrics && insight.metrics.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {insight.metrics.map((metric) => (
                        <span
                          key={metric.label}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs"
                        >
                          <span className="text-muted-foreground">{metric.label}</span>
                          <span className="font-medium">{metric.value}</span>
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs">
                        <span className="text-muted-foreground">category</span>
                        <span className="font-medium">{insight.category}</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex items-start">
                  {insight.timestamp}
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>

      </div>
    </div>
  );
}


