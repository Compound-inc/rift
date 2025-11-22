'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRightIcon } from "lucide-react";
import { MODELS } from "@/lib/ai/ai-providers";
import { AnthropicIcon } from "@/components/ui/icons/anthropic-icon";
import { TablerBrandOpenai } from "@/components/ui/icons/openai-icon";
import { GoogleIcon } from "@/components/ui/icons/google-icon";
import { XAiIcon } from "@/components/ui/icons/xai-icon";
import { DeepSeekIcon } from "@/components/ui/icons/deepseek-icon";
import { LogosMistralAiIcon } from "@/components/ui/icons/mistral-icon";
import { MoonshotIcon } from "@/components/ui/icons/moonshot-icon";
import { Button } from "@/components/ai/ui/button";
import { cn } from "@/lib/utils";

const MarqueeCard = ({ model }: { model: typeof MODELS[0] }) => {
  // Provider icon mapping
  const providerIcons = {
    openai: TablerBrandOpenai,
    anthropic: AnthropicIcon,
    google: GoogleIcon,
    xai: XAiIcon,
    deepseek: DeepSeekIcon,
    mistral: LogosMistralAiIcon,
    moonshot: MoonshotIcon,
    moonshotai: MoonshotIcon, // Add the 'moonshotai' key to match the provider string in config
  } as const;

  const ProviderIcon = providerIcons[model.provider as keyof typeof providerIcons];

  return (
    <div className="flex-shrink-0 w-[300px] mx-3 h-full" style={{ willChange: 'transform' }}>
      <div className="h-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl p-5 flex flex-col justify-between" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
        <div>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              {ProviderIcon ? (
                <ProviderIcon className="size-5 text-gray-700 dark:text-gray-300" />
              ) : null}
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">
                {model.provider === 'xai' ? 'xAI' : 
                 model.provider === 'moonshotai' ? 'Moonshot' :
                 model.provider.charAt(0).toUpperCase() + model.provider.slice(1)}
              </span>
            </div>
          </div>
          
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-base">
            {model.name}
          </h4>
          
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {model.description}
          </p>
        </div>
      </div>
    </div>
  );
};

const MarqueeRow = ({ 
  models, 
  reverse = false, 
  duration = "40s" 
}: { 
  models: typeof MODELS, 
  reverse?: boolean, 
  duration?: string 
}) => {
  return (
    <div className="flex overflow-hidden w-full group relative py-3">
       {/* Mask gradients - Made wider for better fade effect */}
       <div className="absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
       <div className="absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />
       
      <div 
        className={cn(
          "flex min-w-full shrink-0 items-stretch gap-0",
          "animate-marquee"
        )}
        style={{
          animationDirection: reverse ? 'reverse' : 'normal',
          animationDuration: duration,
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {models.map((model, i) => (
          <MarqueeCard key={`${model.id}-${i}`} model={model} />
        ))}
      </div>
      <div 
        className={cn(
          "flex min-w-full shrink-0 items-stretch gap-0",
          "animate-marquee"
        )}
        style={{
          animationDirection: reverse ? 'reverse' : 'normal',
          animationDuration: duration,
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
        aria-hidden="true"
      >
        {models.map((model, i) => (
          <MarqueeCard key={`${model.id}-duplicate-${i}`} model={model} />
        ))}
      </div>
      
      <style jsx>{`
        @keyframes marquee {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-100%, 0, 0); }
        }
        .animate-marquee {
          animation-name: marquee;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
};

// Deterministic shuffle function
function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let m = shuffled.length;
  let t: T;
  let i: number;

  // LCG parameters
  const a = 1664525;
  const c = 1013904223;
  const mod = 4294967296;
  let currentSeed = seed;

  const random = () => {
    currentSeed = (a * currentSeed + c) % mod;
    return currentSeed / mod;
  };

  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    i = Math.floor(random() * m--);

    // And swap it with the current element.
    t = shuffled[m];
    shuffled[m] = shuffled[i];
    shuffled[i] = t;
  }

  return shuffled;
}

export function ModelsMarquee() {
  // Use useMemo to ensure stable shuffle across re-renders but it will run on every client
  // Since we want server/client consistency, we use a fixed seed.
  const shuffledModels = useMemo(() => seededShuffle(MODELS, 12345), []);

  // Split models into 3 rows
  const chunkSize = Math.ceil(shuffledModels.length / 3);
  const row1 = shuffledModels.slice(0, chunkSize);
  const row2 = shuffledModels.slice(chunkSize, chunkSize * 2);
  const row3 = shuffledModels.slice(chunkSize * 2);

  return (
    <div className="w-full flex flex-col py-5">
      <MarqueeRow models={row1} duration="140s" />
      <MarqueeRow models={row2} reverse duration="210s" />
      <MarqueeRow models={row3} duration="100s" />
    </div>
  );
}
