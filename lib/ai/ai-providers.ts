// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import { google } from "@ai-sdk/google";
import { createProviderRegistry } from "ai";

// Model configuration types
export type ModelConfig = {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
  pricing: {
    input: number; // per 1M tokens (informational only)
    output: number; // per 1M tokens (informational only)
  };
  isPremium: boolean;
};

// Available models configuration (Google only)
export const MODELS: ModelConfig[] = [
  {
    id: "google:gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description:
      "Google's latest fast model with strong capabilities and web search grounding.",
    contextWindow: 1048576,
    pricing: { input: 0, output: 0 },
    isPremium: false,
  },
  {
    id: "google:gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description:
      "Google's higher quality model with advanced reasoning and tool use.",
    contextWindow: 1048576,
    pricing: { input: 0, output: 0 },
    isPremium: true,
  },
  {
    id: "google:gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Fast, cost-effective, multi-modal model.",
    contextWindow: 1048576,
    pricing: { input: 0, output: 0 },
    isPremium: false,
  },
  {
    id: "google:gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    provider: "google",
    description: "Popular fast model with tool calling and multi-modal input.",
    contextWindow: 1048576,
    pricing: { input: 0, output: 0 },
    isPremium: false,
  },
];

// Provider registry (not strictly necessary, but kept for API symmetry)
export const registry = createProviderRegistry({}, { separator: ":" });

// Helpers for UI
export function getModelById(modelId: string): ModelConfig | undefined {
  return MODELS.find((model) => model.id === modelId);
}

export function getModelsByProvider(provider: string): ModelConfig[] {
  return MODELS.filter((model) => model.provider === provider);
}

export function getAllProviders(): string[] {
  return Array.from(new Set(MODELS.map((model) => model.provider)));
}

// Default model configuration (Google)
export const DEFAULT_MODEL = "google:gemini-2.5-flash";

// Resolve language model (Google only)
export function getLanguageModel(
  modelId: string,
  _customApiKeys?: { google?: string },
) {
  if (modelId.startsWith("google:")) {
    const modelName = modelId.replace("google:", "");
    return google(modelName as any);
  }
  // Fallback: use default Google model
  return google(DEFAULT_MODEL.replace("google:", "") as any);
}
