'use client';

import React, { useState } from 'react';
import { MODELS } from "@/lib/ai/ai-providers";
import { AnthropicIcon } from "@/components/ui/icons/anthropic-icon";
import { TablerBrandOpenai } from "@/components/ui/icons/openai-icon";
import { GoogleIcon } from "@/components/ui/icons/google-icon";
import { XAiIcon } from "@/components/ui/icons/xai-icon";
import { DeepSeekIcon } from "@/components/ui/icons/deepseek-icon";
import { LogosMistralAiIcon } from "@/components/ui/icons/mistral-icon";
import { MoonshotIcon } from "@/components/ui/icons/moonshot-icon";
import { ZaiIcon } from "@/components/ui/icons/zai-icon";
import { PrimeIntellectIcon } from "@/components/ui/icons/prime-intellect-icon";
import {
  WrenchIcon,
  BrainIcon,
  ZapIcon,
  FileIcon,
  SearchIcon,
} from "lucide-react";
import type { Dictionary } from "@/types/dictionary";

const DEFAULT_CAPABILITIES = {
  supportsTools: "Tools",
  supportsReasoning: "Reasoning",
  supportsImageInput: "Vision",
  supportsPDFInput: "PDF",
} as const;

type ModelsGridProps = {
  dict: Dictionary;
  modelDescriptions?: Record<string, string>;
};

export function ModelsGrid({ dict, modelDescriptions }: ModelsGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const m = dict.modelsPage;
  const capabilityLabels = m.capabilities;

  // Provider icon mapping
  const providerIcons = {
    openai: TablerBrandOpenai,
    anthropic: AnthropicIcon,
    google: GoogleIcon,
    xai: XAiIcon,
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
    supportsStreaming: ZapIcon,
    supportsImageInput: FileIcon,
    supportsPDFInput: FileIcon,
  } as const;

  // Provider display names
  const providerNames = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    xai: "xAI",
    deepseek: "DeepSeek",
    mistral: "Mistral",
    moonshotai: "Moonshot AI",
    zai: "Z.AI",
    "prime-intellect": "Prime Intellect",
  } as const;

  // Filter models based on search query (include translated description when present)
  const getModelDescription = (model: (typeof MODELS)[number]) =>
    modelDescriptions?.[model.id] ?? model.description;
  const filteredModels = MODELS.filter((model) => {
    const q = searchQuery.toLowerCase();
    const desc = getModelDescription(model);
    return (
      model.name.toLowerCase().includes(q) ||
      desc.toLowerCase().includes(q) ||
      model.provider.toLowerCase().includes(q)
    );
  });

  // Group filtered models by provider
  const groupedModels = filteredModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof MODELS>);

  return (
    <div className="w-full mt-12">
      {/* Search Input */}
      <div className="mb-8 max-w-xl mx-auto">
        <div className="relative group">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder={m.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-border rounded-xl bg-white/50 dark:bg-popover-secondary backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedModels).map(([provider, models]) => (
          <div key={provider} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Provider Header */}
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-200/60 dark:border-border">
              {(() => {
                const ProviderIcon = providerIcons[provider as keyof typeof providerIcons];
                return ProviderIcon ? (
                  <ProviderIcon className="size-6 text-gray-700 dark:text-gray-300" />
                ) : null;
              })()}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {providerNames[provider as keyof typeof providerNames] || provider}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-popover-secondary text-xs text-gray-500 dark:text-text-muted font-medium">
                {models.length}
              </span>
            </div>

            {/* Models Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="group relative border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-xl p-4 hover:border-accent"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const ProviderIcon = providerIcons[model.provider as keyof typeof providerIcons];
                          return ProviderIcon ? (
                            <ProviderIcon className="size-4 text-gray-500 dark:text-gray-400 opacity-70" />
                          ) : null;
                        })()}
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                          {model.name}
                        </h4>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-600 dark:text-text-muted mb-3 line-clamp-2 flex-grow">
                      {getModelDescription(model)}
                    </p>
                    
                    {/* Capabilities Pills - Minimal */}
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-gray-100 dark:border-border">
                      {Object.entries(model.capabilities)
                        .filter(([, enabled]) => enabled)
                        .filter(([capability]) => {
                          const excludedCapabilities = [
                            'supportsStreaming',
                            'supportsObjectGeneration',
                            'supportsImageOutput'
                          ];
                          return !excludedCapabilities.includes(capability);
                        })
                        .slice(0, 3) // Limit to 3 pills
                        .map(([capability]) => {
                          const IconComponent = capabilityIcons[capability as keyof typeof capabilityIcons];
                          if (!IconComponent) return null;

                          return (
                            <div
                              key={capability}
                              className="inline-flex items-center justify-center size-6 rounded-full bg-gray-50 dark:bg-popover-secondary text-gray-600 dark:text-text-muted border border-gray-200 dark:border-border"
                              title={capabilityLabels[capability as keyof typeof capabilityLabels] ?? DEFAULT_CAPABILITIES[capability as keyof typeof DEFAULT_CAPABILITIES]}
                            >
                              <IconComponent className="size-3" />
                            </div>
                          );
                        })}
                        <div className="ml-auto text-[10px] font-mono text-gray-400 dark:text-text-muted">
                          {model.contextWindow >= 1000000
                            ? `${Math.round(model.contextWindow / 1000000)}M`
                            : `${Math.round(model.contextWindow / 1000)}k`}
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {Object.keys(groupedModels).length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center size-12 rounded-full bg-gray-100 dark:bg-popover-secondary mb-4">
              <SearchIcon className="size-6 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-text-muted">{m.noResults}</p>
          </div>
        )}
      </div>
    </div>
  );
}


