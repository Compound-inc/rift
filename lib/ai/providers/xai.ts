 

import {
  BaseModelConfig,
  mergeCapabilities,
  DEFAULT_PROVIDER_SETTINGS,
  ToolType,
} from "../config/base";

// xAI-specific settings interface
export interface XAISettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
  // xAI-specific options
  parallelToolCalls?: boolean;
  store?: boolean;
  user?: string;
  reasoning?: {
    enabled?: boolean;
  };
  structuredOutputs?: boolean;
  maxCompletionTokens?: number;
  logitBias?: Record<number, number>;
  logprobs?: boolean | number;
  stop?: string | string[];
}

// Default xAI settings
export const DEFAULT_XAI_SETTINGS: XAISettings = {
  ...DEFAULT_PROVIDER_SETTINGS,
  parallelToolCalls: true,
  store: true,
  structuredOutputs: true,
  maxRetries: 3,
  reasoning: {
    enabled: false,
  },
};

// xAI model configurations
export const XAI_MODELS: BaseModelConfig[] = [
  {
    id: "xai/grok-4.1-fast-non-reasoning",
    name: "Grok 4.1 Fast",
    provider: "xai",
    description:
      "Perfecto para problemas del mundo real complejos optimizado para velocidad.",
    contextWindow: 2000000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  // {
  //   id: "xai/grok-4.1-fast-reasoning",
  //   name: "Grok 4.1 Fast Reasoning",
  //   provider: "xai",
  //   description:
  //     "Modelo de razonamiento rápido y económico que sobresale en tareas de programación.",
  //   contextWindow: 2000000,
  //   isPremium: false,
  //   capabilities: mergeCapabilities({
  //     supportsTools: true,
  //     supportsImageInput: true,
  //     supportsStreaming: true,
  //     supportsReasoning: true,
  //     supportsObjectGeneration: true,
  //     maxTokens: 16384,
  //   }),
  // },
  {
    id: "xai/grok-4-fast-non-reasoning",
    name: "Grok 4 Fast",
    provider: "xai",
    description:
      "El modelo multimodal más reciente con eficiencia de costos de vanguardia y ventana de contexto de 2M tokens",
    contextWindow: 2000000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  // {
  //   id: "xai/grok-4",
  //   name: "Grok 4",
  //   provider: "xai",
  //   description:
  //     "El modelo insignia más reciente que ofrece un rendimiento sin igual en lenguaje natural, matemáticas y razonamiento",
  //   contextWindow: 256000,
  //   isPremium: true,
  //   capabilities: mergeCapabilities({
  //     supportsTools: true,
  //     supportsStreaming: true,
  //     supportsImageInput: true,
  //     supportsReasoning: false,
  //     supportsObjectGeneration: true,
  //     maxTokens: 16384,
  //   }),
  // },
  {
    id: "xai/grok-code-fast-1",
    name: "Grok Code Fast 1",
    provider: "xai",
    description:
      "Modelo de razonamiento rápido y económico que sobresale en tareas de programación agéntica",
    contextWindow: 256000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "xai/grok-3",
    name: "Grok 3",
    provider: "xai",
    description:
      "Modelo avanzado con sólidas capacidades en múltiples dominios",
    contextWindow: 131072,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 8192,
    }),
  },
  {
    id: "xai/grok-3-mini",
    name: "Grok 3 Mini",
    provider: "xai",
    description:
      "Modelo de razonamiento ligero. Rápido, inteligente y excelente para tareas basadas en lógica",
    contextWindow: 131072,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsObjectGeneration: true,
      maxTokens: 8192,
    }),
  },
];

// Helper functions
export function getXAIModel(modelId: string): BaseModelConfig | undefined {
  return XAI_MODELS.find((model) => model.id === modelId);
}

// Reasoning helper functions
export function supportsReasoning(modelId: string): boolean {
  const model = getXAIModel(modelId);
  return model?.capabilities.supportsReasoning || false;
}

export function getReasoningSettings(
  modelId: string,
  enabled: boolean = true,
): Partial<XAISettings> {
  if (!supportsReasoning(modelId)) {
    return {};
  }

  return {
    reasoning: {
      enabled,
    },
  };
}

