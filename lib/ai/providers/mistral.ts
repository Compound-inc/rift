import {
  BaseModelConfig,
  mergeCapabilities,
  DEFAULT_PROVIDER_SETTINGS,
  ToolType,
} from "../config/base";

// Mistral-specific settings interface
export interface MistralSettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
  // Mistral-specific options
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

// Default Mistral settings
export const DEFAULT_MISTRAL_SETTINGS: MistralSettings = {
  ...DEFAULT_PROVIDER_SETTINGS,
  parallelToolCalls: true,
  store: true,
  structuredOutputs: true,
  maxRetries: 3,
};

// Mistral model configurations
export const MISTRAL_MODELS: BaseModelConfig[] = [
  {
    id: "mistral/devstral-2",
    name: "Devstral 2",
    provider: "mistral",
    description: "Modelo empresarial optimizado para agentes de ingeniería de software con fuerte uso de herramientas.",
    contextWindow: 128000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 256000,
    }),
  },
  {
    id: "mistral/mistral-medium",
    name: "Mistral Medium",
    provider: "mistral",
    description: "Modelo de Mistral con rendimiento de vanguardia",
    contextWindow: 128000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "mistral/codestral",
    name: "Mistral Codestral",
    provider: "mistral",
    description: "Modelo de programación de vanguardia optimizado para uso de baja latencia y alta frecuencia",
    contextWindow: 256000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
];

// Helper functions
export function getMistralModel(modelId: string): BaseModelConfig | undefined {
  return MISTRAL_MODELS.find((model) => model.id === modelId);
}
