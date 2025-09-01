/* eslint-disable @typescript-eslint/no-explicit-any */

import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { createProviderRegistry } from "ai";
import { ToolType } from "./model-tools";

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
    id: "openai:gpt-5",
    name: "GPT-5",
    provider: "openai",
    description:
      "OpenAI's next-generation model with enhanced reasoning and capabilities.",
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
    id: "openai:o3",
    name: "o3",
    provider: "openai",
    description:
      "OpenAI's reasoning model optimized for complex problem solving.",
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
    id: "openai:gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description:
      "OpenAI's flagship model with vision and advanced reasoning capabilities.",
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
    id: "openai:gpt-4o-nano",
    name: "GPT-4o Nano",
    provider: "openai",
    description:
      "Ultra-fast and efficient model for simple conversational tasks.",
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
    id: "openai:gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description:
      "Enhanced version of GPT-4 with improved performance and capabilities.",
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
    id: "openai:gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description:
      "Compact version of GPT-4.1 with balanced performance and cost.",
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
    id: "openai:gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    description: "Smallest version of GPT-4.1 for lightweight applications.",
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
    id: "openai:gpt-4",
    name: "GPT-4",
    provider: "openai",
    description:
      "OpenAI's powerful model with excellent reasoning capabilities.",
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
    id: "openai:gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    description: "Fast and efficient model for most conversational tasks.",
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
    id: "anthropic:claude-opus-4-20250514",
    name: "Claude 4 Opus",
    provider: "anthropic",
    description:
      "Anthropic's most capable model with advanced reasoning and web search.",
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
    id: "anthropic:claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet",
    provider: "anthropic",
    description:
      "Balanced Claude 4 model with excellent performance and reasoning.",
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
    id: "anthropic:claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet",
    provider: "anthropic",
    description:
      "Enhanced Claude 3.5 with improved reasoning and capabilities.",
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
    id: "google:gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description:
      "Google's latest fast model with strong capabilities and web search grounding.",
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
    id: "google:gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description:
      "Google's higher quality model with advanced reasoning and tool use.",
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
    id: "google:gemini-2.0-flash",
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
    id: "google:gemini-2.0-flash-lite",
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
];

// Provider registry (not strictly necessary, but kept for API symmetry)
export const registry = createProviderRegistry({}, { separator: ":" });

// Helpers for UI
export function getModelById(modelId: string): ModelConfig | undefined {
  return MODELS.find((model) => model.id === modelId);
}

export function getModelsByProvider(provider: string): ModelConfig[] {
  return MODELS.filter((model) => model.provider === provider);
}

export function getAllProviders(): string[] {
  return Array.from(new Set(MODELS.map((model) => model.provider)));
}

// Default model configuration
export const DEFAULT_MODEL = "openai:gpt-4o";

// Enhanced model utilities
export function getModelCapabilities(
  modelId: string,
): ModelCapabilities | undefined {
  const model = getModelById(modelId);
  return model?.capabilities;
}

export function getModelSupportedTools(modelId: string): ToolType[] {
  const model = getModelById(modelId);
  return model?.supportedTools || [];
}

export function getModelDefaultTools(modelId: string): ToolType[] {
  const model = getModelById(modelId);
  return model?.defaultTools || [];
}

export function isModelCapable(
  modelId: string,
  capability: keyof ModelCapabilities,
): boolean {
  const capabilities = getModelCapabilities(modelId);
  return Boolean(capabilities?.[capability]) || false;
}

// Reasoning models that should use the responses API
const REASONING_MODELS = ["gpt-5", "o3", "o4-mini", "o1", "o3-mini"];

// Check if a model is a reasoning model
function isReasoningModel(modelName: string): boolean {
  return REASONING_MODELS.some((reasoningModel) =>
    modelName.includes(reasoningModel),
  );
}

// Check if a model supports reasoning based on its capabilities
export function modelSupportsReasoning(modelId: string): boolean {
  const capabilities = getModelCapabilities(modelId);
  return Boolean(capabilities?.supportsReasoning);
}

// Resolve language model
export function getLanguageModel(modelId: string) {
  if (modelId.startsWith("google:")) {
    const modelName = modelId.replace("google:", "");
    return google(modelName as any);
  }

  if (modelId.startsWith("openai:")) {
    const modelName = modelId.replace("openai:", "");
    // Use responses API for reasoning models
    if (isReasoningModel(modelName)) {
      return openai.responses(modelName as any);
    }
    return openai(modelName as any);
  }

  if (modelId.startsWith("anthropic:")) {
    const modelName = modelId.replace("anthropic:", "");
    return anthropic(modelName as any);
  }

  // Fallback: use default model
  if (DEFAULT_MODEL.startsWith("openai:")) {
    const fallbackModelName = DEFAULT_MODEL.replace("openai:", "");
    if (isReasoningModel(fallbackModelName)) {
      return openai.responses(fallbackModelName as any);
    }
    return openai(fallbackModelName as any);
  }

  return google(DEFAULT_MODEL.replace("google:", "") as any);
}
