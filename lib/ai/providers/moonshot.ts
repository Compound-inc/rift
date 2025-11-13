/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BaseModelConfig,
  mergeCapabilities,
  DEFAULT_PROVIDER_SETTINGS,
} from "../config/base";

// Moonshot AI-specific settings interface
export interface MoonshotSettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
  // Moonshot-specific options
  parallelToolCalls?: boolean;
}

// Default Moonshot settings
export const DEFAULT_MOONSHOT_SETTINGS: MoonshotSettings = {
  ...DEFAULT_PROVIDER_SETTINGS,
  parallelToolCalls: true,
  maxRetries: 3,
};

// Moonshot AI model configurations
export const MOONSHOT_MODELS: BaseModelConfig[] = [
  {
    id: "moonshotai/kimi-k2",
    name: "Kimi K2",
    provider: "moonshotai",
    description:
      "Modelo versátil de Moonshot AI optimizado para código y razonamiento",
    contextWindow: 131072,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "moonshotai",
    description:
      "Modelo de razonamiento avanzado para resolver problemas complejos paso a paso",
    contextWindow: 262144,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      maxTokens: 16384,
    }),
  },
];

// Helper functions
export function getMoonshotModel(modelId: string): BaseModelConfig | undefined {
  return MOONSHOT_MODELS.find((model) => model.id === modelId);
}
