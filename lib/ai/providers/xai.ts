/* eslint-disable @typescript-eslint/no-explicit-any */

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
    id: "xai/grok-4",
    name: "Grok 4",
    provider: "xai",
    description:
      "Latest flagship model offering unparalleled performance in natural language, math and reasoning",
    contextWindow: 256000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "xai/grok-code-fast-1",
    name: "Grok Code Fast 1",
    provider: "xai",
    description:
      "Speedy and economical reasoning model that excels at agentic coding tasks",
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
    id: "xai/grok-4-fast-non-reasoning",
    name: "Grok 4 Fast",
    provider: "xai",
    description:
      "Latest multimodal model with SOTA cost-efficiency and 2M token context window. ",
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
  {
    id: "xai/grok-3",
    name: "Grok 3",
    provider: "xai",
    description:
      "Advanced model with strong capabilities across multiple domains",
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
      "Lightweight reasoning model. Fast, smart, and great for logic-based tasks",
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

