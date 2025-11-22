'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { MODELS } from "@/lib/ai/ai-providers";
import { AnthropicIcon } from "@/components/ui/icons/anthropic-icon";
import { TablerBrandOpenai } from "@/components/ui/icons/openai-icon";
import { GoogleIcon } from "@/components/ui/icons/google-icon";
import { XAiIcon } from "@/components/ui/icons/xai-icon";
import { DeepSeekIcon } from "@/components/ui/icons/deepseek-icon";
import { LogosMistralAiIcon } from "@/components/ui/icons/mistral-icon";

export function ModelsShowcase() {
  // Provider icon mapping
  const providerIcons = {
    openai: TablerBrandOpenai,
    anthropic: AnthropicIcon,
    google: GoogleIcon,
    xai: XAiIcon,
    deepseek: DeepSeekIcon,
    mistral: LogosMistralAiIcon,
  } as const;

  // Get one representative model from each major provider
  const displayModels = Object.values(
    MODELS.reduce((acc, model) => {
      // Prefer premium models as representatives if available, otherwise first found
      if (!acc[model.provider] || (!acc[model.provider].isPremium && model.isPremium)) {
        acc[model.provider] = model;
      }
      return acc;
    }, {} as Record<string, typeof MODELS[0]>)
  ).slice(0, 6); // Limit to 6 cards

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {displayModels.map((model) => (
          <div
            key={model.id}
            className="group relative border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                {(() => {
                  const ProviderIcon = providerIcons[model.provider as keyof typeof providerIcons];
                  return ProviderIcon ? (
                    <ProviderIcon className="size-5 text-gray-700 dark:text-gray-300" />
                  ) : null;
                })()}
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">
                  {model.provider === 'xai' ? 'xAI' : model.provider.charAt(0).toUpperCase() + model.provider.slice(1)}
                </span>
              </div>
              {model.isPremium && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                  <SparklesIcon className="size-2.5" />
                  PRO
                </span>
              )}
            </div>
            
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-base">
              {model.name}
            </h4>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {model.description}
            </p>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Link 
          href="/models" 
          className="inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-all hover:scale-105 shadow-md hover:shadow-blue-500/25 group"
        >
          Ver todos los modelos
          <ArrowRightIcon className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
        </Link>
          </div>
        </div>
  );
}
