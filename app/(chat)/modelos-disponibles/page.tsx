import { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
  SparklesIcon,
  ZapIcon,
  GlobeIcon,
  BrainIcon,
  WrenchIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { MODELS } from "@/lib/ai/ai-providers";
import { AnthropicIcon } from "@/components/ui/icons/anthropic-icon";
import { TablerBrandOpenai } from "@/components/ui/icons/openai-icon";
import { GoogleIcon } from "@/components/ui/icons/google-icon";
import { XAiIcon } from "@/components/ui/icons/xai-icon";
import { OpenRouterIcon } from "@/components/ui/icons/openrouter-icon";
import { LogosMistralAiIcon } from "@/components/ui/icons/mistral-icon";
import { DeepSeekIcon } from "@/components/ui/icons/deepseek-icon";
import { QwenIcon } from "@/components/ui/icons/qwen-icon";
import { MoonshotIcon } from "@/components/ui/icons/moonshot-icon";
import { MetaIcon } from "@/components/ui/icons/meta-icon";
import { ZhipuIcon } from "@/components/ui/icons/zhipu-icon";

export const metadata: Metadata = {
  title: "Modelos Disponibles",
  description:
    "Explora todos los modelos de IA disponibles, sus proveedores y capacidades.",
};

// Provider icon mapping
const providerIcons = {
  openai: TablerBrandOpenai,
  anthropic: AnthropicIcon,
  google: GoogleIcon,
  xai: XAiIcon,
  openrouter: OpenRouterIcon,
  mistralai: LogosMistralAiIcon,
  deepseek: DeepSeekIcon,
  zai: ZhipuIcon,
  qwen: QwenIcon,
  meta: MetaIcon,
  moonshotai: MoonshotIcon,
} as const;

// Provider display names and company info
const providerInfo = {
  openai: {
    name: "OpenAI",
    company: "OpenAI Inc.",
    founded: "2015",
    headquarters: "San Francisco, California, USA",
    description:
      "OpenAI es una empresa de investigación en inteligencia artificial fundada por Elon Musk, Sam Altman y otros. Es conocida por desarrollar modelos como GPT, DALL-E y ChatGPT.",
    website: "https://openai.com",
    notableModels: ["GPT-4", "GPT-3.5", "DALL-E", "ChatGPT", "Whisper"],
  },
  anthropic: {
    name: "Anthropic",
    company: "Anthropic PBC",
    founded: "2021",
    headquarters: "San Francisco, California, USA",
    description:
      "Anthropic es una empresa de IA de seguridad fundada por ex-investigadores de OpenAI. Se enfoca en desarrollar IA segura y útil, siendo conocida por Claude.",
    website: "https://anthropic.com",
    notableModels: ["Claude", "Claude Sonnet", "Claude Haiku"],
  },
  google: {
    name: "Google",
    company: "Google LLC (Alphabet Inc.)",
    founded: "1998",
    headquarters: "Mountain View, California, USA",
    description:
      "Google es una subsidiaria de Alphabet Inc. y líder mundial en tecnología. Su división de IA desarrolla modelos como Gemini, BERT y PaLM.",
    website: "https://ai.google",
    notableModels: ["Gemini", "BERT", "PaLM", "LaMDA", "Imagen"],
  },
  xai: {
    name: "xAI",
    company: "xAI Corp.",
    founded: "2023",
    headquarters: "Austin, Texas, USA",
    description:
      "xAI es una empresa de inteligencia artificial fundada por Elon Musk. Se enfoca en desarrollar IA que busca la verdad y comprende el universo.",
    website: "https://x.ai",
    notableModels: ["Grok", "Grok-2", "Grok Vision"],
  },
  // Additional companies from OpenRouter
  mistralai: {
    name: "Mistral AI",
    company: "Mistral AI SAS",
    founded: "2023",
    headquarters: "París, Francia",
    description:
      "Mistral AI es una empresa francesa de inteligencia artificial fundada por ex-investigadores de Google DeepMind y Meta. Se especializa en modelos de código abierto y eficientes.",
    website: "https://mistral.ai",
    notableModels: ["Mistral 7B", "Mixtral 8x7B", "Mistral Large", "Magistral"],
  },
  deepseek: {
    name: "DeepSeek",
    company: "DeepSeek Technology Co., Ltd.",
    founded: "2023",
    headquarters: "Shenzhen, China",
    description:
      "DeepSeek es una empresa china de IA que desarrolla modelos de razonamiento avanzado y capacidades de programación. Conocida por sus modelos de razonamiento paso a paso.",
    website: "https://deepseek.com",
    notableModels: ["DeepSeek Coder", "DeepSeek Chat", "DeepSeek R1"],
  },
  zai: {
    name: "Zhipu AI",
    company: "Beijing Zhipu Huazhang Technology Co., Ltd.",
    founded: "2019",
    headquarters: "Beijing, China",
    description:
      "Zhipu AI es una empresa china de IA que desarrolla modelos de lenguaje grandes, especialmente conocida por GLM (General Language Model) con capacidades multilingües.",
    website: "https://zhipuai.cn",
    notableModels: ["GLM-4", "GLM-4V", "CogView", "CodeGeeX"],
  },
  qwen: {
    name: "Qwen (Alibaba)",
    company: "Alibaba Group Holding Limited",
    founded: "1999",
    headquarters: "Hangzhou, China",
    description:
      "Qwen es la división de IA de Alibaba Group, desarrollando modelos de lenguaje grandes con capacidades multilingües y especialización en tareas específicas.",
    website: "https://qwenlm.github.io",
    notableModels: ["Qwen2", "Qwen2.5", "Qwen-Coder", "Qwen-VL"],
  },
  meta: {
    name: "Meta",
    company: "Meta Platforms, Inc.",
    founded: "2004",
    headquarters: "Menlo Park, California, USA",
    description:
      "Meta (anteriormente Facebook) desarrolla modelos de IA de código abierto, siendo pionera en modelos como LLaMA y contribuyendo significativamente al ecosistema de IA abierta.",
    website: "https://ai.meta.com",
    notableModels: ["LLaMA", "LLaMA 2", "Code Llama", "SeamlessM4T"],
  },
  moonshotai: {
    name: "Moonshot AI",
    company: "Moonshot AI Technology Co., Ltd.",
    founded: "2023",
    headquarters: "Beijing, China",
    description:
      "Moonshot AI es una startup china de IA que desarrolla modelos de lenguaje grandes con capacidades de contexto extendido y razonamiento avanzado.",
    website: "https://moonshot.cn",
    notableModels: ["Kimi", "Kimi K2", "Moonshot-v1"],
  },
  openrouter: {
    name: "OpenRouter",
    company: "OpenRouter Inc.",
    founded: "2023",
    headquarters: "San Francisco, California, USA",
    description:
      "OpenRouter es una plataforma que proporciona acceso unificado a múltiples modelos de IA de diferentes proveedores a través de una API simple y precios transparentes.",
    website: "https://openrouter.ai",
    notableModels: ["Horizon Beta", "Acceso a múltiples modelos de terceros"],
  },
} as const;

// Capability icon mapping
const capabilityIcons = {
  supportsTools: WrenchIcon,
  supportsSearch: GlobeIcon,
  supportsReasoning: BrainIcon,
  supportsStreaming: ZapIcon,
} as const;

export default function ModelosDisponiblesPage() {
  // Reorganize models: separate OpenRouter models into their real companies
  const reorganizedModels = MODELS.map((model) => {
    if (model.provider === "openrouter") {
      // Extract real company from model ID
      const modelId = model.id.replace("openrouter:", "");
      const [company] = modelId.split("/");

      // Map company names to our provider keys
      const companyMap: Record<string, string> = {
        mistralai: "mistralai",
        deepseek: "deepseek",
        tngtech: "deepseek", // tngtech is also DeepSeek
        "z-ai": "zai",
        qwen: "qwen",
        "meta-llama": "meta",
        moonshotai: "moonshotai",
        openrouter: "openrouter", // Keep OpenRouter's own models
        openai: "openai", // OpenAI models via OpenRouter
      };

      const realProvider = companyMap[company] || "openrouter";
      return {
        ...model,
        provider: realProvider,
        originalProvider: "openrouter",
      };
    }
    return { ...model, originalProvider: model.provider };
  });

  // Get unique providers (including the new ones)
  const allProviders = Array.from(
    new Set(reorganizedModels.map((m) => m.provider)),
  );

  // Separate OpenRouter models for special section
  const openRouterModels = reorganizedModels.filter(
    (m) => m.provider === "openrouter",
  );
  const otherProviders = allProviders.filter((p) => p !== "openrouter");

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/info-ia"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeftIcon className="size-4 mr-2" />
            Volver a Información sobre IA
          </Link>

          <h1 className="text-4xl font-bold text-foreground mb-4">
            Modelos Disponibles
          </h1>
          <p className="text-lg text-muted-foreground">
            Explora todos los modelos de inteligencia artificial disponibles,
            sus proveedores y capacidades. Conoce las empresas detrás de cada
            modelo.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {MODELS.length}
            </div>
            <div className="text-sm text-muted-foreground">Modelos Totales</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {allProviders.length}
            </div>
            <div className="text-sm text-muted-foreground">Proveedores</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {MODELS.filter((m) => m.isPremium).length}
            </div>
            <div className="text-sm text-muted-foreground">Modelos Premium</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {MODELS.filter((m) => m.capabilities.supportsReasoning).length}
            </div>
            <div className="text-sm text-muted-foreground">
              Con Razonamiento
            </div>
          </div>
        </div>

        {/* Providers Section */}
        <div className="space-y-8">
          {otherProviders.map((provider) => {
            const models = reorganizedModels.filter(
              (m) => m.provider === provider,
            );
            const ProviderIcon =
              providerIcons[provider as keyof typeof providerIcons];
            const info = providerInfo[provider as keyof typeof providerInfo];

            return (
              <div key={provider} className="bg-card border rounded-lg p-6">
                {/* Provider Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-4">
                    {ProviderIcon && <ProviderIcon className="size-12 mt-2" />}
                    <div>
                      <h2 className="text-2xl font-bold text-foreground mb-2">
                        {info.name}
                      </h2>
                      <p className="text-muted-foreground mb-2">
                        {info.company} • Fundada en {info.founded}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        📍 {info.headquarters}
                      </p>
                    </div>
                  </div>
                  <a
                    href={info.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 mt-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLinkIcon className="size-4" />
                    Sitio Web
                  </a>
                </div>

                {/* Company Description */}
                <div className="mb-6">
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    {info.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Modelos destacados:
                    </span>
                    {info.notableModels.map((model, index) => (
                      <span
                        key={index}
                        className="text-sm bg-muted px-2 py-1 rounded"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Models Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {models.map((model) => (
                    <div
                      key={model.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {model.name}
                          </h3>
                          {model.isPremium && (
                            <SparklesIcon className="size-4 text-yellow-500" />
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {model.description}
                      </p>

                      {/* Model Stats */}
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Contexto:
                          </span>
                          <span className="text-foreground">
                            {Math.round(model.contextWindow / 1000)}K tokens
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Precio entrada:
                          </span>
                          <span className="text-foreground">
                            ${model.pricing.input}/1M tokens
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Precio salida:
                          </span>
                          <span className="text-foreground">
                            ${model.pricing.output}/1M tokens
                          </span>
                        </div>
                      </div>

                      {/* Capabilities */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {Object.entries(model.capabilities)
                          .filter(([, enabled]) => enabled)
                          .map(([capability]) => {
                            const IconComponent =
                              capabilityIcons[
                                capability as keyof typeof capabilityIcons
                              ];
                            if (!IconComponent) return null;
                            return (
                              <IconComponent
                                key={capability}
                                className="size-3 text-muted-foreground"
                              />
                            );
                          })}
                        {Object.values(model.capabilities).filter(Boolean)
                          .length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            Básico
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Provider Stats */}
                <div className="mt-6 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-foreground">
                        {models.length}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Modelos
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-foreground">
                        {models.filter((m) => m.isPremium).length}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Premium
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-foreground">
                        {
                          models.filter((m) => m.capabilities.supportsReasoning)
                            .length
                        }
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Razonamiento
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-foreground">
                        {
                          models.filter((m) => m.capabilities.supportsTools)
                            .length
                        }
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Con Herramientas
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Special OpenRouter Section */}
        {openRouterModels.length > 0 && (
          <div className="mt-12">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <OpenRouterIcon className="size-12" />
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      OpenRouter - Plataforma Unificada
                    </h2>
                    <p className="text-muted-foreground mb-2">
                      OpenRouter Inc. • Fundada en 2023
                    </p>
                    <p className="text-sm text-muted-foreground">
                      📍 San Francisco, California, USA
                    </p>
                  </div>
                </div>
                <a
                  href="https://openrouter.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <ExternalLinkIcon className="size-4" />
                  Sitio Web
                </a>
              </div>

              <div className="mb-6">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  OpenRouter es una plataforma que proporciona acceso unificado
                  a múltiples modelos de IA de diferentes proveedores a través
                  de una API simple y precios transparentes. Facilita el acceso
                  a modelos de terceros sin necesidad de múltiples
                  integraciones.
                </p>
                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2">
                    💡 ¿Qué es OpenRouter?
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    OpenRouter actúa como un intermediario que te permite
                    acceder a modelos de diferentes empresas a través de una
                    sola API. Los modelos listados arriba están organizados por
                    sus empresas reales, pero están disponibles a través de
                    OpenRouter.
                  </p>
                </div>
              </div>

              {/* OpenRouter's Own Models */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {openRouterModels.map((model) => (
                  <div
                    key={model.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">
                          {model.name}
                        </h3>
                        {model.isPremium && (
                          <SparklesIcon className="size-4 text-yellow-500" />
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {model.description}
                    </p>

                    {/* Model Stats */}
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Contexto:</span>
                        <span className="text-foreground">
                          {Math.round(model.contextWindow / 1000)}K tokens
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Precio entrada:
                        </span>
                        <span className="text-foreground">
                          ${model.pricing.input}/1M tokens
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Precio salida:
                        </span>
                        <span className="text-foreground">
                          ${model.pricing.output}/1M tokens
                        </span>
                      </div>
                    </div>

                    {/* Capabilities */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {Object.entries(model.capabilities)
                        .filter(([, enabled]) => enabled)
                        .map(([capability]) => {
                          const IconComponent =
                            capabilityIcons[
                              capability as keyof typeof capabilityIcons
                            ];
                          if (!IconComponent) return null;
                          return (
                            <IconComponent
                              key={capability}
                              className="size-3 text-muted-foreground"
                            />
                          );
                        })}
                      {Object.values(model.capabilities).filter(Boolean)
                        .length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          Básico
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* OpenRouter Stats */}
              <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-800">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {openRouterModels.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Modelos Propios
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      50+
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Modelos Totales
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      API Unificada
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Acceso Simple
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      Precios Transparentes
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Sin Sorpresas
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Capabilities Legend */}
        <div className="mt-12 bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Leyenda de Capacidades
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <WrenchIcon className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Herramientas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <GlobeIcon className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Búsqueda Web
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BrainIcon className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Razonamiento
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ZapIcon className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Streaming</span>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-8 bg-primary/10 border border-primary/20 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-semibold mb-4 text-foreground">
            ¿Listo para Probar?
          </h3>
          <p className="text-muted-foreground mb-6">
            Explora estos modelos y encuentra el perfecto para tus necesidades.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Crear Nuevo Chat
            </Link>
            <Link
              href="/info-ia"
              className="inline-flex items-center justify-center px-6 py-3 border border-border rounded-lg font-medium hover:bg-accent transition-colors"
            >
              Más Información
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
