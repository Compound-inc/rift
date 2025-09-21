/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BaseModelConfig,
  mergeCapabilities,
  DEFAULT_PROVIDER_SETTINGS,
  ToolType,
} from "../config/base";

// OpenAI-specific settings interface
export interface OpenAISettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
  // OpenAI-specific options
  parallelToolCalls?: boolean;
  store?: boolean;
  user?: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  reasoningSummary?: "auto" | "detailed";
  strictJsonSchema?: boolean;
  serviceTier?: "auto" | "flex" | "priority";
  textVerbosity?: "low" | "medium" | "high";
  maxToolCalls?: number;
  metadata?: Record<string, string>;
  previousResponseId?: string;
  instructions?: string;
  include?: string[];
  promptCacheKey?: string;
  safetyIdentifier?: string;
  structuredOutputs?: boolean;
  maxCompletionTokens?: number;
  prediction?: Record<string, any>;
  logitBias?: Record<number, number>;
  logprobs?: boolean | number;
}

// Default OpenAI settings
export const DEFAULT_OPENAI_SETTINGS: OpenAISettings = {
  ...DEFAULT_PROVIDER_SETTINGS,
  parallelToolCalls: true,
  store: true,
  reasoningEffort: "medium",
  strictJsonSchema: false,
  serviceTier: "auto",
  textVerbosity: "medium",
  structuredOutputs: true,
  maxRetries: 3,
};

// OpenAI tool implementations
export const OPENAI_TOOLS = {
  web_search: (config?: any) => ({
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Search the web for real-time information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
        },
        required: ["query"],
      },
    },
    ...config,
  }),
  file_search: (config?: {
    vectorStoreIds?: string[];
    maxNumResults?: number;
    filters?: any;
    ranking?: any;
  }) => ({
    type: "function" as const,
    function: {
      name: "file_search",
      description: "Search through uploaded documents and files",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query for file contents",
          },
          vectorStoreIds: {
            type: "array",
            items: { type: "string" },
            description: "Vector store IDs to search in",
          },
        },
        required: ["query"],
      },
    },
    vectorStoreIds: config?.vectorStoreIds || [],
    maxNumResults: config?.maxNumResults || 5,
    filters: config?.filters,
    ranking: config?.ranking,
  }),
};

// OpenAI model configurations with tool support
export const OPENAI_MODELS: BaseModelConfig[] = [
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "openai",
    description:
      "Next-generation OpenAI model with advanced reasoning and capabilities",
    contextWindow: 200000,
    pricing: { input: 10, output: 30 },
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsSearch: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsImageOutput: true,
      supportsPDFInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
      contextWindow: 200000,
    }),
    supportedTools: ["web_search", "file_search"],
    defaultTools: [],
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    description: "Faster and more cost-effective version of GPT-5",
    contextWindow: 128000,
    pricing: { input: 0.15, output: 0.6 },
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsSearch: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
      contextWindow: 128000,
    }),
    supportedTools: ["web_search", "file_search"],
    defaultTools: ["web_search"],
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    description: "Ultra-fast and efficient version of GPT-5",
    contextWindow: 128000,
    pricing: { input: 0.075, output: 0.3 },
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
      contextWindow: 128000,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
  {
    id: "openai/o3",
    name: "o3",
    provider: "openai",
    description:
      "Advanced reasoning model with enhanced problem-solving capabilities",
    contextWindow: 200000,
    pricing: { input: 20, output: 60 },
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsReasoning: true,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
      contextWindow: 200000,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
  {
    id: "openai/o4-mini",
    name: "o4 Mini",
    provider: "openai",
    description:
      "Efficient reasoning model with strong analytical capabilities",
    contextWindow: 128000,
    pricing: { input: 3, output: 12 },
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsReasoning: true,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
      contextWindow: 128000,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "Enhanced version of GPT-4 with improved capabilities",
    contextWindow: 128000,
    pricing: { input: 5, output: 15 },
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 8192,
      contextWindow: 128000,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "Cost-effective version of GPT-4.1",
    contextWindow: 128000,
    pricing: { input: 0.6, output: 1.8 },
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 8192,
      contextWindow: 128000,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    description: "Ultra-efficient version of GPT-4.1",
    contextWindow: 128000,
    pricing: { input: 0.3, output: 0.9 },
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 8192,
      contextWindow: 128000,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Multimodal flagship model with vision and advanced reasoning",
    contextWindow: 128000,
    pricing: { input: 5, output: 15 },
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
      contextWindow: 128000,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Affordable multimodal model with strong performance",
    contextWindow: 128000,
    pricing: { input: 0.15, output: 0.6 },
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
      contextWindow: 128000,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    description:
      "High-performance version of GPT-4 with expanded context window",
    contextWindow: 128000,
    pricing: { input: 10, output: 30 },
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsImageInput: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 4096,
      contextWindow: 128000,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
  {
    id: "openai/gpt-4",
    name: "GPT-4",
    provider: "openai",
    description: "Large multimodal model with broad general knowledge",
    contextWindow: 8192,
    pricing: { input: 30, output: 60 },
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 8192,
      contextWindow: 8192,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
  {
    id: "openai/gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    description: "Fast and efficient model for most conversational tasks",
    contextWindow: 16385,
    pricing: { input: 0.5, output: 1.5 },
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsObjectGeneration: true,
      maxTokens: 4096,
      contextWindow: 16385,
    }),
    supportedTools: ["web_search"],
    defaultTools: [],
  },
];

// Supported tool types for OpenAI models
export const OPENAI_SUPPORTED_TOOLS: ToolType[] = ["web_search", "file_search"];

// Default tools for OpenAI models (can be overridden per model)
export const OPENAI_DEFAULT_TOOLS: ToolType[] = [];

// Helper functions
export function getOpenAIModel(modelId: string): BaseModelConfig | undefined {
  return OPENAI_MODELS.find((model) => model.id === modelId);
}

export function getOpenAISupportedTools(): ToolType[] {
  return OPENAI_SUPPORTED_TOOLS;
}

export function getOpenAIDefaultTools(): ToolType[] {
  return OPENAI_DEFAULT_TOOLS;
}

export function createOpenAITools(
  toolTypes: ToolType[] = OPENAI_DEFAULT_TOOLS,
) {
  const tools: Record<string, any> = {};

  for (const toolType of toolTypes) {
    if (toolType !== "none" && toolType in OPENAI_TOOLS) {
      const toolImplementation =
        OPENAI_TOOLS[toolType as keyof typeof OPENAI_TOOLS];
      if (toolImplementation) {
        tools[toolType] = toolImplementation();
      }
    }
  }

  return tools;
}

// Provider-specific tool utility functions
export function getOpenAIModelSupportedTools(modelId: string): ToolType[] {
  const model = OPENAI_MODELS.find((m) => m.id === modelId);
  return model?.supportedTools || [];
}

export function getOpenAIModelDefaultTools(modelId: string): ToolType[] {
  const model = OPENAI_MODELS.find((m) => m.id === modelId);
  return model?.defaultTools || [];
}

export function createOpenAIToolsForModel(
  modelId: string,
  enabledTools?: ToolType[],
): Record<string, any> {
  const supportedTools = getOpenAIModelSupportedTools(modelId);
  const defaultTools = getOpenAIModelDefaultTools(modelId);

  // Use provided tools, fallback to default tools, or empty array
  const toolsToCreate = enabledTools || defaultTools;

  // Filter to only include supported tools
  const validTools = toolsToCreate.filter(
    (tool) => supportedTools.includes(tool) && tool !== "none",
  );

  return createOpenAITools(validTools);
}
