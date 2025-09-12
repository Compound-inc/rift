/* eslint-disable @typescript-eslint/no-explicit-any */

import { gateway } from "@ai-sdk/gateway";
import { createProviderRegistry } from "ai";
import { ToolType } from "./model-tools";

// Vercel AI Gateway configuration
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;

// Model capabilities interface
export interface ModelCapabilities {
  supportsTools: boolean;
  supportsSearch: boolean;
  supportsUrlContext: boolean;
  supportsStreaming: boolean;
  supportsReasoning: boolean;
  maxTokens?: number;
  contextWindow?: number;
}

// Model configuration types
export type ModelConfig = {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
  pricing: {
    input: number; // per 1M tokens (informational only)
    output: number; // per 1M tokens (informational only)
  };
  isPremium: boolean;
  capabilities: ModelCapabilities;
  supportedTools: ToolType[];
  defaultTools: ToolType[];
};

// Available models configuration
export const MODELS: ModelConfig[] = [
  // OpenAI Models
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "openai",
    description:
      "Modelo de próxima generación de OpenAI con razonamiento y capacidades mejoradas.",
    contextWindow: 200000,
    pricing: { input: 10, output: 30 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 16384,
      contextWindow: 200000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "openai/o3",
    name: "o3",
    provider: "openai",
    description:
      "Modelo de razonamiento de OpenAI optimizado para resolución de problemas complejos.",
    contextWindow: 128000,
    pricing: { input: 15, output: 45 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 16384,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description:
      "Modelo insignia de OpenAI con capacidades de visión y razonamiento avanzado.",
    contextWindow: 128000,
    pricing: { input: 5, output: 15 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 16384,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },

  {
    id: "openai/gpt-4o-nano",
    name: "GPT-4o Nano",
    provider: "openai",
    description:
      "Modelo ultra-rápido y eficiente para tareas conversacionales simples.",
    contextWindow: 64000,
    pricing: { input: 0.05, output: 0.2 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 64000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description:
      "Versión mejorada de GPT-4 con rendimiento y capacidades mejoradas.",
    contextWindow: 128000,
    pricing: { input: 8, output: 24 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 16384,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description:
      "Versión compacta de GPT-4.1 con rendimiento y costo equilibrados.",
    contextWindow: 64000,
    pricing: { input: 1, output: 3 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 8192,
      contextWindow: 64000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    description: "Versión más pequeña de GPT-4.1 para aplicaciones ligeras.",
    contextWindow: 32000,
    pricing: { input: 0.1, output: 0.3 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 4096,
      contextWindow: 32000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4",
    name: "GPT-4",
    provider: "openai",
    description:
      "Modelo potente de OpenAI con excelentes capacidades de razonamiento.",
    contextWindow: 8192,
    pricing: { input: 30, output: 60 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 4096,
      contextWindow: 8192,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "openai/gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    description:
      "Modelo rápido y eficiente para la mayoría de tareas conversacionales.",
    contextWindow: 16385,
    pricing: { input: 0.5, output: 1.5 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 4096,
      contextWindow: 16385,
    },
    supportedTools: [],
    defaultTools: [],
  },
  // Anthropic Models
  {
    id: "anthropic/claude-opus-4-20250514",
    name: "Claude 4 Opus",
    provider: "anthropic",
    description:
      "Modelo más capaz de Anthropic con razonamiento avanzado y búsqueda web.",
    contextWindow: 200000,
    pricing: { input: 15, output: 75 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 200000,
    },
    supportedTools: ["anthropic_web_search"],
    defaultTools: [],
  },
  {
    id: "anthropic/claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet",
    provider: "anthropic",
    description:
      "Modelo Claude 4 equilibrado con excelente rendimiento y razonamiento.",
    contextWindow: 200000,
    pricing: { input: 3, output: 15 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 200000,
    },
    supportedTools: ["anthropic_web_search"],
    defaultTools: [],
  },
  {
    id: "anthropic/claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet",
    provider: "anthropic",
    description:
      "Claude 3.5 mejorado con razonamiento y capacidades mejoradas.",
    contextWindow: 200000,
    pricing: { input: 3, output: 15 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 200000,
    },
    supportedTools: ["anthropic_web_search"],
    defaultTools: [],
  },

  // Google Models
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description:
      "Modelo rápido más reciente de Google con capacidades sólidas y búsqueda web.",
    contextWindow: 1048576,
    pricing: { input: 0, output: 0 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: true,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 1048576,
    },
    supportedTools: ["google_search", "url_context"],
    defaultTools: ["url_context"],
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description:
      "Modelo de mayor calidad de Google con razonamiento avanzado y uso de herramientas.",
    contextWindow: 1048576,
    pricing: { input: 0, output: 0 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: true,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 1048576,
    },
    supportedTools: ["google_search", "url_context"],
    defaultTools: ["url_context"],
  },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Fast, cost-effective, multi-modal model.",
    contextWindow: 1048576,
    pricing: { input: 0, output: 0 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: true,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 1048576,
    },
    supportedTools: ["google_search", "url_context"],
    defaultTools: ["url_context"],
  },
  {
    id: "google/gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    provider: "google",
    description: "Popular fast model with tool calling and multi-modal input.",
    contextWindow: 1048576,
    pricing: { input: 0, output: 0 },
    isPremium: false,
    capabilities: {
      supportsTools: false,
      supportsSearch: true,
      supportsUrlContext: true,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 1048576,
    },
    supportedTools: ["google_search", "url_context"],
    defaultTools: ["url_context"],
  },

  // xAI Models
  {
    id: "xai/grok-4",
    name: "Grok 4",
    provider: "xai",
    description:
      "Modelo de razonamiento más avanzado de xAI con capacidades mejoradas.",
    contextWindow: 128000,
    pricing: { input: 10, output: 30 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "xai/grok-code-fast-1",
    name: "Grok Code Fast 1",
    provider: "xai",
    description:
      "Modelo especializado en programación de xAI optimizado para tareas de programación.",
    contextWindow: 32000,
    pricing: { input: 2, output: 6 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 8192,
      contextWindow: 32000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "xai/grok-3",
    name: "Grok 3",
    provider: "xai",
    description:
      "xAI's powerful general-purpose model with strong reasoning abilities.",
    contextWindow: 128000,
    pricing: { input: 5, output: 15 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "xai/grok-3-mini",
    name: "Grok 3 Mini",
    provider: "xai",
    description:
      "Compact version of Grok 3 with balanced performance and cost efficiency.",
    contextWindow: 64000,
    pricing: { input: 1, output: 3 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: true,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 64000,
    },
    supportedTools: [],
    defaultTools: [],
  },

  // OpenRouter Models
  {
    id: "mistralai/magistral-small-latest",
    name: "Magistral Small",
    provider: "openrouter",
    description:
      "Modelo de razonamiento pequeño más reciente de Mistral con capacidades de pensamiento paso a paso vía OpenRouter.",
    contextWindow: 128000,
    pricing: { input: 2, output: 6 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "mistralai/mistral-medium-latest",
    name: "Mistral Medium",
    provider: "openrouter",
    description:
      "Modelo medio equilibrado de Mistral con rendimiento sólido en tareas vía OpenRouter.",
    contextWindow: 128000,
    pricing: { input: 3, output: 9 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS-120B",
    provider: "openrouter",
    description:
      "OpenAI's open-source GPT model with 120B parameters via OpenRouter.",
    contextWindow: 128000,
    pricing: { input: 5, output: 15 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "deepseek/deepseek-chat-v3.1",
    name: "DeepSeek Chat v3.1",
    provider: "openrouter",
    description:
      "DeepSeek's latest chat model with enhanced conversational capabilities via OpenRouter.",
    contextWindow: 64000,
    pricing: { input: 0.27, output: 1.1 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 64000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "deepseek/deepseek-r1-0528:free",
    name: "DeepSeek R1 (Free)",
    provider: "openrouter",
    description:
      "DeepSeek's reasoning model with step-by-step thinking capabilities, free tier via OpenRouter.",
    contextWindow: 64000,
    pricing: { input: 0, output: 0 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 8192,
      contextWindow: 64000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "tngtech/deepseek-r1t2-chimera:free",
    name: "DeepSeek R1T2 Chimera (Free)",
    provider: "openrouter",
    description:
      "Enhanced DeepSeek reasoning model with improved capabilities, free tier via OpenRouter.",
    contextWindow: 64000,
    pricing: { input: 0, output: 0 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 8192,
      contextWindow: 64000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "z-ai/glm-4.5",
    name: "GLM-4.5",
    provider: "openrouter",
    description:
      "Zhipu AI's GLM-4.5 model with strong Chinese and English capabilities via OpenRouter.",
    contextWindow: 128000,
    pricing: { input: 1.0, output: 1.0 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "z-ai/glm-4.5v",
    name: "GLM-4.5v",
    provider: "openrouter",
    description:
      "Zhipu AI's GLM-4.5v model with vision capabilities for image understanding via OpenRouter.",
    contextWindow: 128000,
    pricing: { input: 1.5, output: 1.5 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "qwen/qwen3-30b-a3b",
    name: "Qwen3 30B",
    provider: "openrouter",
    description:
      "Qwen's 30B parameter model with strong performance across various tasks via OpenRouter.",
    contextWindow: 128000,
    pricing: { input: 0.8, output: 0.8 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "openrouter/horizon-beta",
    name: "Horizon Beta",
    provider: "openrouter",
    description:
      "OpenRouter's experimental beta model with cutting-edge capabilities.",
    contextWindow: 128000,
    pricing: { input: 2.0, output: 2.0 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "moonshotai/kimi-k2",
    name: "Kimi K2",
    provider: "openrouter",
    description:
      "Moonshot AI's Kimi K2 model with strong Chinese and English capabilities via OpenRouter.",
    contextWindow: 200000,
    pricing: { input: 1.2, output: 1.2 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 200000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "qwen/qwen3-235b-a22b-thinking-2507",
    name: "Qwen3 235B Thinking",
    provider: "openrouter",
    description:
      "Qwen's largest 235B parameter thinking model with advanced reasoning capabilities via OpenRouter.",
    contextWindow: 128000,
    pricing: { input: 8.0, output: 8.0 },
    isPremium: true,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "meta-llama/llama-4-maverick",
    name: "Llama 4 Maverick",
    provider: "openrouter",
    description:
      "Meta's Llama 4 Maverick model with enhanced capabilities via OpenRouter.",
    contextWindow: 128000,
    pricing: { input: 3.0, output: 3.0 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
  {
    id: "qwen/qwen3-coder",
    name: "Qwen3 Coder",
    provider: "openrouter",
    description:
      "Qwen's specialized coding model optimized for programming tasks via OpenRouter.",
    contextWindow: 128000,
    pricing: { input: 1.5, output: 1.5 },
    isPremium: false,
    capabilities: {
      supportsTools: true,
      supportsSearch: false,
      supportsUrlContext: false,
      supportsStreaming: true,
      supportsReasoning: false,
      maxTokens: 8192,
      contextWindow: 128000,
    },
    supportedTools: [],
    defaultTools: [],
  },
];

// Provider registry (not strictly necessary, but kept for API symmetry)
export const registry = createProviderRegistry({}, { separator: ":" });

// Helpers for UI
export function getModelById(modelId: string): ModelConfig | undefined {
  const resolvedModelId = resolveRecommendedModel(modelId);
  return MODELS.find((model) => model.id === resolvedModelId);
}

export function getModelsByProvider(provider: string): ModelConfig[] {
  return MODELS.filter((model) => model.provider === provider);
}

export function getAllProviders(): string[] {
  return Array.from(new Set(MODELS.map((model) => model.provider)));
}

// Recommended options mapping
export const RECOMMENDED_OPTIONS_MAP = {
  "rec:automatico": "openai/gpt-oss-120b", // GPT-OSS-120B
  "rec:problemas-dificiles": "openai/gpt-5", // GPT-5
  "rec:escritura": "anthropic/claude-sonnet-4-20250514", // Claude 4 Sonnet
  "rec:sorpresa": "mistralai/magistral-small-latest", // Magistral Small
} as const;

// Helper function to resolve recommended options to actual model IDs
export function resolveRecommendedModel(selectedModel: string): string {
  // If it's already a regular model ID, return as-is
  if (!selectedModel.startsWith("rec:")) {
    return selectedModel;
  }

  // Handle surprise option - now uses fixed model instead of random
  if (selectedModel === "rec:sorpresa") {
    return "mistralai/magistral-small-latest";
  }

  // Map other recommended options to specific models
  const mappedModel =
    RECOMMENDED_OPTIONS_MAP[
      selectedModel as keyof typeof RECOMMENDED_OPTIONS_MAP
    ];
  return mappedModel || DEFAULT_MODEL;
}

// Helper function to check if a model ID is a recommended option
export function isRecommendedOption(modelId: string): boolean {
  return modelId.startsWith("rec:");
}

// Default model configuration
export const DEFAULT_MODEL = "openai/gpt-4o";

// Enhanced model utilities
export function getModelCapabilities(
  modelId: string,
): ModelCapabilities | undefined {
  const resolvedModelId = resolveRecommendedModel(modelId);
  const model = getModelById(resolvedModelId);
  return model?.capabilities;
}

export function getModelSupportedTools(modelId: string): ToolType[] {
  const resolvedModelId = resolveRecommendedModel(modelId);
  const model = getModelById(resolvedModelId);
  return model?.supportedTools || [];
}

export function getModelDefaultTools(modelId: string): ToolType[] {
  const resolvedModelId = resolveRecommendedModel(modelId);
  const model = getModelById(resolvedModelId);
  return model?.defaultTools || [];
}

export function isModelCapable(
  modelId: string,
  capability: keyof ModelCapabilities,
): boolean {
  const resolvedModelId = resolveRecommendedModel(modelId);
  const capabilities = getModelCapabilities(resolvedModelId);
  return Boolean(capabilities?.[capability]) || false;
}

// Reasoning models that should use the responses API
const REASONING_MODELS = [
  "gpt-5",
  "o3",
  "o4-mini",
  "o1",
  "o3-mini",
  "magistral-small",
  "magistral-small-2506",
  "deepseek-r1",
  "deepseek-r1t2-chimera",
  "qwen3-235b-a22b-thinking",
];

// Check if a model is a reasoning model
function isReasoningModel(modelName: string): boolean {
  return REASONING_MODELS.some((reasoningModel) =>
    modelName.includes(reasoningModel),
  );
}

// Check if a model supports reasoning based on its capabilities
export function modelSupportsReasoning(modelId: string): boolean {
  const resolvedModelId = resolveRecommendedModel(modelId);
  const capabilities = getModelCapabilities(resolvedModelId);
  return Boolean(capabilities?.supportsReasoning);
}

// Resolve language model using Vercel AI Gateway
/**
 * Check if a model is premium based on its configuration
 */
export function isModelPremium(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.isPremium ?? false;
}

export function getLanguageModel(modelId: string) {
  const resolvedModelId = resolveRecommendedModel(modelId);

  // Check if AI Gateway is configured
  if (!AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY environment variable is required");
  }

  // Use AI Gateway for all models
  // The gateway provider handles all the different model providers internally
  // OpenRouter models are now referenced directly (e.g., mistralai/magistral-small-latest)
  // instead of with openrouter/ prefix
  return gateway(resolvedModelId as any);
}
