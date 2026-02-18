"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rift/ui/select";
import { Clock } from "lucide-react";

// Sample data for different time periods
const weeklyData = [
  { time: "00:00", lunes: 18, martes: 15, miércoles: 18, jueves: 20, viernes: 25, sábado: 32, domingo: 28, total: 156 },
  { time: "01:00", lunes: 12, martes: 10, miércoles: 12, jueves: 14, viernes: 18, sábado: 25, domingo: 20, total: 111 },
  { time: "02:00", lunes: 8, martes: 6, miércoles: 8, jueves: 10, viernes: 12, sábado: 18, domingo: 15, total: 77 },
  { time: "03:00", lunes: 5, martes: 4, miércoles: 5, jueves: 6, viernes: 8, sábado: 12, domingo: 10, total: 50 },
  { time: "04:00", lunes: 4, martes: 3, miércoles: 4, jueves: 5, viernes: 6, sábado: 10, domingo: 8, total: 40 },
  { time: "05:00", lunes: 8, martes: 8, miércoles: 10, jueves: 12, viernes: 15, sábado: 12, domingo: 10, total: 75 },
  { time: "06:00", lunes: 32, martes: 30, miércoles: 35, jueves: 40, viernes: 45, sábado: 28, domingo: 25, total: 235 },
  { time: "07:00", lunes: 52, martes: 52, miércoles: 58, jueves: 62, viernes: 68, sábado: 42, domingo: 38, total: 372 },
  { time: "08:00", lunes: 88, martes: 85, miércoles: 92, jueves: 98, viernes: 105, sábado: 65, domingo: 58, total: 591 },
  { time: "09:00", lunes: 142, martes: 135, miércoles: 145, jueves: 155, viernes: 165, sábado: 95, domingo: 85, total: 922 },
  { time: "10:00", lunes: 185, martes: 178, miércoles: 188, jueves: 198, viernes: 208, sábado: 125, domingo: 112, total: 1194 },
  { time: "11:00", lunes: 218, martes: 205, miércoles: 215, jueves: 225, viernes: 235, sábado: 165, domingo: 148, total: 1411 },
  { time: "12:00", lunes: 238, martes: 225, miércoles: 235, jueves: 245, viernes: 255, sábado: 195, domingo: 175, total: 1568 },
  { time: "13:00", lunes: 268, martes: 255, miércoles: 265, jueves: 275, viernes: 285, sábado: 218, domingo: 198, total: 1764 },
  { time: "14:00", lunes: 305, martes: 295, miércoles: 305, jueves: 315, viernes: 325, sábado: 248, domingo: 225, total: 2018 },
  { time: "15:00", lunes: 318, martes: 305, miércoles: 315, jueves: 325, viernes: 335, sábado: 265, domingo: 242, total: 2105 },
  { time: "16:00", lunes: 295, martes: 288, miércoles: 298, jueves: 308, viernes: 318, sábado: 255, domingo: 232, total: 1994 },
  { time: "17:00", lunes: 262, martes: 255, miércoles: 265, jueves: 275, viernes: 285, sábado: 235, domingo: 215, total: 1792 },
  { time: "18:00", lunes: 215, martes: 208, miércoles: 218, jueves: 228, viernes: 238, sábado: 205, domingo: 188, total: 1500 },
  { time: "19:00", lunes: 178, martes: 175, miércoles: 185, jueves: 195, viernes: 205, sábado: 185, domingo: 168, total: 1291 },
  { time: "20:00", lunes: 138, martes: 135, miércoles: 145, jueves: 155, viernes: 165, sábado: 162, domingo: 148, total: 1048 },
  { time: "21:00", lunes: 95, martes: 95, miércoles: 105, jueves: 115, viernes: 125, sábado: 135, domingo: 122, total: 792 },
  { time: "22:00", lunes: 58, martes: 62, miércoles: 72, jueves: 82, viernes: 92, sábado: 98, domingo: 88, total: 552 },
  { time: "23:00", lunes: 32, martes: 35, miércoles: 42, jueves: 48, viernes: 55, sábado: 62, domingo: 55, total: 329 },
];

const monthlyData = [
  { time: "00:00", week1: 320, week2: 340, week3: 360, week4: 380, total: 1400 },
  { time: "01:00", week1: 220, week2: 230, week3: 240, week4: 250, total: 940 },
  { time: "02:00", week1: 150, week2: 160, week3: 170, week4: 180, total: 660 },
  { time: "03:00", week1: 95, week2: 100, week3: 105, week4: 110, total: 410 },
  { time: "04:00", week1: 75, week2: 80, week3: 85, week4: 90, total: 330 },
  { time: "05:00", week1: 180, week2: 190, week3: 200, week4: 210, total: 780 },
  { time: "06:00", week1: 620, week2: 650, week3: 680, week4: 710, total: 2660 },
  { time: "07:00", week1: 1020, week2: 1050, week3: 1080, week4: 1110, total: 4260 },
  { time: "08:00", week1: 1640, week2: 1680, week3: 1720, week4: 1760, total: 6800 },
  { time: "09:00", week1: 2580, week2: 2620, week3: 2660, week4: 2700, total: 10560 },
  { time: "10:00", week1: 3360, week2: 3400, week3: 3440, week4: 3480, total: 13680 },
  { time: "11:00", week1: 3840, week2: 3880, week3: 3920, week4: 3960, total: 15600 },
  { time: "12:00", week1: 4200, week2: 4240, week3: 4280, week4: 4320, total: 17040 },
  { time: "13:00", week1: 4740, week2: 4780, week3: 4820, week4: 4860, total: 19200 },
  { time: "14:00", week1: 5460, week2: 5500, week3: 5540, week4: 5580, total: 22080 },
  { time: "15:00", week1: 5640, week2: 5680, week3: 5720, week4: 5760, total: 22800 },
  { time: "16:00", week1: 5340, week2: 5380, week3: 5420, week4: 5460, total: 21600 },
  { time: "17:00", week1: 4740, week2: 4780, week3: 4820, week4: 4860, total: 19200 },
  { time: "18:00", week1: 3900, week2: 3940, week3: 3980, week4: 4020, total: 15840 },
  { time: "19:00", week1: 3300, week2: 3340, week3: 3380, week4: 3420, total: 13440 },
  { time: "20:00", week1: 2580, week2: 2620, week3: 2660, week4: 2700, total: 10560 },
  { time: "21:00", week1: 1860, week2: 1900, week3: 1940, week4: 1980, total: 7680 },
  { time: "22:00", week1: 1280, week2: 1320, week3: 1360, week4: 1400, total: 5360 },
  { time: "23:00", week1: 740, week2: 780, week3: 820, week4: 860, total: 3200 },
];

const yearlyData = [
  { time: "00:00", q1: 4200, q2: 4400, q3: 4600, q4: 4800, total: 18000 },
  { time: "01:00", q1: 2820, q2: 2920, q3: 3020, q4: 3120, total: 11880 },
  { time: "02:00", q1: 1980, q2: 2080, q3: 2180, q4: 2280, total: 8520 },
  { time: "03:00", q1: 1230, q2: 1330, q3: 1430, q4: 1530, total: 5520 },
  { time: "04:00", q1: 990, q2: 1090, q3: 1190, q4: 1290, total: 4560 },
  { time: "05:00", q1: 2340, q2: 2440, q3: 2540, q4: 2640, total: 9960 },
  { time: "06:00", q1: 7980, q2: 8180, q3: 8380, q4: 8580, total: 33120 },
  { time: "07:00", q1: 13260, q2: 13460, q3: 13660, q4: 13860, total: 54240 },
  { time: "08:00", q1: 21320, q2: 21520, q3: 21720, q4: 21920, total: 86480 },
  { time: "09:00", q1: 33540, q2: 33740, q3: 33940, q4: 34140, total: 135360 },
  { time: "10:00", q1: 43680, q2: 43880, q3: 44080, q4: 44280, total: 175920 },
  { time: "11:00", q1: 49920, q2: 50120, q3: 50320, q4: 50520, total: 200880 },
  { time: "12:00", q1: 54600, q2: 54800, q3: 55000, q4: 55200, total: 219600 },
  { time: "13:00", q1: 61620, q2: 61820, q3: 62020, q4: 62220, total: 247680 },
  { time: "14:00", q1: 70980, q2: 71180, q3: 71380, q4: 71580, total: 285120 },
  { time: "15:00", q1: 73320, q2: 73520, q3: 73720, q4: 73920, total: 294480 },
  { time: "16:00", q1: 69420, q2: 69620, q3: 69820, q4: 70020, total: 278880 },
  { time: "17:00", q1: 61620, q2: 61820, q3: 62020, q4: 62220, total: 247680 },
  { time: "18:00", q1: 50700, q2: 50900, q3: 51100, q4: 51300, total: 204000 },
  { time: "19:00", q1: 42900, q2: 43100, q3: 43300, q4: 43500, total: 172800 },
  { time: "20:00", q1: 33540, q2: 33740, q3: 33940, q4: 34140, total: 135360 },
  { time: "21:00", q1: 24180, q2: 24380, q3: 24580, q4: 24780, total: 97920 },
  { time: "22:00", q1: 16640, q2: 16840, q3: 17040, q4: 17240, total: 67760 },
  { time: "23:00", q1: 9620, q2: 9820, q3: 10020, q4: 10220, total: 39680 },
];

type TimePeriod = "week" | "month" | "year";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    color: string;
    name: string;
    value: number;
  }>;
  label?: string;
  period: TimePeriod;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground capitalize">{entry.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function PeakHoursChart() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("week");

  const data = timePeriod === "week" ? weeklyData : timePeriod === "month" ? monthlyData : yearlyData;

  const getPeriodKeys = () => {
    if (timePeriod === "week") {
      return ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
    } else if (timePeriod === "month") {
      return ["week1", "week2", "week3", "week4"];
    } else {
      return ["q1", "q2", "q3", "q4"];
    }
  };

  const getPeriodColors = () => {
    if (timePeriod === "week") {
      return {
        lunes: "#3b82f6",
        martes: "#8b5cf6",
        miércoles: "#10b981",
        jueves: "#f59e0b",
        viernes: "#ef4444",
        sábado: "#06b6d4",
        domingo: "#ec4899",
      };
    } else if (timePeriod === "month") {
      return {
        week1: "#3b82f6",
        week2: "#8b5cf6",
        week3: "#10b981",
        week4: "#f59e0b",
      };
    } else {
      return {
        q1: "#3b82f6",
        q2: "#8b5cf6",
        q3: "#10b981",
        q4: "#f59e0b",
      };
    }
  };

  const getPeriodLabels = () => {
    if (timePeriod === "week") {
      return {
        lunes: "Lun",
        martes: "Mar",
        miércoles: "Mié",
        jueves: "Jue",
        viernes: "Vie",
        sábado: "Sáb",
        domingo: "Dom",
      };
    } else if (timePeriod === "month") {
      return {
        week1: "Semana 1",
        week2: "Semana 2",
        week3: "Semana 3",
        week4: "Semana 4",
      };
    } else {
      return {
        q1: "Q1",
        q2: "Q2",
        q3: "Q3",
        q4: "Q4",
      };
    }
  };

  const periodKeys = getPeriodKeys();
  const periodColors = getPeriodColors();
  const periodLabels = getPeriodLabels();

  return (
    <div className="border rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Horas Pico</h3>
        </div>

        <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
          <SelectTrigger className="w-[110px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Semanal</SelectItem>
            <SelectItem value="month">Mensual</SelectItem>
            <SelectItem value="year">Anual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            {periodKeys.map((key) => (
              <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={periodColors[key as keyof typeof periodColors]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={periodColors[key as keyof typeof periodColors]} stopOpacity={0.05} />
              </linearGradient>
            ))}
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
            tickFormatter={(value) => value.toLocaleString()}
            width={40}
          />
          <Tooltip content={<CustomTooltip period={timePeriod} />} />
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
            formatter={(value) => periodLabels[value as keyof typeof periodLabels]}
          />
          {periodKeys.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={periodColors[key as keyof typeof periodColors]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name={key}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
