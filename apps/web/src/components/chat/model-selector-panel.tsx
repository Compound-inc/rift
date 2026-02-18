"use client";

import * as React from "react";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import FilterIcon from "lucide-react/dist/esm/icons/filter";
import Grid3x3Icon from "lucide-react/dist/esm/icons/grid-3x3";
import BrainIcon from "lucide-react/dist/esm/icons/brain";
import WrenchIcon from "lucide-react/dist/esm/icons/wrench";
import ImageIcon from "lucide-react/dist/esm/icons/image";
import FileTextIcon from "lucide-react/dist/esm/icons/file-text";
import SparklesIcon from "lucide-react/dist/esm/icons/sparkles";
import { cn } from "@rift/utils";
import { Button } from "@rift/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@rift/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rift/ui/tooltip";
import { MODELS, getAllProviders } from "@/lib/ai/ai-providers";
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
import {
  AutoIcon,
  EscrituraIcon,
  ProblemasDificilesIcon,
} from "@/components/ui/icons/svg-icons";

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

const capabilityIcons = {
  supportsTools: WrenchIcon,
  supportsReasoning: BrainIcon,
  supportsImageInput: ImageIcon,
  supportsPDFInput: FileTextIcon,
} as const;

const capabilityColors = {
  supportsTools: "text-emerald-400/70",
  supportsReasoning: "text-purple-400/70",
  supportsImageInput: "text-blue-400/70",
  supportsPDFInput: "text-amber-400/70",
} as const;

const capabilityDescriptions = {
  supportsTools: "Puede usar herramientas como buscar en internet",
  supportsReasoning: "El modelo puede razonar",
  supportsImageInput: "Puede procesar imágenes",
  supportsPDFInput: "Puede procesar archivos PDF",
} as const;

const capabilityOrder: Array<keyof typeof capabilityIcons> = [
  "supportsReasoning",
  "supportsTools",
  "supportsImageInput",
  "supportsPDFInput",
];

const allProviders = getAllProviders();
const modelSearchIndex = MODELS.map((model) => ({
  model,
  searchText: model.name.toLowerCase(),
}));

// Recommended options configuration (same as model-selector.tsx)
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
    id: "imagen",
    name: "Imagen",
    description: "Genera imágenes con IA",
    icon: ImageIcon,
    color: "text-amber-500 dark:text-amber-300",
    bgColor: "hover:bg-amber-50 dark:hover:bg-amber-950/20",
    borderColor: "hover:border-amber-200 dark:hover:border-amber-800",
  },
] as const;

type ProviderId = (typeof allProviders)[number] | "all";

interface ModelSelectorPanelProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function ModelSelectorPanel({
  value,
  onValueChange,
  className,
}: ModelSelectorPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedProvider, setSelectedProvider] = React.useState<ProviderId>("all");

  const selectedModel = React.useMemo(
    () => MODELS.find((model) => model.id === value),
    [value]
  );

  React.useEffect(() => {
    if (!open) {
      setQuery("");
    } else {
      if (selectedModel) {
        setSelectedProvider(selectedModel.provider as ProviderId);
      } else {
        setSelectedProvider("all");
      }
    }
  }, [open, selectedModel]);

  // Check if current value is a recommended option
  const selectedRecommended = RECOMMENDED_OPTIONS.find(
    (option) => option.id === value,
  );
  const isRecommendedSelected = !!selectedRecommended;

  const isSearchActive = query.trim().length > 0;
  const showRecommendedOptions = !isSearchActive && selectedProvider === "all";

  const filteredModels = React.useMemo(() => {
    if (isSearchActive) {
      const normalized = query.trim().toLowerCase();
      return modelSearchIndex
        .filter((entry) => entry.searchText.includes(normalized))
        .map((entry) => entry.model);
    }

    if (selectedProvider === "all") {
      return MODELS;
    }

    return MODELS.filter((model) => model.provider === selectedProvider);
  }, [isSearchActive, query, selectedProvider]);

  const handleModelSelect = React.useCallback(
    (modelId: string) => {
      onValueChange(modelId);
      if (!tourOnDialogStepRef.current) setOpen(false);
    },
    [onValueChange]
  );

  const handleProviderSelect = React.useCallback((provider: ProviderId) => {
    setSelectedProvider(provider);
  }, []);

  const tourOnDialogStepRef = React.useRef(false);

  React.useEffect(() => {
    const openHandler = () => setOpen(true);
    const closeHandler = () => setOpen(false);
    const onStepEnter = () => {
      tourOnDialogStepRef.current = true;
    };
    const onStepLeave = () => {
      tourOnDialogStepRef.current = false;
    };
    window.addEventListener("open-model-selector", openHandler);
    window.addEventListener("close-model-selector", closeHandler);
    window.addEventListener("tour-on-model-selector-step", onStepEnter);
    window.addEventListener("tour-left-model-selector-step", onStepLeave);
    return () => {
      window.removeEventListener("open-model-selector", openHandler);
      window.removeEventListener("close-model-selector", closeHandler);
      window.removeEventListener("tour-on-model-selector-step", onStepEnter);
      window.removeEventListener("tour-left-model-selector-step", onStepLeave);
    };
  }, []);

  const handleOpenChange = React.useCallback((next: boolean) => {
    if (!next && tourOnDialogStepRef.current) return;
    setOpen(next);
  }, []);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className={cn("w-fit", className)}>
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
                  const ProviderIcon =
                    providerIcons[selectedModel.provider as keyof typeof providerIcons];
                  return ProviderIcon ? (
                    <ProviderIcon className="size-4" />
                  ) : null;
                })()}
                <span className="font-medium">{selectedModel.name}</span>
                {selectedModel.isPremium && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center ">
                        <SparklesIcon className="size-3 text-yellow-500" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                      <p className="text-xs">Premium</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
            ) : (
              <span className="font-medium">Seleccionar modelo</span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-onboarding="model-selector-dialog"
        align="start"
        sideOffset={8}
        className="h-[520px] w-[88vw] max-w-[640px] p-0 bg-popover-main/95 text-popover-text border-border/60 shadow-2xl rounded-xl backdrop-blur-md !data-[state=open]:animate-none !data-[state=closed]:animate-none !data-[state=open]:fade-in-0 !data-[state=closed]:fade-out-0 !data-[state=open]:zoom-in-100 !data-[state=closed]:zoom-out-100 !data-[side=bottom]:slide-in-from-top-0 !data-[side=left]:slide-in-from-right-0 !data-[side=right]:slide-in-from-left-0 !data-[side=top]:slide-in-from-bottom-0 !duration-0"
      >
        <div className="flex h-full flex-col">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 pt-3 pb-2">
            <div className="flex items-center gap-3">
              <SearchIcon className="size-5 text-muted-foreground flex-shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar modelos..."
                className="w-full bg-transparent text-sm text-popover-text placeholder:text-muted-foreground outline-none"
                aria-label="Buscar modelos"
              />
            </div>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md border-0 text-muted-foreground hover:text-popover-text outline-none focus-visible:ring-2 focus-visible:ring-popover-text/40 dark:focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-popover-main"
              aria-label="Filtrar modelos"
            >
              <FilterIcon className="size-4" />
            </button>
          </div>
          <div className="flex flex-1 min-h-0">
            <aside
              data-onboarding="model-selector-providers"
              className="w-[64px] py-3 overflow-y-auto border border-border/40 rounded-tr-3xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex flex-col items-center gap-2 pb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ProviderButton
                      isActive={selectedProvider === "all"}
                      onClick={() => handleProviderSelect("all")}
                      label="All providers"
                    >
                      <Grid3x3Icon className="size-5" />
                    </ProviderButton>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={8}>
                    <p className="text-xs">Todos los proveedores</p>
                  </TooltipContent>
                </Tooltip>
                {allProviders.map((provider) => {
                  const ProviderIcon = providerIcons[provider as keyof typeof providerIcons];
                  if (!ProviderIcon) return null;
                  const providerName = providerNames[provider as keyof typeof providerNames] ?? provider;
                  return (
                    <Tooltip key={provider}>
                      <TooltipTrigger asChild>
                        <ProviderButton
                          isActive={selectedProvider === provider}
                          onClick={() => handleProviderSelect(provider)}
                          label={providerName}
                          provider={provider}
                        >
                          <ProviderIcon className="size-5" />
                        </ProviderButton>
                      </TooltipTrigger>
                      <TooltipContent side="left" sideOffset={8}>
                        <p className="text-xs">{providerName}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </aside>
            <div className="flex-1 min-h-0">
            <div className="h-full overflow-y-auto px-1 pt-3 pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {showRecommendedOptions ? (
                  <div className="px-4 py-4 space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="text-base font-semibold text-popover-text mb-2">
                        Selección Recomendada
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Opciones optimizadas para diferentes tipos de tareas
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {RECOMMENDED_OPTIONS.map((option) => {
                        const IconComponent = option.icon;
                        const isSelected = value === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleModelSelect(option.id)}
                            className={cn(
                              "relative flex flex-col items-center gap-3 p-4 rounded-xl border border-border/30 bg-transparent transition-all duration-200 group cursor-pointer hover:border-border/60 hover:bg-popover-secondary/50 min-h-[120px] outline-none focus:bg-popover-secondary/40 focus-visible:ring-2 focus-visible:ring-popover-text/40 dark:focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-popover-main",
                              isSelected && "bg-popover-secondary/40 border-border/80"
                            )}
                          >
                            <div className="flex size-6 shrink-0 items-center justify-center">
                              <IconComponent
                                className={cn("size-6 transition-colors", option.color)}
                              />
                            </div>
                            <div className="text-center space-y-1 flex-1 flex flex-col justify-center min-h-0">
                              <h4 className="font-medium text-sm text-popover-text">
                                {option.name}
                              </h4>
                              <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                                {option.description}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="absolute right-3 top-3 flex size-4 items-center justify-center">
                                <svg
                                  className="size-4 text-popover-text"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : filteredModels.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No hay modelos que coincidan con tu búsqueda.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredModels.map((model) => (
                      <ModelRow
                        key={model.id}
                        model={model}
                        isSelected={model.id === value}
                        onSelect={handleModelSelect}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const rowStyles = {
  contentVisibility: "auto",
  containIntrinsicSize: "0 60px",
} satisfies React.CSSProperties;

interface ModelRowProps {
  model: BaseModelConfig;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function ModelRow({
  model,
  isSelected,
  onSelect,
}: ModelRowProps) {
  const capabilities = capabilityOrder.filter(
    (capability) => model.capabilities[capability]
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(model.id)}
      className={cn(
        "w-full rounded-xl px-3 py-3 text-left transition-colors",
        "hover:bg-popover-secondary/50",
        isSelected && "bg-popover-secondary/40",
        "outline-none focus-visible:ring-2 focus-visible:ring-popover-text/40 dark:focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-popover-main"
      )}
      style={rowStyles}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-popover-text">
              {model.name}
            </span>
            {model.isPremium && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center ">
                    <SparklesIcon className="size-3 text-yellow-500 flex-shrink-0" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="text-xs">Premium</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="text-xs text-muted-foreground line-clamp-1">
            {model.description}
          </div>
        </div>
        {capabilities.length > 0 ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-popover-secondary/80 px-2 py-1 text-[#eaeaea]">
            {capabilities.map((capability) => {
              const Icon = capabilityIcons[capability];
              const colorClass =
                capabilityColors[capability as keyof typeof capabilityColors];
              const description =
                capabilityDescriptions[capability as keyof typeof capabilityDescriptions];
              return Icon ? (
                <Tooltip key={capability}>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex size-5 items-center justify-center "
                      aria-label={capability}
                    >
                      <Icon className={cn("size-3.5", colorClass)} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <p className="text-xs">{description}</p>
                  </TooltipContent>
                </Tooltip>
              ) : null;
            })}
          </div>
        ) : null}
      </div>
    </button>
  );
}

interface ProviderButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  provider?: string;
}

const ProviderButton = React.forwardRef<HTMLButtonElement, ProviderButtonProps>(
  ({ isActive, onClick, label, children, provider, ...props }, ref) => {
    // Icons that use currentColor and need white base color
    const needsWhiteBase = provider === "xai" || provider === "anthropic" || provider === "openai";
    
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={label}
        className={cn(
          "relative flex size-10 items-center justify-center rounded-lg transition-all duration-200",
          // Default: grayed out with grayscale filter
          "grayscale opacity-50",
          // Icons with currentColor get white base when grayed out
          needsWhiteBase && !isActive && "text-white",
          // Hover: remove grayscale and show original colors
          "hover:grayscale-0 hover:opacity-100",
          // Active: same as hover but ensure it's visible
          isActive && "grayscale-0 opacity-100",
          // Brand colors for specific providers on active/hover
          isActive && provider === "xai" && "text-white",
          isActive && provider === "anthropic" && "text-[#D4A574]",
          isActive && provider === "openai" && "text-[#10A37F]",
          provider === "xai" && "hover:text-white",
          provider === "anthropic" && "hover:text-[#D4A574]",
          provider === "openai" && "hover:text-[#10A37F]",
          // Focus styles with better contrast for light mode (popover has dark bg even in light mode)
          "outline-none focus-visible:ring-2 focus-visible:ring-popover-text/40 dark:focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-popover-main"
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

ProviderButton.displayName = "ProviderButton";
