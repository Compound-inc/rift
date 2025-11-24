import {
  BaseModelConfig,
  mergeCapabilities,
  DEFAULT_PROVIDER_SETTINGS,
} from "../config/base";

export interface ZAISettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxRetries?: number;
  timeout?: number;
  parallelToolCalls?: boolean;
  store?: boolean;
  structuredOutputs?: boolean;
}

export const DEFAULT_ZAI_SETTINGS: ZAISettings = {
  ...DEFAULT_PROVIDER_SETTINGS,
  parallelToolCalls: true,
  store: true,
  structuredOutputs: true,
  maxRetries: 3,
};

export const ZAI_MODELS: BaseModelConfig[] = [
  {
    id: "zai/glm-4.6",
    name: "GLM 4.6",
    provider: "zai",
    description:
      "Modelo insignia de Z.AI con razonamiento avanzado, ideal para tareas complejas.",
    contextWindow: 200000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsReasoning: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "zai/glm-4.5v",
    name: "GLM 4.5V",
    provider: "zai",
    description:
      "Versión multimodal con visión nativa, adecuada para análisis de imágenes.",
    contextWindow: 66000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsReasoning: true,
      supportsImageInput: true,
      maxTokens: 12000,
    }),
  },
  {
    id: "zai/glm-4.5",
    name: "GLM 4.5",
    provider: "zai",
    description:
      "Modelo generalista de razonamiento con equilibrio entre velocidad y profundidad analítica.",
    contextWindow: 128000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      supportsReasoning: true,
      maxTokens: 16384,
    }),
  },
  {
    id: "zai/glm-4.5-air",
    name: "GLM 4.5 Air",
    provider: "zai",
    description:
      "Variante liviana optimizada para velocidad.",
    contextWindow: 128000,
    isPremium: false,
    capabilities: mergeCapabilities({
      supportsTools: true,
      maxTokens: 12000,
    }),
  },
];

export function getZaiModel(modelId: string): BaseModelConfig | undefined {
  return ZAI_MODELS.find((model) => model.id === modelId);
}

