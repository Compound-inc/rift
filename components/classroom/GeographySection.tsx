"use client";

import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ai/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ai/ui/select";

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

type RegionalData = {
  id: string;
  region: string;
  studentCount: number;
  avgEngagement: number;
  topicsFocused: string;
  avgResponseTime: string;
  satisfaction: number;
};

const metrics: InsightMetric[] = [
  { label: "Total Coverage", value: "32", unit: "states", trend: "up", trendValue: "3", color: "green" },
  { label: "Active Regions", value: 12, trend: "neutral" },
  { label: "Avg. Engagement", value: "87.5", unit: "%", trend: "up", trendValue: "5%", color: "blue" },
  { label: "Regional Participation", value: "42", unit: "min", trend: "down", trendValue: "2%", color: "yellow" },
];

const detailedMetrics = [
  { label: "North", value: "91.2", unit: "%", trend: "up", trendValue: "8%", color: "green" },
  { label: "South", value: "85.5", unit: "%", trend: "neutral", trendValue: "0%", color: "blue" },
  { label: "East", value: "88.3", unit: "%", trend: "up", trendValue: "4%", color: "green" },
  { label: "West", value: "84.7", unit: "%", trend: "down", trendValue: "3%", color: "red" },
  { label: "Central", value: "89.2", unit: "%", trend: "up", trendValue: "6%", color: "green" },
];

type Grade = "all" | "1st" | "2nd" | "3rd" | "4th" | "5th" | "6th";

const regionalData: (RegionalData & { grade: Grade })[] = [
  {
    id: "1",
    region: "Mexico City",
    studentCount: 45,
    avgEngagement: 94.3,
    topicsFocused: "Microeconomics, Market Analysis",
    avgResponseTime: "2.1s",
    satisfaction: 4.8,
    grade: "1st"
  },
  {
    id: "2",
    region: "Guadalajara",
    studentCount: 32,
    avgEngagement: 89.7,
    topicsFocused: "Supply & Demand, Elasticity",
    avgResponseTime: "2.4s",
    satisfaction: 4.6,
    grade: "2nd"
  },
  {
    id: "3",
    region: "Monterrey",
    studentCount: 38,
    avgEngagement: 92.1,
    topicsFocused: "Market Equilibrium, Consumer Theory",
    avgResponseTime: "2.2s",
    satisfaction: 4.7,
    grade: "3rd"
  },
  {
    id: "4",
    region: "Puebla",
    studentCount: 28,
    avgEngagement: 86.5,
    topicsFocused: "Elasticity, Price Theory",
    avgResponseTime: "2.6s",
    satisfaction: 4.5,
    grade: "4th"
  },
  {
    id: "5",
    region: "Tijuana",
    studentCount: 25,
    avgEngagement: 88.9,
    topicsFocused: "International Trade, Markets",
    avgResponseTime: "2.3s",
    satisfaction: 4.7,
    grade: "5th"
  },
  {
    id: "6",
    region: "Cancún",
    studentCount: 22,
    avgEngagement: 85.2,
    topicsFocused: "Tourism Economics, Demand",
    avgResponseTime: "2.5s",
    satisfaction: 4.4,
    grade: "6th"
  },
  {
    id: "7",
    region: "Mérida",
    studentCount: 19,
    avgEngagement: 87.3,
    topicsFocused: "Regional Economics, Markets",
    avgResponseTime: "2.4s",
    satisfaction: 4.6,
    grade: "1st"
  }
];

// Basic coordinates for key Mexican cities present in our dataset
const cityCoordinates: Record<string, { longitude: number; latitude: number }> = {
  "Mexico City": { longitude: -99.1332, latitude: 19.4326 },
  "Guadalajara": { longitude: -103.3496, latitude: 20.6597 },
  "Monterrey": { longitude: -100.3161, latitude: 25.6866 },
  "Puebla": { longitude: -98.2063, latitude: 19.0414 },
  "Tijuana": { longitude: -117.0382, latitude: 32.5149 },
  "Cancún": { longitude: -86.8515, latitude: 21.1619 },
  "Mérida": { longitude: -89.5926, latitude: 20.9674 },
};

const insights: InsightItem[] = [
  {
    id: "1",
    type: "highlight",
    title: "Strong Performance in Metropolitan Areas",
    description: "Students from major metropolitan areas (Mexico City, Monterrey, Guadalajara) show 12% higher engagement rates compared to smaller regions.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "metro_avg", value: "92.1%" },
      { label: "regions", value: "3" }
    ],
    category: "Regional Performance"
  },
  {
    id: "2",
    type: "concern",
    title: "Lower Engagement in Western States",
    description: "Students from western states show 8% lower average engagement. Consider targeted support or regional study groups.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "engagement", value: "84.7%" },
      { label: "states", value: "5" }
    ],
    category: "Engagement"
  },
  {
    id: "3",
    type: "recommendation",
    title: "Opportunity for Regional Collaboration",
    description: "High-performing regions could mentor students from developing areas through peer learning programs.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "potential_pairs", value: "8" },
      { label: "expected_impact", value: "+15%" }
    ],
    category: "Collaboration"
  },
  {
    id: "4",
    type: "observation",
    title: "Coastal Regions Show Interest in Trade Topics",
    description: "Students from coastal areas demonstrate 35% higher engagement when international trade topics are discussed.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "engagement", value: "+35%" },
      { label: "coastal_regions", value: "4" }
    ],
    category: "Content Preference"
  },
  {
    id: "5",
    type: "highlight",
    title: "Consistent AI Usage Across All Regions",
    description: "AI tutoring tools show uniform adoption rates across all geographic regions, indicating successful platform accessibility.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "adoption_rate", value: "94%" },
      { label: "variance", value: "±3%" }
    ],
    category: "Technology Adoption"
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

// Column definitions for Regional Data DataTable
const regionalDataColumns: ColumnDef<RegionalData>[] = [
  {
    accessorKey: "region",
    header: "Region",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <MapPin className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">{row.getValue("region")}</span>
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
    accessorKey: "avgEngagement",
    header: "Engagement",
    cell: ({ row }) => {
      const engagement = row.getValue("avgEngagement") as number;
      const getEngagementColor = (value: number) => {
        if (value >= 90) return "text-green-600 dark:text-green-400";
        if (value >= 85) return "text-blue-600 dark:text-blue-400";
        return "text-yellow-600 dark:text-yellow-400";
      };
      
      return (
        <span className={cn("text-sm font-medium", getEngagementColor(engagement))}>
          {engagement}%
        </span>
      );
    },
  },
  {
    accessorKey: "topicsFocused",
    header: "Top Topics",
    cell: ({ row }) => (
      <div className="text-xs text-muted-foreground max-w-[200px] truncate">
        {row.getValue("topicsFocused")}
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

export function GeographySection() {
  const [selectedGrade, setSelectedGrade] = useState<Grade>("all");
  const MapboxMexicoGlobe = useMemo(
    () => dynamic(() => import("./MapboxMexicoGlobe"), { ssr: false }),
    []
  );

  const filteredRegionalData = useMemo(() => {
    if (selectedGrade === "all") return regionalData;
    return regionalData.filter((r) => r.grade === selectedGrade);
  }, [selectedGrade]);

  // Build hotspots from filtered data
  const hotspots = useMemo(() => {
    if (filteredRegionalData.length === 0) return [] as { id: string; name: string; longitude: number; latitude: number; value: number }[];
    const maxStudents = Math.max(...filteredRegionalData.map((r) => r.studentCount));
    return filteredRegionalData
      .filter((r) => cityCoordinates[r.region])
      .map((r) => {
        const coords = cityCoordinates[r.region];
        const value = maxStudents > 0 ? Math.round((r.studentCount / maxStudents) * 100) : 0;
        return {
          id: r.id,
          name: r.region,
          longitude: coords.longitude,
          latitude: coords.latitude,
          value,
        };
      });
  }, [filteredRegionalData]);

  const aggregatedMetrics = useMemo(() => {
    const data = filteredRegionalData;
    const totalStudents = data.reduce((sum, r) => sum + r.studentCount, 0);
    const avgEngagement = data.length
      ? (data.reduce((sum, r) => sum + r.avgEngagement, 0) / data.length).toFixed(1)
      : "0.0";
    return {
      totalStudents,
      avgEngagement,
      activeRegions: data.length,
    };
  }, [filteredRegionalData]);
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold mb-1">Geographic Insights</h1>
          <p className="text-sm text-muted-foreground">
            Regional distribution and performance analysis
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Grade</div>
          <Select value={selectedGrade} onValueChange={(v) => setSelectedGrade(v as Grade)}>
            <SelectTrigger>
              <SelectValue placeholder="All grades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="1st">1st</SelectItem>
              <SelectItem value="2nd">2nd</SelectItem>
              <SelectItem value="3rd">3rd</SelectItem>
              <SelectItem value="4th">4th</SelectItem>
              <SelectItem value="5th">5th</SelectItem>
              <SelectItem value="6th">6th</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span>Active regions: <span className="font-medium text-foreground">{aggregatedMetrics.activeRegions}</span></span>
            <span>Total students: <span className="font-medium text-foreground">{aggregatedMetrics.totalStudents}</span></span>
            <span>Avg engagement: <span className="font-medium text-foreground">{aggregatedMetrics.avgEngagement}%</span></span>
          </div>
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

        {/* Regional Performance Metrics */}
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

        {/* Map Section */}
        <div className="w-full pb-8">
          <MapboxMexicoGlobe height={700} hotspots={hotspots} />
        </div>

        {/* Regional Data Table */}
        <div className="space-y-4">
          <div className="pt-4">
            <h3 className="text-2xl font-semibold mb-1">Regional Performance Data</h3>
            <p className="text-sm text-muted-foreground">
              Detailed breakdown by region
            </p>
          </div>
          <DataTable
            columns={regionalDataColumns}
            data={filteredRegionalData}
          />
        </div>

        {/* Insights Timeline */}
        <div className="space-y-4">
          <div className="pt-4">
            <h3 className="text-2xl font-semibold mb-1">Geographic Insights Timeline</h3>
            <p className="text-sm text-muted-foreground">
              Regional trends and observations
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

