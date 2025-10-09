"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ai/ui/select";
import { Input } from "@/components/ai/ui/input";
import { DataTable } from "@/components/ai/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ai/ui/button";
import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { Drawer, DrawerContent } from "@/components/ai/ui/drawer";

type AiMessageMeta = {
  id: string;
  title: string; // AI chat title
  subject: string;
  grade: string;
  state: string;
  city: string;
  threadId: string;
  messages: number;
  lastMessageAt: string;
};

const SUBJECTS = [
  "Todos",
  "Matemáticas",
  "Español",
  "Ciencias Naturales",
  "Historia",
  "Geografía",
  "Inglés",
  "Tecnología",
  "Artes",
  "Educación Física",
  "Formación Cívica",
  "Biología",
  "Física",
  "Química",
];

const SUBJECT_LIST = SUBJECTS.slice(1);

const GRADE_OPTIONS = [
  "Todos",
  "1º", "2º", "3º", "4º", "5º", "6º",
  "7º", "8º", "9º", // secundaria
  "10º", "11º", "12º", // preparatoria
];

const CITY_TO_STATE: Record<string, string> = {
  "Mexico City": "CDMX",
  "Guadalajara": "Jalisco",
  "Monterrey": "Nuevo León",
  "Puebla": "Puebla",
  "Tijuana": "Baja California",
  "Cancún": "Quintana Roo",
  "Mérida": "Yucatán",
};

const columns: ColumnDef<AiMessageMeta>[] = [
  { accessorKey: "title", header: "Título" },
  { accessorKey: "subject", header: "Materia" },
  { accessorKey: "grade", header: "Grado" },
  { accessorKey: "state", header: "Estado" },
  { accessorKey: "city", header: "Ciudad" },
  {
    accessorKey: "messages",
    header: "Mensajes",
    cell: ({ row }) => <span className="text-sm font-medium">{row.getValue("messages")}</span>,
  },
  { accessorKey: "lastMessageAt", header: "Último mensaje" },
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedGrade(): string {
  const grades = [
    "1º", "2º", "3º", "4º", "5º", "6º",
    "7º", "8º", "9º",
    "10º", "11º", "12º",
  ];
  const weights = grades.map((g) => {
    const n = parseInt(g);
    if (n >= 10) return 6; // strongest bias to highschool
    if (n >= 7) return 3;  // medium bias to secundaria
    return 1;              // lower for primaria
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < grades.length; i++) {
    if (r < weights[i]) return grades[i];
    r -= weights[i];
  }
  return grades[grades.length - 1];
}

function formatDate(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function RegionalInsightsPage() {
  const params = useParams<{ region: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const regionParam = params?.region ? decodeURIComponent(params.region) : "";

  const [selectedSubject, setSelectedSubject] = useState<string>("Todos");
  const [selectedGrade, setSelectedGrade] = useState<string>("Todos");
  const [search, setSearch] = useState<string>("");
  const [generatedData, setGeneratedData] = useState<AiMessageMeta[]>([]);
  const threadParam = searchParams?.get("thread") || "";
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [selectedChat, setSelectedChat] = useState<AiMessageMeta | null>(null);

  // Generate data on client-side only to avoid hydration mismatch
  useEffect(() => {
    const city = regionParam || "Mexico City";
    const state = CITY_TO_STATE[city] || "CDMX";
    
    const data: AiMessageMeta[] = Array.from({ length: randomInt(15, 25) }, (_, i) => {
      const subject = SUBJECT_LIST[randomInt(0, SUBJECT_LIST.length - 1)];
      const grade = pickWeightedGrade();
      const messages = randomInt(3, 47);
      const lastMessageAt = formatDate(new Date(Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000)));
      
      return {
        id: `thread-${i}`,
        title: `Chat de ${subject} - ${grade}`,
        subject,
        grade,
        state,
        city,
        threadId: `thread-${i}`,
        messages,
        lastMessageAt,
      };
    });
    
    setGeneratedData(data);
  }, [regionParam]);

  const filteredData = useMemo(() => {
    return generatedData.filter((item) => {
      const matchesSubject = selectedSubject === "Todos" || item.subject === selectedSubject;
      const matchesGrade = selectedGrade === "Todos" || item.grade === selectedGrade;
      const matchesSearch = search === "" || 
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.subject.toLowerCase().includes(search.toLowerCase());
      
      return matchesSubject && matchesGrade && matchesSearch;
    });
  }, [generatedData, selectedSubject, selectedGrade, search]);

  // Handle drawer open/close based on threadParam
  useEffect(() => {
    setIsDrawerOpen(!!threadParam);
  }, [threadParam]);

  const handleRowClick = (row: AiMessageMeta) => {
    setSelectedChat(row);
    const threadId = row.threadId;
    router.push(`/settings/insights/region/${encodeURIComponent(regionParam)}?thread=${threadId}`);
  };

  const handleDrawerClose = () => {
    setSelectedChat(null);
    router.push(`/settings/insights/region/${encodeURIComponent(regionParam)}`);
  };

  return (
    <>
    <div className="pt-12 pb-12 pl-12 pr-12 flex flex-col max-w-7xl min-w-[520px] w-full min-h-full box-border">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href="/settings/insights"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Insights
        </Link>
      </div>

      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Chats de IA por Materia, Grado y Ubicación</h1>
        <p className="text-sm text-muted-foreground">
          Análisis detallado de conversaciones de IA en {regionParam}
        </p>
      </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="pb-4 mb-4">
            <div className="flex justify-end pr-2 pt-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">Materia:</label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Seleccionar materia" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <label className="text-sm font-medium whitespace-nowrap">Grado:</label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Seleccionar grado" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <label className="text-sm font-medium whitespace-nowrap">Buscar:</label>
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48"
                />
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="flex-1 overflow-hidden">
            <DataTable
              columns={columns}
              data={filteredData}
              onRowClick={handleRowClick}
            />
          </div>
          </div>
        </div>

      {/* Chat Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        side="right"
        size="xl"
        className="w-[90vw] max-w-4xl"
      >
        <DrawerContent>
          {/* Custom Header */}
          {threadParam && selectedChat && (
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedChat.title}</h2>
                  <div className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">{selectedChat.subject}</span>
                    <span className="mx-2">•</span>
                    <span className="font-medium">{selectedChat.grade}</span>
                    <span className="mx-2">•</span>
                    <span className="font-medium">{selectedChat.city}</span>
                    <span className="mx-2">•</span>
                    <span className="text-xs">{selectedChat.lastMessageAt}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDrawerClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        {threadParam && (
            <div className="flex h-full w-full min-h-0 flex-col relative">
              {/* Single scrollable area that includes messages and actions - now takes full height */}
              <div className="flex-1 min-h-0">
                <div className="mx-auto w-full max-w-3xl p-4 pb-30">
                  {/* User Message */}
                  <div className="mb-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border">
                      <p className="text-sm leading-relaxed">Hola, necesito ayuda con las ecuaciones cuadráticas. No entiendo cómo usar la fórmula cuadrática.</p>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="mb-4">
                    <div className="space-y-3 text-sm leading-relaxed">
                      <p>¡Hola! Te ayudo con las ecuaciones cuadráticas. La fórmula cuadrática es una herramienta muy útil para resolver este tipo de ecuaciones.</p>
                      <div className="space-y-2">
                        <p><strong>Fórmula cuadrática:</strong></p>
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded text-center font-mono text-base">
                          x = (-b ± √(b² - 4ac)) / 2a
                        </div>
                        <p><strong>Pasos para usarla:</strong></p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Identifica los valores de a, b y c en tu ecuación</li>
                          <li>Sustituye estos valores en la fórmula</li>
                          <li>Calcula el discriminante (b² - 4ac)</li>
                          <li>Resuelve para obtener las dos soluciones</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* User Follow-up */}
                  <div className="mb-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border">
                      <p className="text-sm leading-relaxed">¿Puedes darme un ejemplo paso a paso? Tengo la ecuación x² - 5x + 6 = 0</p>
                    </div>
                  </div>

                  {/* AI Example */}
                  <div className="mb-4">
                    <div className="space-y-3 text-sm leading-relaxed">
                      <p>¡Perfecto! Te resuelvo x² - 5x + 6 = 0 paso a paso:</p>
                      <div className="space-y-2">
                        <p><strong>Paso 1:</strong> Identificar a, b, c</p>
                        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                          <p>a = 1, b = -5, c = 6</p>
                        </div>
                        
                        <p><strong>Paso 2:</strong> Calcular el discriminante</p>
                        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                          <p>b² - 4ac = (-5)² - 4(1)(6) = 25 - 24 = 1</p>
                        </div>
                        
                        <p><strong>Paso 3:</strong> Aplicar la fórmula</p>
                        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                          <p>x = (5 ± √1) / 2 = (5 ± 1) / 2</p>
                        </div>
                        
                        <p><strong>Paso 4:</strong> Calcular las soluciones</p>
                        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                          <p>x₁ = (5 + 1) / 2 = 3</p>
                          <p>x₂ = (5 - 1) / 2 = 2</p>
                        </div>
                        
                        <p><strong>Respuesta:</strong> x = 3 o x = 2</p>
                      </div>
                      <p className="text-muted-foreground">¿Te queda más claro ahora? ¿Quieres practicar con otro ejemplo?</p>
                    </div>
                  </div>
            
                  {/* User Thanks */}
                  <div className="mb-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border">
                      <p className="text-sm leading-relaxed">¡Muchas gracias! Ahora sí entiendo. Sí, me gustaría practicar con otro ejemplo más difícil.</p>
                    </div>
                  </div>

                  {/* AI Advanced Example */}
                  <div className="mb-4">
                    <div className="space-y-3 text-sm leading-relaxed">
                      <p>¡Excelente! Aquí tienes un ejercicio más desafiante:</p>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded">
                        <p><strong>Ejercicio:</strong> Resuelve 2x² - 7x + 3 = 0</p>
                        <p className="text-muted-foreground text-xs mt-1">Pista: a = 2, b = -7, c = 3</p>
                      </div>
                      <p>Intenta resolverlo paso a paso. Si necesitas ayuda, puedo guiarte o darte la respuesta completa.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
