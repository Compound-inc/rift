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
import { GoogleIcon } from "./ui/icons/google-icon";
import { useModel } from "@/contexts/model-context";
import {
  getModelById,
  getAllProviders,
  getModelsByProvider,
} from "@/lib/ai/ai-providers";
import { ModelInfo } from "./model-info";
import ApiKeyIndicator from "./api-key-indicator";
import Link from "next/link";

// Provider icon mapping (Google only)
const providerIcons: Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  google: GoogleIcon,
};

export function ModelSelector({
  className,
  ...rest
}: React.ComponentProps<"button">) {
  const { selectedModel, setSelectedModel } = useModel();
  const currentModel = getModelById(selectedModel);
  // Only Google provider
  const providers = getAllProviders().filter((p) => p === "google");

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
                            <ModelInfo modelInfo={model.description} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
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
            Manage API keys
          </Link>
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
