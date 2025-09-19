import { createProviderRegistry } from "ai";
import { OPENAI_MODELS, createOpenAIProvider } from "./providers/openai";
import { type BaseModelConfig, type ModelCapabilities } from "./config/base";

// All models in one array
export const MODELS: BaseModelConfig[] = OPENAI_MODELS;

// AI SDK registry
export const registry = createProviderRegistry({
  openai: createOpenAIProvider(),
});

// Model resolution with simple mapping
const SHORTCUTS: Record<string, string> = {
  "recommended-chat": "openai:gpt-4o-mini",
  "recommended-premium": "openai:gpt-5",
  "recommended-reasoning": "openai:o3",
  "recommended-fast": "openai:gpt-3.5-turbo",
  "recommended-vision": "openai:gpt-4o",
};

// Core functions - ultra compact
export const resolveModel = (id: string): string => {
  if (SHORTCUTS[id]) return SHORTCUTS[id];
  if (id.includes(":")) return id;
  if (id.startsWith("openai/")) return id.replace("/", ":");
  return `openai:${id}`;
};

export const getModel = (id: string) =>
  MODELS.find((m) => m.id === resolveModel(id).replace(":", "/"));

export const getCapabilities = (id: string) => getModel(id)?.capabilities;

export const isCapable = (id: string, cap: keyof ModelCapabilities) =>
  Boolean(getCapabilities(id)?.[cap]);

export const isPremium = (id: string) => getModel(id)?.isPremium || false;

export const supportsReasoning = (id: string) =>
  isCapable(id, "supportsReasoning");

// Main model creation function
export function getLanguageModel(modelId: string) {
  const resolved = resolveModel(modelId);
  const registryId = resolved.replace("/", ":");

  console.log(`Model resolution: ${modelId} → ${resolved} → ${registryId}`);

  try {
    return registry.languageModel(registryId as `openai:${string}`);
  } catch {
    console.warn(
      `Model ${modelId} not found in registry, using default gpt-4o-mini`,
    );
    return registry.languageModel("openai:gpt-4o-mini");
  }
}

// Default provider options for reasoning models
export const getProviderOptions = (modelId: string) => {
  const baseOptions = {
    store: true,
    parallelToolCalls: true,
    structuredOutputs: true,
  };

  return {
    openai: supportsReasoning(modelId)
      ? {
          ...baseOptions,
          reasoningEffort: "medium" as const,
          reasoningSummary: "detailed" as const,
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
export const DEFAULT_MODEL = "openai:gpt-4o-mini";

// Backward compatibility aliases
export const getModelById = getModel;
export const resolveRecommendedModel = resolveModel;
export const isModelPremium = isPremium;
export const modelSupportsReasoning = supportsReasoning;
export const getModelCapabilities = getCapabilities;
export const isModelCapable = isCapable;
export const getDefaultProviderOptions = getProviderOptions;
