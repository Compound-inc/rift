// Base configuration types for AI providers
export interface ModelCapabilities {
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsReasoning: boolean;
  supportsImageInput: boolean;
  supportsImageOutput: boolean;
  supportsPDFInput: boolean;
  supportsAudioInput: boolean;
  supportsObjectGeneration: boolean;
  maxTokens?: number;
}

// Base model configuration interface
export interface BaseModelConfig {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;

  isPremium: boolean;
  capabilities: ModelCapabilities;
  settings?: Record<string, any>;
}

// Provider configuration interface
export interface ProviderConfig {
  name: string;
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  defaultSettings: Record<string, any>;
  models: BaseModelConfig[];
  tools: Record<string, any>;
  createProvider: (config?: any) => any;
}

// Base provider settings that can be extended by specific providers
export interface BaseProviderSettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
}

// Default provider settings
export const DEFAULT_PROVIDER_SETTINGS: BaseProviderSettings = {
  temperature: 0.7,
  maxOutputTokens: 4096,
  topP: 0.95,
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxRetries: 3,
  timeout: 60000,
};

// Gateway configuration for AI SDK
export const GATEWAY_CONFIG = {
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: `https://ai-gateway.vercel.sh/v1`,
};

// Tool types that can be used across providers
export type ToolType = "none" | "web_search";

// Base tool configuration interface
export interface BaseToolConfig {
  type: ToolType;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  category:
    | "none"
    | "search"
    | "context"
    | "computation"
    | "media"
    | "analysis";
  requiresAuth: boolean;
  parameters?: Record<string, any>;
}

// Base tool configurations
export const BASE_TOOL_CONFIGS: Record<ToolType, BaseToolConfig> = {
  none: {
    type: "none",
    name: "None",
    description: "No tools enabled",
    icon: "X",
    category: "none",
    requiresAuth: false,
  },
  web_search: {
    type: "web_search",
    name: "Web Search",
    description: "Search the web for real-time information",
    icon: "Search",
    category: "search",
    requiresAuth: false,
  },
};

// Utility functions for merging configurations
export function mergeCapabilities(
  base: Partial<ModelCapabilities>,
  override?: Partial<ModelCapabilities>,
): ModelCapabilities {
  const defaultCapabilities: ModelCapabilities = {
    supportsTools: false,
    supportsStreaming: true,
    supportsReasoning: false,
    supportsImageInput: false,
    supportsImageOutput: false,
    supportsPDFInput: false,
    supportsAudioInput: false,
    supportsObjectGeneration: true,
  };

  return {
    ...defaultCapabilities,
    ...base,
    ...override,
  };
}

export function mergeSettings<T extends Record<string, any>>(
  base: T,
  override?: Partial<T>,
): T {
  return {
    ...base,
    ...override,
  };
}

// Helper function to create model ID with provider prefix
export function createModelId(provider: string, modelName: string): string {
  return `${provider}/${modelName}`;
}
