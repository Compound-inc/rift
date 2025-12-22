import { createGateway } from "@ai-sdk/gateway";
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
import { GATEWAY_CONFIG } from "./config/base";

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

// Configure gateway provider with app attribution headers
const gatewayApiKey = process.env.AI_GATEWAY_API_KEY ?? GATEWAY_CONFIG.apiKey;
const normalizeGatewayBaseURL = (value: string) => {
  const trimmed = value.replace(/\/+$/, "");
  // Common misconfig: using `.../v1` instead of `.../v1/ai`
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/ai`;
  }
  return trimmed;
};
const gatewayBaseURL = normalizeGatewayBaseURL(
  process.env.AI_GATEWAY_BASE_URL ?? GATEWAY_CONFIG.baseURL
);

export const gateway = createGateway({
  apiKey: gatewayApiKey,
  baseURL: gatewayBaseURL,
  headers: {
    "http-referer": "https://rift.mx",
    "x-title": "Rift",
  },
});

globalThis.AI_SDK_DEFAULT_PROVIDER = gateway;

// Model resolution
const SHORTCUTS: Record<string, string> = {
  automatico: "openai/gpt-5.1-instant",
  problemas_dificiles: "openai/gpt-5.1-thinking",
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

  // When using the AI Gateway, a missing API key usually results in confusing
  // downstream failures (e.g. unexpected empty responses during streaming).
  // Fail fast with a clear error message in production.
  if (process.env.NODE_ENV === "production" && !gatewayApiKey) {
    throw new Error(
      "AI Gateway is enabled but AI_GATEWAY_API_KEY is not set. Set AI_GATEWAY_API_KEY in your Vercel project env vars (Production/Preview) or disable the gateway provider."
    );
  }

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
          reasoningEffort: "low" as const,
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
          effort: "low" as const,
        }
      : baseOptions,
    google: isGoogleModel && supportsReasoning(modelId)
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

