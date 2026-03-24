import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { OPENAI_MODELS } from "./providers/openai";
import { XAI_MODELS } from "./providers/xai";
import { ANTHROPIC_MODELS } from "./providers/anthropic";
import { GOOGLE_MODELS, getReasoningSettings } from "./providers/google";
import { DEEPSEEK_MODELS } from "./providers/deepseek";
import { MISTRAL_MODELS } from "./providers/mistral";
import { MOONSHOT_MODELS } from "./providers/moonshot";
import { ZAI_MODELS } from "./providers/zai";
import { PRIME_INTELLECT_MODELS } from "./providers/prime-intellect";
import { type BaseModelConfig, type ModelCapabilities } from "./config/base";

// All models in one array
export const MODELS: BaseModelConfig[] = [
  ...OPENAI_MODELS,
  ...XAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...GOOGLE_MODELS,
  ...DEEPSEEK_MODELS,
  ...MISTRAL_MODELS,
  ...MOONSHOT_MODELS,
  ...ZAI_MODELS,
  ...PRIME_INTELLECT_MODELS,
];

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  moonshotai: "Moonshot",
  zai: "Z.AI",
  "prime-intellect": "Prime Intellect",
};

const toTitleCase = (value: string) =>
  value
    .split(/[-_/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getProviderDisplayName = (provider?: string) => {
  if (!provider) {
    return "your provider";
  }
  return PROVIDER_DISPLAY_NAMES[provider] ?? toTitleCase(provider);
};

// Configure OpenRouter provider
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

globalThis.AI_SDK_DEFAULT_PROVIDER = openrouter.chat;

// Model resolution
const SHORTCUTS: Record<string, string> = {
  automatico: "openai/gpt-5.4-nano",
  problemas_dificiles: "openai/gpt-5.1-thinking",
  escritura: "moonshotai/kimi-k2",
  imagen: "google/gemini-2.5-flash-image",
};

// Simple model resolution
export const resolveModel = (id: string): string => {
  return SHORTCUTS[id] || id;
};

export function getModelShortcutDisplayName(modelId: string): string | null {
  const resolved = resolveModel(modelId);
  for (const [key, value] of Object.entries(SHORTCUTS)) {
    if (value === resolved) {
      return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  return null;
}

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

  console.log(`Model via OpenRouter: ${resolved}`);

  try {
    return openrouter.chat(resolved);
  } catch {
    console.warn(
      `Model ${modelId} not found in registry, using default default model`,
    );
    return openrouter.chat(DEFAULT_MODEL);
  }
}

// Default provider options for reasoning models
export const getProviderOptions = (
  modelId: string,
  hasTools: boolean = false,
  userId?: string,
) => {
  const baseOptions = {
    store: true,
    ...(hasTools ? { parallelToolCalls: true } : {}),
    structuredOutputs: true,
  };

  const isAnthropicModel = modelId.startsWith("anthropic/");
  const isOpenAIModel = modelId.startsWith("openai/");
  const isGoogleModel = modelId.startsWith("google/");

  const openaiBaseOptions = {
    store: true,
    ...(hasTools ? { parallelToolCalls: true } : {}),
  };

  return {
    ...(userId ? { openrouter: { user: userId } } : {}),
    openai:
      isOpenAIModel && supportsReasoning(modelId)
        ? {
            ...openaiBaseOptions,
            reasoningSummary: "detailed" as const,
          }
        : openaiBaseOptions,
    anthropic:
      isAnthropicModel && supportsReasoning(modelId)
        ? {
            ...baseOptions,
            thinking: {
              type: "enabled" as const,
              budgetTokens: 3200,
            },
            effort: "low" as const,
          }
        : baseOptions,
    google:
      isGoogleModel && supportsReasoning(modelId)
        ? {
            ...baseOptions,
            ...getReasoningSettings(modelId),
          }
        : baseOptions,
    moonshotai: baseOptions,
    zai: baseOptions,
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
export const getProviderName = getProviderDisplayName;
