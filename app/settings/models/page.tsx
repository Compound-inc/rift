'use client';

import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import {
  SettingsSection,
  SettingsDivider,
} from "@/components/settings";
import { MODELS } from "@/lib/ai/ai-providers";
import { type BaseModelConfig } from "@/lib/ai/config/base";
import { AnthropicIcon } from "@/components/ui/icons/anthropic-icon";
import { TablerBrandOpenai } from "@/components/ui/icons/openai-icon";
import { GoogleIcon } from "@/components/ui/icons/google-icon";
import { XAiIcon } from "@/components/ui/icons/xai-icon";
import { DeepSeekIcon } from "@/components/ui/icons/deepseek-icon";
import { LogosMistralAiIcon } from "@/components/ui/icons/mistral-icon";
import { PrimeIntellectIcon } from "@/components/ui/icons/prime-intellect-icon";
import {
  SparklesIcon,
  WrenchIcon,
  BrainIcon,
  ZapIcon,
  FileIcon,
  SearchIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ai/ui/tooltip";

export default function ModelsPage() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Provider icon mapping (same as model-selector.tsx)
  const providerIcons = {
    openai: TablerBrandOpenai,
    anthropic: AnthropicIcon,
    google: GoogleIcon,
    xai: XAiIcon,
    deepseek: DeepSeekIcon,
    mistral: LogosMistralAiIcon,
    "prime-intellect": PrimeIntellectIcon,
  } as const;

  // Capability icon mapping
  const capabilityIcons = {
    supportsTools: WrenchIcon,
    supportsReasoning: BrainIcon,
    supportsStreaming: ZapIcon,
    supportsImageInput: FileIcon,
    supportsPDFInput: FileIcon,
  } as const;

  // Capability descriptions for pills
  const capabilityDescriptions = {
    supportsTools: "Usa Herramientas",
    supportsReasoning: "Razona",
    supportsImageInput: "Puede Comprender Imágenes",
    supportsPDFInput: "Puede Comprender PDFs",
  } as const;

  // Provider display names (same as model-selector.tsx)
  const providerNames = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    xai: "xAI",
    deepseek: "DeepSeek",
    mistral: "Mistral",
    "prime-intellect": "Prime Intellect",
  } as const;

  // Filter models based on search query
  const filteredModels = MODELS.filter(model => 
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group filtered models by provider
  const groupedModels = filteredModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof MODELS>);


  return (
    <TooltipProvider>
      <div className="py-6 px-4 md:py-12 md:px-12 flex flex-col max-w-4xl min-w-0 md:min-w-[520px] w-full min-h-full box-border bg-background dark:bg-popover-main">
        {/* Models Management */}
        <SettingsSection
          title="Modelos de IA"
          description="Gestiona qué modelos de IA están disponibles para usar en la aplicación."
        >
        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar modelos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-popover-secondary text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-border focus:border-transparent"
            />
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedModels).map(([provider, models]) => (
            <div key={provider} className="space-y-4">
              {/* Provider Header */}
              <div className="flex items-center space-x-3 pb-2 border-b border-gray-200 dark:border-border">
                {(() => {
                  const ProviderIcon = providerIcons[provider as keyof typeof providerIcons];
                  return ProviderIcon ? (
                    <ProviderIcon className="size-6 text-gray-700 dark:text-gray-300" />
                  ) : null;
                })()}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {providerNames[provider as keyof typeof providerNames] || provider}
                </h3>
                <span className="text-sm text-gray-500 dark:text-text-muted">
                  ({models.length} modelo{models.length !== 1 ? 's' : ''})
                </span>
              </div>

              {/* Models List */}
              <div className="space-y-3">
                {models.map((model) => (
                  <div
                    key={model.id}
                    className="border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            {(() => {
                              const ProviderIcon = providerIcons[model.provider as keyof typeof providerIcons];
                              return ProviderIcon ? (
                                <ProviderIcon className="size-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                              ) : null;
                            })()}
                            <h4 className="font-medium text-gray-900 dark:text-white truncate">
                              {model.name}
                            </h4>
                            {model.isPremium && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                                <SparklesIcon className="size-3" />
                                Premium
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-text-muted mb-3">
                            {model.description}
                          </p>
                          
                          {/* Capabilities Pills */}
                          <div className="flex flex-wrap gap-2 mb-3">
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
                                const IconComponent = capabilityIcons[capability as keyof typeof capabilityIcons];
                                const description = capabilityDescriptions[capability as keyof typeof capabilityDescriptions];
                                
                                if (!IconComponent || !description) return null;

                                return (
                                  <div
                                    key={capability}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800"
                                  >
                                    <IconComponent className="size-3" />
                                    <span>{description}</span>
                                  </div>
                                );
                              })}
                          </div>

                          {/* Model Stats */}
                          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-text-muted">
                            <span>Contexto: {Math.round(model.contextWindow / 1000)}K</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
      </div>
    </TooltipProvider>
  );
}
