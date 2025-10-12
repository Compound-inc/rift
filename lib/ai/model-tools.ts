/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  type ToolType,
  type BaseToolConfig,
  BASE_TOOL_CONFIGS,
} from "./config/base";

// Re-export ToolType for external use
export type { ToolType };

// Enhanced tool configurations with provider support
export const TOOL_CONFIGS: Record<
  ToolType,
  BaseToolConfig & { supportedProviders: string[] }
> = {
  none: {
    ...BASE_TOOL_CONFIGS.none,
    supportedProviders: ["openai"],
  },
  web_search: {
    ...BASE_TOOL_CONFIGS.web_search,
    supportedProviders: ["openai", "xai", "anthropic", "google", "deepseek"],
  },
};

// Tool utility functions
export function getSupportedTools(modelId: string): ToolType[] {
  // All models support web_search via EXA
  return ["web_search"];
}

export function getDefaultTools(modelId: string): ToolType[] {
  // No default tools - user must explicitly enable web search
  return [];
}

export function createToolsForModel(
  modelId: string,
  enabledTools: ToolType[] = [],
): Record<string, any> {
  // No native provider tools
  return {};
}

// Tool availability helpers
export function isToolSupportedByModel(
  modelId: string,
  toolType: ToolType,
): boolean {
  // Only web_search is supported via EXA
  return toolType === "web_search";
}
