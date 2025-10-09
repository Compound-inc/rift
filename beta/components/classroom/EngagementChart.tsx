"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Sample data representing class session timeline
const chartData = [
  { time: "0-5", engagement: 85 },
  { time: "5-10", engagement: 92 },
  { time: "10-15", engagement: 88 },
  { time: "15-20", engagement: 65 },
  { time: "20-25", engagement: 58 },
  { time: "25-30", engagement: 75 },
  { time: "30-35", engagement: 82 },
  { time: "35-40", engagement: 88 },
  { time: "40-45", engagement: 90 },
  { time: "45-50", engagement: 85 },
];

// Hot topics data based on question counts
const topicsData = [
  { name: "Elasticity Calculations", questions: 28, color: "#3b82f6" },
  { name: "Supply & Demand Curves", questions: 22, color: "#8b5cf6" },
  { name: "Market Equilibrium", questions: 19, color: "#10b981" },
  { name: "Consumer Surplus", questions: 15, color: "#f59e0b" },
  { name: "Price Mechanisms", questions: 12, color: "#ef4444" },
  { name: "Other Topics", questions: 8, color: "#6b7280" },
];

const COLORS = topicsData.map(t => t.color);

interface CustomTooltipProps {
  active?: boolean;
  payload?: unknown[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const engagement = payload[0]?.value;
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">{label} min</p>
        <p className="text-lg font-semibold text-blue-500">{engagement}%</p>
        <p className="text-xs text-muted-foreground mt-1">Engagement</p>
      </div>
    );
  }
  return null;
};

interface PieTooltipProps {
  active?: boolean;
  payload?: unknown[];
}

const PieTooltip = ({ active, payload }: PieTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium mb-1">{data.name}</p>
        <p className="text-lg font-semibold" style={{ color: data.payload.color }}>
          {data.value} questions
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {((data.value / topicsData.reduce((sum, t) => sum + t.questions, 0)) * 100).toFixed(1)}% of total
        </p>
      </div>
    );
  }
  return null;
};

export function EngagementChart() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Engagement Over Time Chart */}
      <div className="border rounded-lg p-4">
        <div className="mb-4">
          <h3 className="text-sm font-medium">Engagement Over Time</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Student engagement levels throughout the class session
          </p>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.2} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Engagement area chart */}
            <Area
              type="monotone"
              dataKey="engagement"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="url(#engagementGradient)"
              name="Engagement"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Summary statistics */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Average</div>
            <div className="text-lg font-semibold text-blue-500">80.8%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Highest</div>
            <div className="text-lg font-semibold text-green-500">92%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Lowest</div>
            <div className="text-lg font-semibold text-red-500">58%</div>
          </div>
        </div>
      </div>

      {/* Hot Topics Pie Chart */}
      <div className="border rounded-lg p-4">
        <div className="mb-4">
          <h3 className="text-sm font-medium">Most Hot Topics</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Based on questions asked to teacher and AI
          </p>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={topicsData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={100}
              fill="#8884d8"
              dataKey="questions"
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            >
              {topicsData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Topics Legend */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t">
          {topicsData.map((topic, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: topic.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{topic.name}</p>
                <p className="text-xs text-muted-foreground">{topic.questions} questions</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

