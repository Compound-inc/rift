"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, Key } from "lucide-react";
import { TablerBrandOpenai } from "./ui/icons/openai-icon";
import { LogosMistralAiIcon } from "./ui/icons/mistral-icon";
import { AnthropicIcon } from "./ui/icons/anthropic-icon";
import { GoogleIcon } from "./ui/icons/google-icon";
import { useModel } from "@/contexts/model-context";
import {
  getModelById,
  getAllProviders,
  getModelsByProvider,
} from "@/lib/ai/ai-providers";
import { ModelInfo } from "./model-info";
import ApiKeyIndicator from "./api-key-indicator";
import OpenRouterIcon from "./ui/icons/openrouter-icon";
import { MaterialSymbolsDiamondOutline } from "./ui/icons/diamond-icon";
import { hasValidApiKey } from "@/lib/api-keys";
import Link from "next/link";
import CustomButton from "./custom-button";

// Provider icon mapping
const providerIcons: Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  openai: TablerBrandOpenai,
  anthropic: AnthropicIcon,
  mistral: LogosMistralAiIcon,
  google: GoogleIcon,
  openrouter: OpenRouterIcon,
};

export function ModelSelector({
  className,
  ...rest
}: React.ComponentProps<"button">) {
  const { selectedModel, setSelectedModel } = useModel();
  const currentModel = getModelById(selectedModel);
  const providers = getAllProviders();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={`${className} hover:bg-sidebar-border-light cursor-pointer px-2 select-none focus-visible:ring-0`}
          {...rest}
          variant="ghost"
        >
          <div className="flex items-center gap-2">
            {currentModel && (
              <>
                {React.createElement(providerIcons[currentModel.provider], {
                  className: "w-4 h-4",
                })}
                <span className="text-sm font-medium">{currentModel.name}</span>
                <ApiKeyIndicator modelId={selectedModel} className="ml-1" />
              </>
            )}
          </div>
          <ChevronDownIcon className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="start">
        {providers.map((provider) => {
          const models = getModelsByProvider(provider);
          const ProviderIcon = providerIcons[provider];

          return (
            <div key={provider}>
              <DropdownMenuLabel className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                <ProviderIcon className="h-4 w-4" />
                {provider}
                {provider === "openai" && !hasValidApiKey("openai") && (
                  <p className="text-xs text-red-500">API Key Required</p>
                )}
                {provider === "openrouter" && !hasValidApiKey("openrouter") && (
                  <p className="text-xs text-green-600">Free Access Available</p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                {models.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`hover:bg-sidebar-border-light focus:bg-sidebar-border-light cursor-pointer`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ProviderIcon className="h-3 w-3" />
                        <div className="flex items-center gap-2">
                          <span className="w-auto truncate text-sm font-medium">
                            {model.name}
                          </span>
                          <div className="flex items-center gap-1">
                            {model.isPremium && (
                              <CustomButton
                                description="Premium model"
                                className="h-min w-min bg-transparent px-0! py-0!"
                              >
                                <MaterialSymbolsDiamondOutline className="text-yellow-500" />
                              </CustomButton>
                            )}
                            <ModelInfo modelInfo={model.description} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              {provider !== providers[providers.length - 1] && (
                <DropdownMenuSeparator />
              )}
            </div>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          <Link
            className="flex items-center gap-2 text-xs hover:underline"
            href="/settings?tab=api-keys"
          >
            <Key className="h-3 w-3" />
            Manage API keys for premium access
          </Link>
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
