"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { cn } from "@rift/utils";
import { getIconByName } from "./icon-registry";
import { PromptInputButton } from "@/components/chat/prompt-input";

export function SelectedInstructionPill({
  instructionId,
  className,
  onClick,
}: {
  instructionId: string | undefined;
  className?: string;
  onClick?: () => void;
}) {
  const instruction = useQuery(
    api.customInstructions.get,
    instructionId
      ? { id: instructionId as Id<"customInstructions"> }
      : "skip",
  );

  if (!instructionId) return null;
  if (instruction === undefined) return null;
  if (instruction === null) return null;

  const Icon = getIconByName(instruction.icon);

  return (
    <PromptInputButton
      variant="ghost"
      className={cn("max-w-[220px]", className)}
      title={`Instrucción: ${instruction.title}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <Icon
        className="size-4 shrink-0"
        style={{ color: instruction.iconColor || "currentColor" }}
      />
      <span className="font-medium truncate">{instruction.title}</span>
    </PromptInputButton>
  );
}

