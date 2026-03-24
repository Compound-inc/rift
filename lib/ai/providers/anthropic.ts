import {
  BaseModelConfig,
  mergeCapabilities,
  DEFAULT_PROVIDER_SETTINGS,
  ToolType,
} from "../config/base";

// Anthropic-specific settings interface
export interface AnthropicSettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
  // Anthropic-specific options
  parallelToolCalls?: boolean;
  store?: boolean;
  user?: string;
  structuredOutputs?: boolean;
  effort?: "low" | "medium" | "high";
  maxCompletionTokens?: number;
  logitBias?: Record<number, number>;
  logprobs?: boolean | number;
  stop?: string | string[];
  metadata?: Record<string, string>;
  system?: string;
  tools?: any[];
  toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
}

// Default Anthropic settings
export const DEFAULT_ANTHROPIC_SETTINGS: AnthropicSettings = {
  ...DEFAULT_PROVIDER_SETTINGS,
  parallelToolCalls: true,
  store: true,
  structuredOutputs: true,
  effort: "low",
  maxRetries: 3,
};

// Anthropic model configurations
export const ANTHROPIC_MODELS: BaseModelConfig[] = [
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description:
      "Claude Sonnet 4.6 ofrece mejoras de frontera en código, agentes y trabajo profesional sobre Sonnet 4.5.",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsPDFInput: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 128000,
    }),
  },
  {
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    description:
      "Best model for coding and professional work. Excels at SDLC, complex bugs, codebase understanding, and near-production-ready docs.",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsPDFInput: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "anthropic/claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    description: "Previous flagship. Most capable for complex problems, reasoning, and long context.",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsPDFInput: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    description: "Claude Sonnet 4.5 es el modelo más reciente de la serie Sonnet, que ofrece mejoras y actualizaciones sobre Sonnet 4",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsPDFInput: false,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    description: "El modelo equilibra rendimiento y eficiencia con mayor capacidad de direccionamiento",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsPDFInput: false,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "anthropic/claude-3.7-sonnet",
    name: "Claude Sonnet 3.7",
    provider: "anthropic",
    description: "Ofrece un rendimiento de vanguardia para programación, generación de contenido, análisis de datos y tareas de planificación",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsPDFInput: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude Sonnet 3.5",
    provider: "anthropic",
    description: "El equilibrio ideal entre inteligencia y velocidad",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Haiku 4.5 tiene un nivel de inteligencia igual que Sonnet 4.5 pero es más rápido.",
    contextWindow: 200000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsPDFInput: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude Haiku 3.5",
    provider: "anthropic",
    description: "Haiku 3.5 es la próxima generación del modelo más rápido de Anthropic.",
    contextWindow: 200000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "anthropic/claude-3-haiku",
    name: "Claude Haiku 3",
    provider: "anthropic",
    description: "Haiku 3 analiza rápidamente grandes volúmenes de documentos, como informes trimestrales, contratos o casos legales",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
];

// Helper functions
export function getAnthropicModel(modelId: string): BaseModelConfig | undefined {
  return ANTHROPIC_MODELS.find((model) => model.id === modelId);
}
