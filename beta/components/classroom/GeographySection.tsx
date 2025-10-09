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
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PeakHoursChart } from "./PeakHoursChart";
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
  avgInteraction: number;
  topicsFocused: string;
  avgResponseTime: string;
  satisfaction: number;
};

const metrics: InsightMetric[] = [
  { label: "Cobertura Total", value: "32", unit: "estados", trend: "up", trendValue: "3", color: "green" },
  { label: "Estado Más Activo", value: "CDMX", trend: "up", trendValue: "1,247", color: "green" },
  { label: "Duración Promedio de Sesión", value: "18.3", unit: "min", trend: "up", trendValue: "2.1min", color: "blue" },
  { label: "Preguntas por Sesión", value: "12.7", trend: "up", trendValue: "1.3", color: "green" },
];


type Grade = "all" | "1st" | "2nd" | "3rd" | "4th" | "5th" | "6th";

const regionalData: (RegionalData & { grade: Grade })[] = [
  {
    id: "1",
    region: "Mexico City",
    studentCount: 1247,
    avgInteraction: 94.3,
    topicsFocused: "Español, Matemáticas, Ciencias Naturales",
    avgResponseTime: "1.2s",
    satisfaction: 4.8,
    grade: "1st"
  },
  {
    id: "2",
    region: "Guadalajara",
    studentCount: 892,
    avgInteraction: 89.7,
    topicsFocused: "Historia, Geografía, Formación Cívica",
    avgResponseTime: "1.4s",
    satisfaction: 4.6,
    grade: "2nd"
  },
  {
    id: "3",
    region: "Monterrey",
    studentCount: 756,
    avgInteraction: 92.1,
    topicsFocused: "Inglés, Tecnología, Educación Física",
    avgResponseTime: "1.3s",
    satisfaction: 4.7,
    grade: "3rd"
  },
  {
    id: "4",
    region: "Puebla",
    studentCount: 634,
    avgInteraction: 86.5,
    topicsFocused: "Biología, Física, Química",
    avgResponseTime: "1.6s",
    satisfaction: 4.5,
    grade: "4th"
  },
  {
    id: "5",
    region: "Tijuana",
    studentCount: 523,
    avgInteraction: 88.9,
    topicsFocused: "Inglés, Matemáticas, Artes",
    avgResponseTime: "1.5s",
    satisfaction: 4.7,
    grade: "5th"
  },
  {
    id: "6",
    region: "Cancún",
    studentCount: 445,
    avgInteraction: 85.2,
    topicsFocused: "Geografía, Inglés, Historia",
    avgResponseTime: "1.7s",
    satisfaction: 4.4,
    grade: "6th"
  },
  {
    id: "7",
    region: "Mérida",
    studentCount: 387,
    avgInteraction: 87.3,
    topicsFocused: "Historia, Ciencias Naturales, Español",
    avgResponseTime: "1.5s",
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
    title: "CDMX: Estado Más Activo en Chats de IA",
    description: "Ciudad de México lidera con 1,247 estudiantes activos y 94.3% de interacción. Picos de actividad entre 14:00-16:00 hrs.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "Estudiantes Activos", value: "1,247" },
      { label: "Interacción", value: "94.3%" }
    ],
    category: "Actividad Regional"
  },
  {
    id: "4",
    type: "highlight",
    title: "Alto Nivel de Satisfacción General",
    description: "Promedio de satisfacción de 4.6/5 con 67.3% de estudiantes que hacen preguntas de seguimiento.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "Satisfacción", value: "4.6/5" },
      { label: "Tasa de Seguimiento", value: "67.3%" }
    ],
    category: "Experiencia del Usuario"
  },
  {
    id: "2",
    type: "observation",
    title: "Patrones de Consulta por Materia",
    description: "Matemáticas y Física son las materias más consultadas (67% de preguntas). Química muestra mayor crecimiento (+23%).",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "Materia Principal", value: "Matemáticas" },
      { label: "Crecimiento", value: "+23%" }
    ],
    category: "Preferencias Académicas"
  },
  {
    id: "5",
    type: "observation",
    title: "Diversidad de Temas por Región",
    description: "Tijuana y Cancún muestran mayor diversidad en consultas (8.4 temas promedio), especialmente en idiomas y tecnología.",
    timestamp: "5/5/2025, 12:00:00 PM",
    metrics: [
      { label: "Temas Diversos", value: "8.4" },
      { label: "Regiones", value: "2" }
    ],
    category: "Diversidad Académica"
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
    header: "Región",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <MapPin className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">{row.getValue("region")}</span>
      </div>
    ),
  },
  {
    accessorKey: "studentCount",
    header: "Estudiantes",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Users className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">{row.getValue("studentCount")}</span>
      </div>
    ),
  },
  {
    accessorKey: "avgInteraction",
    header: "Interacción",
    cell: ({ row }) => {
      const engagement = row.getValue("avgInteraction") as number;
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
    header: "Materias Principales",
    cell: ({ row }) => (
      <div className="text-xs text-muted-foreground max-w-[300px]">
        {row.getValue("topicsFocused")}
      </div>
    ),
  },
  {
    accessorKey: "avgResponseTime",
    header: "Tiempo de Respuesta",
    cell: ({ row }) => (
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {row.getValue("avgResponseTime")}
      </div>
    ),
  },
  {
    accessorKey: "satisfaction",
    header: "Satisfacción",
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
  const router = useRouter();
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
    const avgInteraction = data.length
      ? (data.reduce((sum, r) => sum + r.avgInteraction, 0) / data.length).toFixed(1)
      : "0.0";
    return {
      totalStudents,
      avgInteraction,
      activeRegions: data.length,
    };
  }, [filteredRegionalData]);
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold mb-1">Análisis Geográfico</h1>
          <p className="text-sm text-muted-foreground">
            Distribución regional y análisis de rendimiento
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Grado</div>
          <Select value={selectedGrade} onValueChange={(v) => setSelectedGrade(v as Grade)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los grados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="1st">1º</SelectItem>
              <SelectItem value="2nd">2º</SelectItem>
              <SelectItem value="3rd">3º</SelectItem>
              <SelectItem value="4th">4º</SelectItem>
              <SelectItem value="5th">5º</SelectItem>
              <SelectItem value="6th">6º</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span>Total estudiantes: <span className="font-medium text-foreground">{aggregatedMetrics.totalStudents}</span></span>
            <span>Interacción promedio: <span className="font-medium text-foreground">{aggregatedMetrics.avgInteraction}%</span></span>
          </div>
        </div>

        {/* Map and Stats Section */}
        <div className="grid grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="col-span-2">
            <MapboxMexicoGlobe height={650} hotspots={hotspots} />
          </div>

          {/* Stats Section */}
          <div className="space-y-4">
            {/* Key Metrics Grid */}
            <div className="space-y-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
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
                    <span className="text-2xl font-bold">{metric.value}</span>
                    {metric.unit && (
                      <span className="text-sm text-muted-foreground">{metric.unit}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Peak Hours Chart */}
            <PeakHoursChart />
          </div>
        </div>

        {/* Regional Data Table */}
        <div className="space-y-4">
          <div className="pt-4">
            <h3 className="text-2xl font-semibold mb-1">Datos de Rendimiento Regional</h3>
            <p className="text-sm text-muted-foreground">
              Desglose detallado por región
            </p>
          </div>
          <DataTable
            columns={regionalDataColumns}
            data={filteredRegionalData}
            onRowClick={(row) =>
              router.push(`/settings/insights/region/${encodeURIComponent((row as RegionalData).region)}`)
            }
          />
        </div>

        {/* Insights Timeline */}
        <div className="space-y-4">
          <div className="pt-4">
            <h3 className="text-2xl font-semibold mb-1">Tendencias Regionales</h3>
          </div>
          <div className="border rounded-lg">
            <div>
            <div className="grid grid-cols-[140px_1fr_200px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
              <div>Tipo</div>
              <div>Análisis</div>
              <div>Fecha y Hora</div>
            </div>
            {Object.entries(
              insights.reduce((acc, insight) => {
                if (!acc[insight.type]) {
                  acc[insight.type] = [];
                }
                acc[insight.type].push(insight);
                return acc;
              }, {} as Record<string, InsightItem[]>)
            ).map(([type, typeInsights]) => (
              <div key={type}>
                {typeInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="grid grid-cols-[140px_1fr_200px] gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <InsightIcon type={insight.type} />
                      <span className="text-sm capitalize">
                        {insight.type === "highlight" && "Destacado"}
                        {insight.type === "concern" && "Preocupación"}
                        {insight.type === "recommendation" && "Recomendación"}
                        {insight.type === "observation" && "Observación"}
                      </span>
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
                            <span className="text-muted-foreground">Categoría</span>
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
            ))}
          </div>
        </div>

        {/* Sample AI Conversation */}
        <div className="space-y-4">
          <div className="pt-4">
            <h3 className="text-2xl font-semibold mb-1">Conversación de Ejemplo</h3>
            <p className="text-sm text-muted-foreground">
              Interacción típica de estudiante con IA en {selectedGrade === "all" ? "todos los grados" : `grado ${selectedGrade}`}
            </p>
          </div>
          <div className="border rounded-lg bg-muted/20">
            <div className="p-4 space-y-4">
              {/* Student Message */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                  E
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Estudiante</span>
                    <span className="text-xs text-muted-foreground">hace 2 minutos</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border">
                    <p className="text-sm">¿Puedes explicarme cómo resolver ecuaciones cuadráticas paso a paso?</p>
                  </div>
                </div>
              </div>

              {/* AI Response */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-medium">
                  AI
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Asistente IA</span>
                    <span className="text-xs text-muted-foreground">hace 1 minuto</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border">
                    <div className="space-y-3 text-sm">
                      <p>¡Por supuesto! Te explico cómo resolver ecuaciones cuadráticas paso a paso:</p>
                      <div className="space-y-2">
                        <p><strong>1. Forma estándar:</strong> ax² + bx + c = 0</p>
                        <p><strong>2. Fórmula cuadrática:</strong></p>
                        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-center font-mono">
                          x = (-b ± √(b² - 4ac)) / 2a
                        </div>
                        <p><strong>3. Ejemplo:</strong> x² - 5x + 6 = 0</p>
                        <p>a = 1, b = -5, c = 6</p>
                        <p>x = (5 ± √(25 - 24)) / 2 = (5 ± 1) / 2</p>
                        <p><strong>Soluciones:</strong> x₁ = 3, x₂ = 2</p>
                      </div>
                      <p className="text-muted-foreground">¿Te gustaría que practiquemos con otro ejemplo?</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Follow-up Student Message */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                  E
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Estudiante</span>
                    <span className="text-xs text-muted-foreground">hace 30 segundos</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border">
                    <p className="text-sm">Sí, por favor. ¿Puedes darme un ejercicio más difícil?</p>
                  </div>
                </div>
              </div>

              {/* AI Response with Exercise */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-medium">
                  AI
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Asistente IA</span>
                    <span className="text-xs text-muted-foreground">hace 10 segundos</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border">
                    <div className="space-y-3 text-sm">
                      <p>¡Perfecto! Aquí tienes un ejercicio más desafiante:</p>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded">
                        <p><strong>Ejercicio:</strong> Resuelve 2x² - 7x + 3 = 0</p>
                        <p className="text-muted-foreground text-xs mt-1">Pista: Usa la fórmula cuadrática y verifica tus respuestas.</p>
                      </div>
                      <p>¿Quieres que te guíe paso a paso o prefieres intentarlo primero?</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

      </div>
    </div>
  );
}

