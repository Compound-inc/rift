/* eslint-disable @typescript-eslint/no-explicit-any */

import { openai } from "@ai-sdk/openai";
import {
  BaseModelConfig,
  mergeCapabilities,
  DEFAULT_PROVIDER_SETTINGS,
  ToolType,
} from "../config/base";

// OpenAI-specific settings interface
export interface OpenAISettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
  // OpenAI-specific options
  parallelToolCalls?: boolean;
  store?: boolean;
  user?: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  reasoningSummary?: "auto" | "detailed";
  strictJsonSchema?: boolean;
  serviceTier?: "auto" | "flex" | "priority";
  textVerbosity?: "low" | "medium" | "high";
  maxToolCalls?: number;
  metadata?: Record<string, string>;
  previousResponseId?: string;
  instructions?: string;
  include?: string[];
  promptCacheKey?: string;
  safetyIdentifier?: string;
  structuredOutputs?: boolean;
  maxCompletionTokens?: number;
  prediction?: Record<string, any>;
  logitBias?: Record<number, number>;
  logprobs?: boolean | number;
}

// Default OpenAI settings
export const DEFAULT_OPENAI_SETTINGS: OpenAISettings = {
  ...DEFAULT_PROVIDER_SETTINGS,
  parallelToolCalls: true,
  store: true,
  reasoningEffort: "medium",
  strictJsonSchema: false,
  serviceTier: "auto",
  textVerbosity: "medium",
  structuredOutputs: true,
  maxRetries: 3,
};

// OpenAI model configurations
export const OPENAI_MODELS: BaseModelConfig[] = [
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "openai",
    description:
      "El mejor modelo de OpenAI para tareas complejas",
    contextWindow: 400000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsImageOutput: true,
      supportsPDFInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "openai/gpt-5.1-instant",
    name: "GPT-5.1 Instant",
    provider: "openai",
    description:
      "Versión conversacional y cálida con razonamiento adaptativo y mejor seguimiento de instrucciones",
    contextWindow: 400000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsImageOutput: true,
      supportsPDFInput: true,
      supportsObjectGeneration: true,
      maxTokens: 131072,
    }),
  },
  {
    id: "openai/gpt-5.1-thinking",
    name: "GPT-5.1 Thinking",
    provider: "openai",
    description:
      "Modelo de razonamiento avanzado con tiempo de procesamiento extendido para problemas complejos",
    contextWindow: 400000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsImageOutput: true,
      supportsPDFInput: true,
      supportsObjectGeneration: true,
      maxTokens: 409600,
    }),
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    description: "Una versión más rápida de GPT-5 para tareas específicas",
    contextWindow: 400000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsPDFInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    description: "Versión ultra-rápida y eficiente de GPT-5",
    contextWindow: 400000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsPDFInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "openai/o3",
    name: "o3",
    provider: "openai",
    description:
      "Modelo de razonamiento para tareas complejas, precedido por GPT-5",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsReasoning: true,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsPDFInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "openai/o3-mini",
    name: "o3 Mini",
    provider: "openai",
    description:
      "Modelo de razonamiento para tareas complejas, precedido por GPT-5 mini",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsReasoning: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "openai/o4-mini",
    name: "o4 Mini",
    provider: "openai",
    description:
      "Modelo de razonamiento rápido y eficiente en costos, precedido por GPT-5 mini",
    contextWindow: 200000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsReasoning: true,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsPDFInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "El modelo más inteligente sin capacidades de razonamiento",
    contextWindow: 1047576,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsPDFInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 8192,
    }),
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "Versión más pequeña y rápida de GPT-4.1",
    contextWindow: 1047576,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsPDFInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 8192,
    }),
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Modelo GPT rápido, inteligente y flexible",
    contextWindow: 128000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsPDFInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Modelo compacto y rápido para tareas específicas",
    contextWindow: 128000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsPDFInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "openai",
    description: "El modelo de código abierto más potente de OpenAI",
    contextWindow: 131072,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 131072,
    }),
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    provider: "openai",
    description: "Modelo de código abierto de tamaño medio optimizado para baja latencia",
    contextWindow: 131072,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 131072,
    }),
  },
];

// Helper functions
export function getOpenAIModel(modelId: string): BaseModelConfig | undefined {
  return OPENAI_MODELS.find((model) => model.id === modelId);
}
