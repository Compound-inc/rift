/* eslint-disable @typescript-eslint/no-explicit-any */

import { openai as originalOpenAI, createOpenAI } from "@ai-sdk/openai";
import { mistral as originalMistral } from "@ai-sdk/mistral";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createProviderRegistry, customProvider } from "ai";

// Model configuration types
export type ModelConfig = {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
  pricing: {
    input: number; // per 1M tokens
    output: number; // per 1M tokens
  };
  isPremium: boolean;
};

// Available models configuration
export const MODELS: ModelConfig[] = [
  // OpenAI Models
  {
    id: "openai:gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "OpenAI's flagship model, versatile and powerful",
    contextWindow: 128000,
    pricing: { input: 2.5, output: 10 },
    isPremium: true,
  },
  {
    id: "openai:gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Faster, cost-effective GPT-4o variant",
    contextWindow: 128000,
    pricing: { input: 0.15, output: 0.6 },
    isPremium: true,
  },
  {
    id: "openai:gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    description: "High-performance model with latest knowledge",
    contextWindow: 128000,
    pricing: { input: 10, output: 30 },
    isPremium: true,
  },

  // Mistral Models
  {
    id: "mistral:mistral-large-latest",
    name: "Mistral Large",
    provider: "mistral",
    description: "Flagship model for complex reasoning",
    contextWindow: 128000,
    pricing: { input: 2, output: 6 },
    isPremium: false,
  },
  {
    id: "mistral:mistral-small-latest",
    name: "Mistral Small",
    provider: "mistral",
    description: "Cost-effective model for simple tasks",
    contextWindow: 128000,
    pricing: { input: 0.2, output: 0.6 },
    isPremium: false,
  },

  // OpenRouter Models (Popular ones)
  {
    id: "openrouter:anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet (OpenRouter)",
    provider: "openrouter",
    description: "Anthropic's Claude via OpenRouter - flexible pricing",
    contextWindow: 200000,
    pricing: { input: 3, output: 15 },
    isPremium: true,
  },
  {
    id: "openrouter:openai/gpt-4o",
    name: "GPT-4o (OpenRouter)",
    provider: "openrouter",
    description: "OpenAI's GPT-4o via OpenRouter - competitive pricing",
    contextWindow: 128000,
    pricing: { input: 2.5, output: 10 },
    isPremium: true,
  },
  {
    id: "openrouter:meta-llama/llama-3.1-405b-instruct",
    name: "Llama 3.1 405B",
    provider: "openrouter",
    description: "Meta's largest open model via OpenRouter",
    contextWindow: 131072,
    pricing: { input: 3, output: 3 },
    isPremium: true,
  },
  {
    id: "openrouter:google/gemini-pro-1.5",
    name: "Gemini Pro 1.5 (OpenRouter)",
    provider: "openrouter",
    description: "Google's Gemini via OpenRouter with flexible access",
    contextWindow: 2000000,
    pricing: { input: 1.25, output: 5 },
    isPremium: true,
  },
  {
    id: "openrouter:google/gemini-flash-1.5",
    name: "Gemini Flash 1.5 (OpenRouter)",
    provider: "openrouter",
    description: "Google's fast Gemini model via OpenRouter",
    contextWindow: 1000000,
    pricing: { input: 0.075, output: 0.3 },
    isPremium: true,
  },
  {
    id: "openrouter:openai/gpt-oss-20b:free",
    name: "GPT-OSS 20B (Free)",
    provider: "openrouter",
    description: "Open-source GPT model with 20B parameters - completely free",
    contextWindow: 8192,
    pricing: { input: 0, output: 0 },
    isPremium: false,
  },
];

// Custom providers with model aliases
export const openai = customProvider({
  languageModels: {
    "gpt-4o": originalOpenAI("gpt-4o", {
      structuredOutputs: true,
    }),
    "gpt-4o-mini": originalOpenAI("gpt-4o-mini", {
      structuredOutputs: true,
    }),
    "gpt-4-turbo": originalOpenAI("gpt-4-turbo"),
    // Aliases for easier access
    flagship: originalOpenAI("gpt-4o", {
      structuredOutputs: true,
    }),
    fast: originalOpenAI("gpt-4o-mini", {
      structuredOutputs: true,
    }),
  },
  fallbackProvider: originalOpenAI,
});

export const mistral = customProvider({
  languageModels: {
    "mistral-large-latest": originalMistral("mistral-large-latest"),
    "mistral-small-latest": originalMistral("mistral-small-latest"),
    // Aliases
    large: originalMistral("mistral-large-latest"),
    small: originalMistral("mistral-small-latest"),
  },
  fallbackProvider: originalMistral,
});

// OpenRouter provider with environment variable support
export const openrouter = customProvider({
  languageModels: {
    "anthropic/claude-3.5-sonnet": createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
    })("anthropic/claude-3.5-sonnet"),
    "openai/gpt-4o": createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
    })("openai/gpt-4o"),
    "meta-llama/llama-3.1-405b-instruct": createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
    })("meta-llama/llama-3.1-405b-instruct"),
    "google/gemini-pro-1.5": createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
    })("google/gemini-pro-1.5"),
    "google/gemini-flash-1.5": createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
    })("google/gemini-flash-1.5"),
    "openai/gpt-oss-20b:free": createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
    })("openai/gpt-oss-20b:free"),
  },
fallbackProvider: createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY || "",
  }) as any,
});

// Provider registry - Now includes OpenRouter with environment variable support
export const registry = createProviderRegistry(
  {
    mistral,
    openrouter,
  },
  { separator: ":" },
);

// Helper functions
export function getModelById(modelId: string): ModelConfig | undefined {
  return MODELS.find((model) => model.id === modelId);
}

export function getModelsByProvider(provider: string): ModelConfig[] {
  return MODELS.filter((model) => model.provider === provider);
}

export function getAllProviders(): string[] {
  return Array.from(new Set(MODELS.map((model) => model.provider)));
}

// Default model configuration - Changed to use OpenRouter for free access
export const DEFAULT_MODEL = "openrouter:openai/gpt-oss-20b:free";

// Create custom OpenAI provider with user's API key
export function createCustomOpenAIProvider(apiKey: string) {
  const customOpenAI = createOpenAI({
    apiKey: apiKey,
    compatibility: "strict",
  });

  return customProvider({
    languageModels: {
      "gpt-4o": customOpenAI("gpt-4o", {
        structuredOutputs: true,
      }),
      "gpt-4o-mini": customOpenAI("gpt-4o-mini", {
        structuredOutputs: true,
      }),
      "gpt-4-turbo": customOpenAI("gpt-4-turbo"),
      // Aliases for easier access
      flagship: customOpenAI("gpt-4o", {
        structuredOutputs: true,
      }),
      fast: customOpenAI("gpt-4o-mini", {
        structuredOutputs: true,
      }),
    },
    fallbackProvider: customOpenAI,
  });
}

// Create custom OpenRouter provider with user's API key
export function createCustomOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey: apiKey,
  });
}

// Get language model from registry or custom provider
export function getLanguageModel(
  modelId: string,
  customApiKeys?: { openai?: string; openrouter?: string },
) {
  // Priority 1: If user provided OpenAI API key and is using OpenAI model, use custom provider
  if (customApiKeys?.openai && modelId.startsWith("openai:")) {
    const customProvider = createCustomOpenAIProvider(customApiKeys.openai);
    const modelName = modelId.replace("openai:", "");
    return customProvider.languageModel(modelName as any);
  }

  // Priority 2: If user provided OpenRouter API key and is using OpenRouter model, use custom provider
  if (customApiKeys?.openrouter && modelId.startsWith("openrouter:")) {
    const openrouterProvider = createCustomOpenRouterProvider(
      customApiKeys.openrouter,
    );
    const modelName = modelId.replace("openrouter:", "");
    return openrouterProvider.chat(modelName as any);
  }

  // Priority 3: Use environment variable for OpenRouter if available and no custom key provided
  if (modelId.startsWith("openrouter:") && process.env.OPENROUTER_API_KEY) {
    const modelName = modelId.replace("openrouter:", "");
    return openrouter.languageModel(modelName as any);
  }

  // Priority 4: Otherwise use the default registry (Mistral with env vars)
  return registry.languageModel(modelId as any);
}
