"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMemo, useCallback } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  CheckIcon,
  ChevronDownIcon,
  SparklesIcon,
  BrainIcon,
  WrenchIcon,
  HelpCircleIcon,
  FileIcon,
  ImageIcon,
  FileTextIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ai/ui/tooltip";
import {
  AutoIcon,
  SorpresaIcon,
  ProblemasDificilesIcon,
  EscrituraIcon,
} from "@/components/ui/icons/svg-icons";
import { cn } from "@/lib/utils";
import {
  MODELS,
  getModelsByProvider,
  getAllProviders,
} from "@/lib/ai/ai-providers";
import { type BaseModelConfig } from "@/lib/ai/config/base";
import { AnthropicIcon } from "@/components/ui/icons/anthropic-icon";
import { TablerBrandOpenai } from "@/components/ui/icons/openai-icon";
import { GoogleIcon } from "@/components/ui/icons/google-icon";
import { XAiIcon } from "@/components/ui/icons/xai-icon";
import { OpenRouterIcon } from "@/components/ui/icons/openrouter-icon";
import { DeepSeekIcon } from "@/components/ui/icons/deepseek-icon";
import { LogosMistralAiIcon } from "@/components/ui/icons/mistral-icon";
import { MoonshotIcon } from "@/components/ui/icons/moonshot-icon";
import { ZaiIcon } from "@/components/ui/icons/zai-icon";
import { PrimeIntellectIcon } from "@/components/ui/icons/prime-intellect-icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ai/ui/tabs";

// Provider icon mapping
const providerIcons = {
  openai: TablerBrandOpenai,
  anthropic: AnthropicIcon,
  google: GoogleIcon,
  xai: XAiIcon,
  openrouter: OpenRouterIcon,
  deepseek: DeepSeekIcon,
  mistral: LogosMistralAiIcon,
  moonshotai: MoonshotIcon,
  zai: ZaiIcon,
  "prime-intellect": PrimeIntellectIcon,
} as const;

// Capability icon mapping
const capabilityIcons = {
  supportsTools: WrenchIcon,
  supportsReasoning: BrainIcon,
  supportsImageInput: ImageIcon,
  supportsPDFInput: FileTextIcon,
} as const;

// Capability descriptions for tooltips
const capabilityDescriptions = {
  supportsTools: "Puede usar herramientas como buscar en internet",
  supportsReasoning: "El modelo puede razonar",
  supportsImageInput: "Puede procesar imágenes",
  supportsPDFInput: "Puede procesar archivos PDF",
} as const;

// Provider display names
const providerNames = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  moonshotai: "Moonshot",
  zai: "Z.AI",
  "prime-intellect": "Prime Intellect",
} as const;

// Recommended options configuration
const RECOMMENDED_OPTIONS = [
  {
    id: "automatico",
    name: "Automático",
    description: "Selección inteligente del mejor modelo para tu consulta",
    icon: AutoIcon,
    color: "text-blue-500 dark:text-blue-300",
    bgColor: "hover:bg-blue-50 dark:hover:bg-blue-950/20",
    borderColor: "hover:border-blue-200 dark:hover:border-blue-800",
  },
  {
    id: "problemas_dificiles",
    name: "Problemas Difíciles",
    description: "Modelos especializados en razonamiento complejo",
    icon: ProblemasDificilesIcon,
    color: "text-purple-500 dark:text-purple-300",
    bgColor: "hover:bg-purple-50 dark:hover:bg-purple-950/20",
    borderColor: "hover:border-purple-200 dark:hover:border-purple-800",
  },
  {
    id: "escritura",
    name: "Escritura",
    description: "Optimizado para creación de contenido y redacción",
    icon: EscrituraIcon,
    color: "text-emerald-500 dark:text-emerald-300",
    bgColor: "hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
    borderColor: "hover:border-emerald-200 dark:hover:border-emerald-800",
  },
  {
    id: "sorpresa",
    name: "Sorpresa",
    description: "Deja que el azar elija tu próxima experiencia",
    icon: SorpresaIcon,
    color: "text-amber-500 dark:text-amber-300",
    bgColor: "hover:bg-amber-50 dark:hover:bg-amber-950/20",
    borderColor: "hover:border-amber-200 dark:hover:border-amber-800",
  },
] as const;

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

function ModelSelector({
  value,
  onValueChange,
  className,
}: ModelSelectorProps) {
  const [activeTab, setActiveTab] = React.useState<"recomendado" | "avanzado">(
    "recomendado",
  );
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const selectedModel = MODELS.find((model) => model.id === value);
  const providers = getAllProviders();

  // Check if current value is a recommended option
  const selectedRecommended = RECOMMENDED_OPTIONS.find(
    (option) => option.id === value,
  );
  const isRecommendedSelected = !!selectedRecommended;

  const { leftColumn, rightColumn } = useMemo(() => {
    const providerData = providers.map((provider) => ({
      provider,
      models: getModelsByProvider(provider),
      modelCount: getModelsByProvider(provider).length,
    }));

    // Sort by model count (descending) to place providers with more models first
    providerData.sort((a, b) => b.modelCount - a.modelCount);

    const leftColumn: typeof providerData = [];
    const rightColumn: typeof providerData = [];
    let leftCount = 0;
    let rightCount = 0;

    // Distribute providers to balance model counts between columns
    for (const providerInfo of providerData) {
      if (leftCount <= rightCount) {
        leftColumn.push(providerInfo);
        leftCount += providerInfo.modelCount;
      } else {
        rightColumn.push(providerInfo);
        rightCount += providerInfo.modelCount;
      }
    }

    return { leftColumn, rightColumn };
  }, [providers]);

  const renderRecommendedItems = useCallback(() => (
    <>
      {RECOMMENDED_OPTIONS.map((option) => {
        const IconComponent = option.icon;

        return (
          <SelectPrimitive.Item
            key={option.id}
            value={option.id}
            className={cn(
              "relative flex flex-col items-center gap-4 p-4 mx-3 mb-3 rounded-xl border border-border/30 bg-transparent transition-all duration-200 group cursor-pointer hover:border-border/60 hover:bg-popover-secondary/50 min-h-[120px] outline-none focus:bg-popover-secondary/40 data-[highlighted]:bg-popover-secondary/40 data-[state=checked]:bg-popover-secondary/20 data-[state=checked]:text-popover-text data-[state=checked]:border-border/80",
            )}
          >
            <SelectPrimitive.ItemText>
              <div className="flex flex-col items-center gap-4">
                <IconComponent
                  className={cn("size-6 transition-colors", option.color)}
                />

                <div className="text-center space-y-1 flex-1 flex flex-col justify-center">
                  <h4 className="font-medium text-sm text-popover-text">
                    {option.name}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                    {option.description}
                  </p>
                </div>
              </div>
            </SelectPrimitive.ItemText>

            <span className="absolute right-3 top-3 flex size-4 items-center justify-center">
              <SelectPrimitive.ItemIndicator>
                <CheckIcon className="size-4" />
              </SelectPrimitive.ItemIndicator>
            </span>
          </SelectPrimitive.Item>
        );
      })}
    </>
  ), []);

  return (
    <TooltipProvider>
      <SelectPrimitive.Root 
        value={value} 
        open={open} 
        onOpenChange={setOpen}
        onValueChange={(newValue) => {
          onValueChange(newValue);
          setOpen(false); // Close when a value is selected
        }}
      >
      <SelectPrimitive.Trigger
        className={cn(
          "text-secondary hover:bg-popover-main hover:text-popover-text data-[state=open]:bg-popover-main data-[state=open]:text-popover-text data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex w-fit items-center justify-between gap-2 rounded-md bg-transparent px-3 py-2 text-sm whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 h-9 transition-colors dark:hover:bg-hover/60",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          {isRecommendedSelected && selectedRecommended ? (
            <>
              <selectedRecommended.icon
                className={cn("size-4", selectedRecommended.color)}
              />
              <span className="font-medium">{selectedRecommended.name}</span>
            </>
          ) : selectedModel ? (
            <>
              {(() => {
                const IconComponent =
                  providerIcons[
                    selectedModel.provider as keyof typeof providerIcons
                  ];
                return IconComponent ? (
                  <IconComponent className="size-4" />
                ) : null;
              })()}
              <span className="font-medium">{selectedModel.name}</span>
              {selectedModel.isPremium && (
                <SparklesIcon className="size-3 text-yellow-500" />
              )}
            </>
          ) : (
            <span className="font-medium">Seleccionar modelo</span>
          )}
        </div>
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            "bg-popover-main backdrop-blur-sm text-popover-text data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-[80vh] w-full max-w-[90vw] md:w-[700px] md:max-w-[700px] origin-top overflow-hidden rounded-xl border shadow-lg md:shadow-2xl",
          )}
          position="popper"
          sideOffset={8}
        >
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "recomendado" | "avanzado")
            }
          >
            <TabsList className="w-[calc(100%-2rem)] md:w-fit mx-auto justify-start md:justify-center bg-popover-secondary p-1 mt-4 overflow-x-auto scrollbar-none rounded-lg">
              <TabsTrigger
                value="recomendado"
                className="text-secondary data-[state=active]:bg-popover-main data-[state=active]:text-white px-4 py-3 min-w-max flex-shrink-0 rounded-md"
              >
                Recomendado
              </TabsTrigger>
              <TabsTrigger
                value="avanzado"
                className="text-secondary data-[state=active]:bg-popover-main data-[state=active]:text-white px-4 py-3 min-w-max flex-shrink-0 rounded-md"
              >
                Avanzado
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <SelectPrimitive.Viewport className="h-[500px] max-h-[80vh] overflow-y-auto p-0">
            {activeTab === "recomendado" && (
              <div className="px-4 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6">
                <div className="text-center mb-4 md:mb-6">
                  <h3 className="text-base md:text-lg font-semibold text-popover-text mb-2">
                    Selección Recomendada
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed px-2">
                    Opciones optimizadas para diferentes tipos de tareas
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-0.5">
                  {renderRecommendedItems()}
                </div>
              </div>
            )}

            {activeTab === "avanzado" && (
              <div className="px-4 py-4 md:px-6 md:py-6">
                <div className="text-center mb-4 md:mb-6">
                  <h3 className="text-base md:text-lg font-semibold text-popover-text mb-2">
                    Selección Avanzada
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed px-2">
                    Elige manualmente entre todos los modelos disponibles
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  <div className="space-y-4 md:space-y-6 order-2 md:order-1">
                    {leftColumn.map(({ provider, models }: { provider: string; models: BaseModelConfig[] }) => {
                      const ProviderIcon =
                        providerIcons[provider as keyof typeof providerIcons];

                      return (
                        <SelectPrimitive.Group key={provider}>
                          <SelectPrimitive.Label className="flex items-center gap-2 px-3 py-2 mb-2 text-xs font-semibold text-popover-text border-b border-border/50">
                            {ProviderIcon && (
                              <ProviderIcon className="size-4" />
                            )}
                            {providerNames[
                              provider as keyof typeof providerNames
                            ] || provider}
                          </SelectPrimitive.Label>

                          {models.map((model: BaseModelConfig) => (
                            <ModelItem key={model.id} model={model} />
                          ))}
                        </SelectPrimitive.Group>
                      );
                    })}
                  </div>
                  <div className="space-y-4 md:space-y-6 order-1 md:order-2 mb-4 md:mb-0">
                    {rightColumn.map(({ provider, models }: { provider: string; models: BaseModelConfig[] }) => {
                      const ProviderIcon =
                        providerIcons[provider as keyof typeof providerIcons];

                      return (
                        <SelectPrimitive.Group key={provider}>
                          <SelectPrimitive.Label className="flex items-center gap-2 px-3 py-2 mb-2 text-xs font-semibold text-popover-text border-b border-border/50">
                            {ProviderIcon && (
                              <ProviderIcon className="size-4" />
                            )}
                            {providerNames[
                              provider as keyof typeof providerNames
                            ] || provider}
                          </SelectPrimitive.Label>

                          {models.map((model: BaseModelConfig) => (
                            <ModelItem key={model.id} model={model} />
                          ))}
                        </SelectPrimitive.Group>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
    </TooltipProvider>
  );
}

interface ModelItemProps {
  model: BaseModelConfig;
}

const ModelItem = React.memo(function ModelItem({ model }: ModelItemProps) {
  const ProviderIcon =
    providerIcons[model.provider as keyof typeof providerIcons];

  return (
    <SelectPrimitive.Item
      value={model.id}
      className={cn(
        "focus:bg-popover-secondary focus:text-accent-foreground data-[highlighted]:bg-popover-secondary/40 data-[highlighted]:text-popover-text data-[state=checked]:bg-popover-secondary data-[state=checked]:text-popover-text relative grid grid-cols-[auto_1fr] w-full cursor-pointer rounded-lg p-3 md:p-4 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors border border-transparent hover:border-border/50 hover:bg-popover-secondary/20 mb-2 gap-3 min-h-[72px]",
      )}
    >
      {/* Icon column */}
      <div className="flex items-start justify-center pt-1">
        <div className="flex items-center gap-2">
          {ProviderIcon && <ProviderIcon className="size-4 flex-shrink-0" />}
        </div>
      </div>

      {/* Content column */}
      <div className="flex flex-col min-w-0">
        <SelectPrimitive.ItemText>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{model.name}</span>
            {model.isPremium && (
              <SparklesIcon className="size-3 text-yellow-500 flex-shrink-0" />
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
            {model.description}
          </p>
        </div>
        </SelectPrimitive.ItemText>

        {/* Context and capabilities positioned at the bottom */}
        <div className="flex items-center justify-between w-full mt-2">
        <span className="text-xs text-muted-foreground">
          {Math.round(model.contextWindow / 1000)}K context
        </span>

        <div className="flex items-center gap-1 flex-wrap">
          {Object.entries(model.capabilities)
            .filter(([, enabled]) => enabled)
            .filter(([capability]) => {
              // Exclude specific capabilities from display
              const excludedCapabilities = [
                'supportsStreaming',
                'supportsObjectGeneration',
                'supportsImageOutput'
              ];
              return !excludedCapabilities.includes(capability);
            })
            .map(([capability]) => {
              const IconComponent =
                capabilityIcons[capability as keyof typeof capabilityIcons];
              if (!IconComponent) return null;

              return (
                <Tooltip key={capability}>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-popover-secondary text-popover-text">
                      <IconComponent className="size-3" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {capabilityDescriptions[capability as keyof typeof capabilityDescriptions]}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
        </div>
        </div>
      </div>

      <span className="absolute right-3 top-3 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
});

export { ModelSelector };
