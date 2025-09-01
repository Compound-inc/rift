// Model-specific tool configurations
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";

// Tool configuration types
export interface ToolConfig {
  id: string;
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
  supportedProviders: string[];
  parameters?: Record<string, unknown>;
}

export interface ModelToolConfig {
  modelId: string;
  supportedTools: ToolType[];
  defaultTools: ToolType[];
  toolImplementations: Record<string, () => unknown>;
  providerOptions?: Record<string, unknown>;
}

// Available tool types
export type ToolType =
  | "none"
  | "google_search"
  | "url_context"
  | "web_search"
  | "anthropic_web_search";

// Tool configurations with metadata
export const TOOL_CONFIGS: Record<ToolType, ToolConfig> = {
  none: {
    id: "none",
    name: "None",
    description: "No tool",
    icon: "None",
    category: "none",
    requiresAuth: false,
    supportedProviders: [],
  },
  google_search: {
    id: "google_search",
    name: "Web Search",
    description: "Search the web for real-time information and current events",
    icon: "Search",
    category: "search",
    requiresAuth: false,
    supportedProviders: ["google"],
  },
  url_context: {
    id: "url_context",
    name: "URL Context",
    description:
      "Automatically analyze links and URLs you share in your messages",
    icon: "Link",
    category: "context",
    requiresAuth: false,
    supportedProviders: ["google"],
  },
  web_search: {
    id: "web_search",
    name: "Web Search",
    description: "Search the web for real-time information and current events",
    icon: "Search",
    category: "search",
    requiresAuth: false,
    supportedProviders: ["openai", "google"],
  },
  anthropic_web_search: {
    id: "anthropic_web_search",
    name: "Web Search",
    description: "Search the web for real-time information and current events",
    icon: "Search",
    category: "search",
    requiresAuth: false,
    supportedProviders: ["anthropic"],
  },
};

// Model-specific tool configurations
export const MODEL_TOOLS: Record<string, ModelToolConfig> = {
  // OpenAI Models
  "openai:gpt-4o": {
    modelId: "openai:gpt-4o",
    supportedTools: [],
    defaultTools: [],
    toolImplementations: {},
  },

  "openai:gpt-4": {
    modelId: "openai:gpt-4",
    supportedTools: [],
    defaultTools: [],
    toolImplementations: {},
  },
  "openai:gpt-3.5-turbo": {
    modelId: "openai:gpt-3.5-turbo",
    supportedTools: [],
    defaultTools: [],
    toolImplementations: {},
  },
  // Google Gemini Models
  "google:gemini-2.5-flash": {
    modelId: "google:gemini-2.5-flash",
    supportedTools: ["google_search", "url_context"],
    defaultTools: ["url_context"],
    toolImplementations: {
      google_search: () => google.tools.googleSearch({}),
      url_context: () => google.tools.urlContext({}),
    },
  },
  "google:gemini-2.5-pro": {
    modelId: "google:gemini-2.5-pro",
    supportedTools: ["google_search", "url_context"],
    defaultTools: ["url_context"],
    toolImplementations: {
      google_search: () => google.tools.googleSearch({}),
      url_context: () => google.tools.urlContext({}),
    },
  },
  "google:gemini-2.0-flash": {
    modelId: "google:gemini-2.0-flash",
    supportedTools: ["none"],
    defaultTools: ["none"],
    toolImplementations: {
      google_search: () => google.tools.googleSearch({}),
      url_context: () => google.tools.urlContext({}),
    },
  },
  "google:gemini-2.0-flash-lite": {
    modelId: "google:gemini-2.0-flash-lite",
    supportedTools: ["none"],
    defaultTools: ["none"],
    toolImplementations: {
      google_search: () => google.tools.googleSearch({}),
      url_context: () => google.tools.urlContext({}),
    },
  },
  // Anthropic Models
  "anthropic:claude-opus-4-20250514": {
    modelId: "anthropic:claude-opus-4-20250514",
    supportedTools: ["anthropic_web_search"],
    defaultTools: [],
    toolImplementations: {
      anthropic_web_search: () =>
        anthropic.tools.webSearch_20250305({ maxUses: 5 }),
    },
  },
  "anthropic:claude-sonnet-4-20250514": {
    modelId: "anthropic:claude-sonnet-4-20250514",
    supportedTools: ["anthropic_web_search"],
    defaultTools: [],
    toolImplementations: {
      anthropic_web_search: () =>
        anthropic.tools.webSearch_20250305({ maxUses: 5 }),
    },
  },
  "anthropic:claude-3-7-sonnet-20250219": {
    modelId: "anthropic:claude-3-7-sonnet-20250219",
    supportedTools: ["anthropic_web_search"],
    defaultTools: [],
    toolImplementations: {
      anthropic_web_search: () =>
        anthropic.tools.webSearch_20250305({ maxUses: 5 }),
    },
  },

  // OpenAI new models
  "openai:gpt-5": {
    modelId: "openai:gpt-5",
    supportedTools: [],
    defaultTools: [],
    toolImplementations: {},
  },
  "openai:o3": {
    modelId: "openai:o3",
    supportedTools: [],
    defaultTools: [],
    toolImplementations: {},
  },
  "openai:gpt-4o-nano": {
    modelId: "openai:gpt-4o-nano",
    supportedTools: [],
    defaultTools: [],
    toolImplementations: {},
  },
  "openai:gpt-4.1": {
    modelId: "openai:gpt-4.1",
    supportedTools: [],
    defaultTools: [],
    toolImplementations: {},
  },
  "openai:gpt-4.1-mini": {
    modelId: "openai:gpt-4.1-mini",
    supportedTools: [],
    defaultTools: [],
    toolImplementations: {},
  },
  "openai:gpt-4.1-nano": {
    modelId: "openai:gpt-4.1-nano",
    supportedTools: [],
    defaultTools: [],
    toolImplementations: {},
  },
};

// Helper functions
export function getModelTools(modelId: string): ModelToolConfig | undefined {
  return MODEL_TOOLS[modelId];
}

export function getSupportedTools(modelId: string): ToolType[] {
  const modelConfig = MODEL_TOOLS[modelId];
  return (modelConfig?.supportedTools as ToolType[]) || [];
}

export function getDefaultTools(modelId: string): ToolType[] {
  const modelConfig = MODEL_TOOLS[modelId];
  return (modelConfig?.defaultTools as ToolType[]) || [];
}

export function createToolsForModel(
  modelId: string,
  enabledTools: ToolType[] = [],
) {
  const modelConfig = MODEL_TOOLS[modelId];
  if (!modelConfig) return {};

  const toolsToEnable =
    enabledTools.length > 0 ? enabledTools : modelConfig.defaultTools;
  const tools: Record<string, unknown> = {};

  for (const toolId of toolsToEnable) {
    const implementation = modelConfig.toolImplementations[toolId];
    if (implementation) {
      tools[toolId] = implementation();
    }
  }

  return tools;
}
