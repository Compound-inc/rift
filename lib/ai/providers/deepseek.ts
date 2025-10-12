/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BaseModelConfig,
  mergeCapabilities,
  DEFAULT_PROVIDER_SETTINGS,
  ToolType,
} from "../config/base";

// DeepSeek-specific settings interface
export interface DeepSeekSettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
  // DeepSeek-specific options
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

// Default DeepSeek settings
export const DEFAULT_DEEPSEEK_SETTINGS: DeepSeekSettings = {
  ...DEFAULT_PROVIDER_SETTINGS,
  parallelToolCalls: true,
  store: true,
  structuredOutputs: true,
  maxRetries: 3,
};

// DeepSeek model configurations
export const DEEPSEEK_MODELS: BaseModelConfig[] = [
  {
    id: "deepseek/deepseek-v3.1",
    name: "DeepSeek V3.1",
    provider: "deepseek",
    description: "El modelo insignia más reciente con capacidades avanzadas de razonamiento y soporte multimodal",
    contextWindow: 164000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "deepseek/deepseek-v3",
    name: "DeepSeek V3",
    provider: "deepseek",
    description: "Modelo de alto rendimiento con fuertes capacidades en múltiples dominios",
    contextWindow: 164000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: false,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
];

// Helper functions
export function getDeepSeekModel(modelId: string): BaseModelConfig | undefined {
  return DEEPSEEK_MODELS.find((model) => model.id === modelId);
}

// Reasoning helper functions
export function supportsReasoning(modelId: string): boolean {
  const model = getDeepSeekModel(modelId);
  return model?.capabilities.supportsReasoning || false;
}

export function getReasoningSettings(
  modelId: string,
  enabled: boolean = true,
): Partial<DeepSeekSettings> {
  if (!supportsReasoning(modelId)) {
    return {};
  }

  return {
    // DeepSeek reasoning configuration would go here if needed
    // For now, just return empty object as reasoning is handled by the model itself
  };
}
