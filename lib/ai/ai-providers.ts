import { gateway } from "ai";
import { OPENAI_MODELS } from "./providers/openai";
import { XAI_MODELS } from "./providers/xai";
import { ANTHROPIC_MODELS } from "./providers/anthropic";
import { GOOGLE_MODELS } from "./providers/google";
import { DEEPSEEK_MODELS } from "./providers/deepseek";
import { type BaseModelConfig, type ModelCapabilities } from "./config/base";

// All models in one array
export const MODELS: BaseModelConfig[] = [...OPENAI_MODELS, ...XAI_MODELS, ...ANTHROPIC_MODELS, ...GOOGLE_MODELS, ...DEEPSEEK_MODELS];

const gatewayProvider = gateway;

// Model resolution
const SHORTCUTS: Record<string, string> = {
  automatico: "openai/gpt-4o-mini",
  problemas_dificiles: "openai/o3",
  escritura: "openai/gpt-4o",
  sorpresa: "openai/gpt-5",
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
    return gatewayProvider(resolved);
  } catch {
    console.warn(
      `Model ${modelId} not found in registry, using default gpt-4o-mini`,
    );
    return gatewayProvider("openai/gpt-4o-mini");
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
          thinkingConfig: {
            thinkingBudget: 3200,
            includeThoughts: true,
          },
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
export const DEFAULT_MODEL = "openai/gpt-4o-mini";

// Backward compatibility aliases
export const getModelById = getModel;
export const resolveRecommendedModel = resolveModel;
export const isModelPremium = isPremium;
export const modelSupportsReasoning = supportsReasoning;
export const getModelCapabilities = getCapabilities;
export const isModelCapable = isCapable;
export const getDefaultProviderOptions = getProviderOptions;

