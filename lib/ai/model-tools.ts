/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  OPENAI_TOOLS,
  getOpenAIModelSupportedTools,
  getOpenAIModelDefaultTools,
  createOpenAIToolsForModel,
} from "./providers/openai";
import {
  type ToolType,
  type BaseToolConfig,
  BASE_TOOL_CONFIGS,
} from "./config/base";
import { resolveRecommendedModel, getModelById } from "./ai-providers";

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
    supportedProviders: ["openai"],
  },
  file_search: {
    ...BASE_TOOL_CONFIGS.file_search,
    supportedProviders: ["openai"],
  },
  code_interpreter: {
    ...BASE_TOOL_CONFIGS.code_interpreter,
    supportedProviders: ["openai"],
  },
  image_generation: {
    ...BASE_TOOL_CONFIGS.image_generation,
    supportedProviders: ["openai"],
  },
};

// Provider-agnostic tool utility functions
export function getSupportedTools(modelId: string): ToolType[] {
  const resolvedModelId = resolveRecommendedModel(modelId);
  const model = getModelById(resolvedModelId);

  if (model) {
    return model.supportedTools;
  }

  // Fallback to provider-specific functions
  if (resolvedModelId.startsWith("openai/")) {
    return getOpenAIModelSupportedTools(resolvedModelId);
  }

  return [];
}

export function getDefaultTools(modelId: string): ToolType[] {
  const resolvedModelId = resolveRecommendedModel(modelId);
  const model = getModelById(resolvedModelId);

  if (model) {
    return model.defaultTools;
  }

  // Fallback to provider-specific functions
  if (resolvedModelId.startsWith("openai/")) {
    return getOpenAIModelDefaultTools(resolvedModelId);
  }

  return [];
}

export function createToolsForModel(
  modelId: string,
  enabledTools: ToolType[] = [],
): Record<string, any> {
  const resolvedModelId = resolveRecommendedModel(modelId);

  // Route to provider-specific tool creation
  if (resolvedModelId.startsWith("openai/")) {
    return createOpenAIToolsForModel(resolvedModelId, enabledTools);
  }

  // Fallback for unknown providers
  console.warn(`Unknown provider for model ${modelId}, no tools available`);
  return {};
}

// Tool availability helpers
export function isToolSupportedByModel(
  modelId: string,
  toolType: ToolType,
): boolean {
  const supportedTools = getSupportedTools(modelId);
  return supportedTools.includes(toolType);
}

export function getToolsByCategory(
  category: BaseToolConfig["category"],
): ToolType[] {
  return Object.entries(BASE_TOOL_CONFIGS)
    .filter(([, config]) => config.category === category)
    .map(([toolType]) => toolType as ToolType);
}

// Provider-specific tool creation with custom configurations
export function createToolsForModelWithConfig(
  modelId: string,
  toolConfigs: Partial<Record<ToolType, any>> = {},
  enabledTools?: ToolType[],
): Record<string, any> {
  const resolvedModelId = resolveRecommendedModel(modelId);
  const supportedTools = getSupportedTools(resolvedModelId);
  const defaultTools = getDefaultTools(resolvedModelId);

  // Use provided tools, fallback to default tools
  const toolsToCreate = enabledTools || defaultTools;

  // Filter to only include supported tools
  const validTools = toolsToCreate.filter(
    (tool) => supportedTools.includes(tool) && tool !== "none",
  );

  const tools: Record<string, any> = {};

  // Route to provider-specific tool creation with configs
  if (resolvedModelId.startsWith("openai/")) {
    for (const toolType of validTools) {
      const toolConfig = toolConfigs[toolType];

      switch (toolType) {
        case "web_search":
          tools[toolType] = OPENAI_TOOLS.web_search(toolConfig);
          break;
        case "file_search":
          tools[toolType] = OPENAI_TOOLS.file_search(toolConfig);
          break;
        case "code_interpreter":
          tools[toolType] = OPENAI_TOOLS.code_interpreter(toolConfig);
          break;
        case "image_generation":
          tools[toolType] = OPENAI_TOOLS.image_generation(toolConfig);
          break;
        default:
          // Skip unsupported tools
          break;
      }
    }
  }

  return tools;
}

// Helper function to get all available tools across providers
export function getAllAvailableTools(): ToolType[] {
  return Object.keys(TOOL_CONFIGS) as ToolType[];
}

// Helper function to get tools by provider
export function getToolsByProvider(provider: string): ToolType[] {
  return Object.entries(TOOL_CONFIGS)
    .filter(([, config]) => config.supportedProviders.includes(provider))
    .map(([toolType]) => toolType as ToolType);
}

// Validate if a set of tools can be used with a model
export function validateToolsForModel(
  modelId: string,
  toolTypes: ToolType[],
): {
  valid: ToolType[];
  invalid: ToolType[];
} {
  const supportedTools = getSupportedTools(modelId);

  const valid = toolTypes.filter((tool) => supportedTools.includes(tool));
  const invalid = toolTypes.filter((tool) => !supportedTools.includes(tool));

  return { valid, invalid };
}

// Get model information including tool support
export function getModelToolInfo(modelId: string) {
  const resolvedModelId = resolveRecommendedModel(modelId);
  const model = getModelById(resolvedModelId);

  if (!model) {
    return null;
  }

  return {
    modelId: resolvedModelId,
    name: model.name,
    provider: model.provider,
    supportedTools: model.supportedTools,
    defaultTools: model.defaultTools,
    capabilities: model.capabilities,
    isPremium: model.isPremium,
  };
}
