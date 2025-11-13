"use client";

import * as React from "react";
import {
  CheckIcon,
  MessageSquareIcon,
  GraduationCapIcon,
  CodeIcon,
  MinusIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ai/ui/popover";
import { PromptInputButton } from "@/components/ai/prompt-input";
import { PlusIcon } from "@/components/ui/icons/svg-icons";
import { cn } from "@/lib/utils";
import {
  RESPONSE_STYLES,
  type ResponseStyle,
  getResponseStyleConfig,
} from "@/lib/ai/response-styles";

interface ResponseStyleSelectorProps {
  value: ResponseStyle;
  onValueChange: (value: ResponseStyle) => void;
  className?: string;
  disabled?: boolean;
}

const styleIcons = {
  regular: MessageSquareIcon,
  learning: GraduationCapIcon,
  technical: CodeIcon,
  concise: MinusIcon,
} as const;

export function ResponseStyleSelector({
  value,
  onValueChange,
  className,
  disabled,
}: ResponseStyleSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const selectedStyle = getResponseStyleConfig(value);
  const IconComponent = styleIcons[value];
  const displayText = value === "regular" ? "Estilo" : selectedStyle.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PromptInputButton
          variant="ghost"
          className={cn(
            "text-secondary hover:bg-popover-main hover:text-popover-text dark:hover:bg-hover/60",
            className,
          )}
          disabled={disabled}
          aria-label="Estilo de respuesta"
        >
          {value === "regular" ? (
            <PlusIcon className="size-4 opacity-75" />
          ) : (
            IconComponent && <IconComponent className="size-4" />
          )}
        </PromptInputButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="bg-popover-main backdrop-blur-sm text-popover-text w-64 p-2"
      >
        <div className="space-y-1">

          {/* Writing Styles */}
          {Object.values(RESPONSE_STYLES).map((style) => {
            const StyleIcon = styleIcons[style.id];
            const isSelected = style.id === value;
            return (
              <div
                key={style.id}
                onClick={() => {
                  onValueChange(style.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 w-full cursor-pointer rounded-lg p-3 text-sm transition-colors",
                  isSelected
                    ? "bg-popover-secondary/50 text-popover-text"
                    : "hover:bg-popover-secondary/30",
                )}
              >
                {StyleIcon && (
                  <StyleIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium">{style.name}</span>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {style.description}
                  </span>
                </div>
                {isSelected && (
                  <div className="flex size-4 items-center justify-center shrink-0">
                    <CheckIcon className="size-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

