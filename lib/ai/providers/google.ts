/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BaseModelConfig,
  mergeCapabilities,
  DEFAULT_PROVIDER_SETTINGS,
  ToolType,
} from "../config/base";

// Google-specific settings interface
export interface GoogleSettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
  // Google-specific options
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
  // Google Gemini specific options
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
  };
  // Google Gemini thinking/reasoning config
  thinkingConfig?: {
    thinkingBudget?: number;
    includeThoughts?: boolean;
  };
}

// Default Google settings
export const DEFAULT_GOOGLE_SETTINGS: GoogleSettings = {
  ...DEFAULT_PROVIDER_SETTINGS,
  parallelToolCalls: true,
  store: true,
  structuredOutputs: true,
  maxRetries: 3,
  safetySettings: [
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
  ],
  generationConfig: {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
  },
};

// Google model configurations
export const GOOGLE_MODELS: BaseModelConfig[] = [
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    provider: "google",
    description: "El modelo más inteligente de Google que supera a GPT-5 en benchmarks",
    contextWindow: 200000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsPDFInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "El modelo Gemini de razonamiento más avanzado de Google, capaz de resolver problemas complejos",
    contextWindow: 2000000,
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
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Modelo de pensamiento que ofrece capacidades completas avanzadas",
    contextWindow: 1000000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Características de próxima generación con capacidades mejoradas",
    contextWindow: 1000000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "google/gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    provider: "google",
    description: "Modelo ligero con capacidades optimizadas",
    contextWindow: 1000000,
    isPremium: false,
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
export function getGoogleModel(modelId: string): BaseModelConfig | undefined {
  return GOOGLE_MODELS.find((model) => model.id === modelId);
}

// Reasoning helper functions
export function supportsReasoning(modelId: string): boolean {
  const model = getGoogleModel(modelId);
  return model?.capabilities.supportsReasoning || false;
}

export function getReasoningSettings(
  modelId: string,
  enabled: boolean = true,
): Partial<GoogleSettings> {
  if (!supportsReasoning(modelId)) {
    return {};
  }

  return {
    thinkingConfig: {
      thinkingBudget: 3200,
      includeThoughts: true,
    },
  };
}
