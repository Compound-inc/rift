import { createGateway } from "@ai-sdk/gateway";
import { OPENAI_MODELS } from "./providers/openai";
import { XAI_MODELS } from "./providers/xai";
import { ANTHROPIC_MODELS } from "./providers/anthropic";
import { GOOGLE_MODELS, getReasoningSettings } from "./providers/google";
import { DEEPSEEK_MODELS } from "./providers/deepseek";
import { MISTRAL_MODELS } from "./providers/mistral";
import { type BaseModelConfig, type ModelCapabilities } from "./config/base";

// All models in one array
export const MODELS: BaseModelConfig[] = [...OPENAI_MODELS, ...XAI_MODELS, ...ANTHROPIC_MODELS, ...GOOGLE_MODELS, ...DEEPSEEK_MODELS, ...MISTRAL_MODELS];

// Configure gateway provider with app attribution headers
export const gateway = createGateway({
  headers: {
    'http-referer': 'https://rift.mx',
    'x-title': 'Rift',
  },
});

globalThis.AI_SDK_DEFAULT_PROVIDER = gateway;

// Model resolution
const SHORTCUTS: Record<string, string> = {
  automatico: "openai/gpt-5-mini",
  problemas_dificiles: "openai/gpt-5",
  escritura: "google/gemini-2.5-flash",
  sorpresa: "mistral/mistral-medium",
};

// Simple model resolution
export const resolveModel = (id: string): string => {
  return SHORTCUTS[id] || id;
};

export const getModel = (id: string) =>
  MODELS.find((m) => m.id === resolveModel(id));

export const getCapabilities = (id: string) => getModel(id)?.capabilities;

export const isCapable = (id: string, cap: keyof ModelCapabilities) =>
  Boolean(getCapabilities(id)?.[cap]);

export const isPremium = (id: string) => getModel(id)?.isPremium || false;

export const supportsReasoning = (id: string) =>
  isCapable(id, "supportsReasoning");

// Main model creation function
export function getLanguageModel(modelId: string) {
  const resolved = resolveModel(modelId);

  console.log(`Model via AI Gateway: ${resolved}`);

  try {
    return gateway(resolved);
  } catch {
    console.warn(
      `Model ${modelId} not found in registry, using default default model`,
    );
    return gateway(DEFAULT_MODEL);
  }
}

// Default provider options for reasoning models
export const getProviderOptions = (modelId: string) => {
  const baseOptions = {
    store: true,
    parallelToolCalls: true,
    structuredOutputs: true,
  };

  const isAnthropicModel = modelId.startsWith("anthropic/");
  const isOpenAIModel = modelId.startsWith("openai/");
  const isGoogleModel = modelId.startsWith("google/");

  return {
    openai: isOpenAIModel && supportsReasoning(modelId)
      ? {
          ...baseOptions,
          reasoningEffort: "medium" as const,
          reasoningSummary: "detailed" as const,
        }
      : baseOptions,
    anthropic: isAnthropicModel && supportsReasoning(modelId)
      ? {
          ...baseOptions,
          thinking: {
            type: "enabled" as const,
            budgetTokens: 3200,
          },
        }
      : baseOptions,
    google: isGoogleModel && supportsReasoning(modelId)
      ? {
          ...baseOptions,
          ...getReasoningSettings(modelId),
        }
      : baseOptions,
  };
};

// Additional utility functions
export const getModelsByProvider = (provider: string): BaseModelConfig[] =>
  MODELS.filter((model) => model.provider === provider);

export const getAllProviders = (): string[] =>
  Array.from(new Set(MODELS.map((model) => model.provider)));

// Default model constant
export const DEFAULT_MODEL = "openai/gpt-oss-120b";

// Backward compatibility aliases
export const getModelById = getModel;
export const resolveRecommendedModel = resolveModel;
export const isModelPremium = isPremium;
export const modelSupportsReasoning = supportsReasoning;
export const getModelCapabilities = getCapabilities;
export const isModelCapable = isCapable;
export const getDefaultProviderOptions = getProviderOptions;

