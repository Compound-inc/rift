/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BaseModelConfig,
  mergeCapabilities,
  DEFAULT_PROVIDER_SETTINGS,
  ToolType,
} from "../config/base";

// xAI-specific settings interface
export interface XAISettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
  // xAI-specific options
  parallelToolCalls?: boolean;
  store?: boolean;
  user?: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  reasoning?: {
    enabled?: boolean;
  };
  structuredOutputs?: boolean;
  maxCompletionTokens?: number;
  logitBias?: Record<number, number>;
  logprobs?: boolean | number;
  searchParameters?: {
    enabled?: boolean;
    maxSources?: number;
  };
  stop?: string | string[];
}

// Default xAI settings
export const DEFAULT_XAI_SETTINGS: XAISettings = {
  ...DEFAULT_PROVIDER_SETTINGS,
  parallelToolCalls: true,
  store: true,
  reasoningEffort: "medium",
  structuredOutputs: true,
  maxRetries: 3,
  reasoning: {
    enabled: false,
  },
  searchParameters: {
    enabled: false,
    maxSources: 5,
  },
};

// xAI tool implementations
export const XAI_TOOLS = {
  web_search: (config?: any) => ({
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Search the web for real-time information using Grok's live search",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
          maxSources: {
            type: "number",
            description: "Maximum number of sources to use (default: 5)",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
    ...config,
  }),
  file_search: (config?: { maxNumResults?: number; filters?: any }) => ({
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
        },
        required: ["query"],
      },
    },
    maxNumResults: config?.maxNumResults || 5,
    filters: config?.filters,
  }),
};

// xAI model configurations with tool support
export const XAI_MODELS: BaseModelConfig[] = [
  {
    id: "xai/grok-4",
    name: "Grok 4",
    provider: "xai",
    description:
      "Latest flagship model offering unparalleled performance in natural language, math and reasoning",
    contextWindow: 256000,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsSearch: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
    supportedTools: ["web_search", "file_search"],
    defaultTools: ["web_search"],
  },
  {
    id: "xai/grok-code-fast-1",
    name: "Grok Code Fast 1",
    provider: "xai",
    description:
      "Speedy and economical reasoning model that excels at agentic coding tasks",
    contextWindow: 256000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsObjectGeneration: true,
      maxTokens: 16384,
    }),
    supportedTools: ["web_search", "file_search"],
    defaultTools: [],
  },
  {
    id: "xai/grok-4-fast-non-reasoning",
    name: "Grok 4 Fast (Non-Reasoning)",
    provider: "xai",
    description:
      "Latest multimodal model with SOTA cost-efficiency and 2M token context window. Non-reasoning variant",
    contextWindow: 2000000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsSearch: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 32768,
    }),
    supportedTools: ["web_search", "file_search"],
    defaultTools: ["web_search"],
  },
  {
    id: "xai/grok-4-fast-reasoning",
    name: "Grok 4 Fast (Reasoning)",
    provider: "xai",
    description:
      "Latest multimodal model with SOTA cost-efficiency and 2M token context window. Reasoning variant",
    contextWindow: 2000000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsSearch: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsObjectGeneration: true,
      maxTokens: 100,
    }),
    supportedTools: ["web_search", "file_search"],
    defaultTools: ["web_search"],
  },
  {
    id: "xai/grok-3",
    name: "Grok 3",
    provider: "xai",
    description:
      "Advanced model with strong capabilities across multiple domains",
    contextWindow: 131072,
    isPremium: true,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsSearch: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsObjectGeneration: true,
      maxTokens: 8192,
    }),
    supportedTools: ["web_search", "file_search"],
    defaultTools: ["web_search"],
  },
  {
    id: "xai/grok-3-mini",
    name: "Grok 3 Mini",
    provider: "xai",
    description:
      "Lightweight reasoning model. Fast, smart, and great for logic-based tasks",
    contextWindow: 131072,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsSearch: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsObjectGeneration: true,
      maxTokens: 8192,
    }),
    supportedTools: ["web_search", "file_search"],
    defaultTools: [],
  },
];

// Supported tool types for xAI models
export const XAI_SUPPORTED_TOOLS: ToolType[] = ["web_search", "file_search"];

// Default tools for xAI models (can be overridden per model)
export const XAI_DEFAULT_TOOLS: ToolType[] = ["web_search"];

// Helper functions
export function getXAIModel(modelId: string): BaseModelConfig | undefined {
  return XAI_MODELS.find((model) => model.id === modelId);
}

export function getXAIDefaultTools(): ToolType[] {
  return XAI_DEFAULT_TOOLS;
}

export function createXAITools(toolTypes: ToolType[] = XAI_DEFAULT_TOOLS) {
  const tools: Record<string, any> = {};

  for (const toolType of toolTypes) {
    if (toolType !== "none" && toolType in XAI_TOOLS) {
      const toolImplementation = XAI_TOOLS[toolType as keyof typeof XAI_TOOLS];
      if (toolImplementation) {
        tools[toolType] = toolImplementation();
      }
    }
  }

  return tools;
}

// Provider-specific tool utility functions
export function getXAIModelSupportedTools(): ToolType[] {
  return XAI_SUPPORTED_TOOLS;
}

export function getXAIModelDefaultTools(): ToolType[] {
  return XAI_DEFAULT_TOOLS;
}

export function createXAIToolsForModel(
  enabledTools?: ToolType[],
): Record<string, any> {
  const supportedTools = getXAIModelSupportedTools();
  const defaultTools = getXAIModelDefaultTools();

  // Use provided tools, fallback to default tools, or empty array
  const toolsToCreate = enabledTools || defaultTools;

  // Filter to only include supported tools
  const validTools = toolsToCreate.filter(
    (tool) => supportedTools.includes(tool) && tool !== "none",
  );

  return createXAITools(validTools);
}

// Reasoning helper functions
export function supportsReasoning(modelId: string): boolean {
  const model = getXAIModel(modelId);
  return model?.capabilities.supportsReasoning || false;
}

export function getReasoningSettings(
  modelId: string,
  enabled: boolean = true,
  effort: "minimal" | "low" | "medium" | "high" = "medium",
): Partial<XAISettings> {
  if (!supportsReasoning(modelId)) {
    return {};
  }

  return {
    reasoning: {
      enabled,
    },
    reasoningEffort: effort,
  };
}

// Search helper functions
export function supportsLiveSearch(modelId: string): boolean {
  const model = getXAIModel(modelId);
  return model?.capabilities.supportsSearch || false;
}

export function getLiveSearchSettings(
  modelId: string,
  enabled: boolean = true,
  maxSources: number = 5,
): Partial<XAISettings> {
  if (!supportsLiveSearch(modelId)) {
    return {};
  }

  return {
    searchParameters: {
      enabled,
      maxSources,
    },
  };
}
