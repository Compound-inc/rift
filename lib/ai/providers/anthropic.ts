/* eslint-disable @typescript-eslint/no-explicit-any */

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
  maxRetries: 3,
};

// Anthropic model configurations
export const ANTHROPIC_MODELS: BaseModelConfig[] = [
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    description: "Claude Sonnet 4.5 is the newest model in the Sonnet series, offering improvements and updates over Sonnet 4",
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
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    description: "The model balances performance and efficiency with enhanced steerability",
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
    id: "anthropic/claude-sonnet-3.7",
    name: "Claude Sonnet 3.7",
    provider: "anthropic",
    description: "It delivers state-of-the-art performance for coding, content generation, data analysis, and planning tasks,",
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
  {
    id: "anthropic/claude-sonnet-3.5",
    name: "Claude Sonnet 3.5",
    provider: "anthropic",
    description: "The ideal balance between intelligence and speed",
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
    id: "anthropic/claude-3.5-haiku",
    name: "Claude Haiku 3.5",
    provider: "anthropic",
    description: "Haiku 3.5 is the next generation of Anthropic's fastest model.",
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
  {
    id: "anthropic/claude-3-haiku",
    name: "Claude Haiku 3",
    provider: "anthropic",
    description: "Haiku 3 quickly analyzes large volumes of documents, such as quarterly filings, contracts, or legal cases,",
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
