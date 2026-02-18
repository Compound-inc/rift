"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@rift/ui/collapsible";
import { cn } from "@rift/utils";
import { ChevronDownIcon } from "lucide-react";
import { ReasoningIcon } from "@/components/ui/icons/svg-icons";
import { Shimmer } from "@/components/chat/shimmer";
import type { ComponentProps } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

function useReasoning() {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export function Reasoning({
  className,
  isStreaming = false,
  open,
  defaultOpen = false,
  onOpenChange,
  duration: durationProp,
  children,
  ...props
}: ReasoningProps) {
  const [isOpen, setIsOpen] = useControllableState({
    prop: open,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const [duration, setDuration] = useControllableState({
    prop: durationProp,
    defaultProp: 0,
  });

  const [hasAutoClosedRef, setHasAutoClosedRef] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isStreaming) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
      return;
    }

    if (startTimeRef.current !== null) {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / MS_IN_S);
      startTimeRef.current = null;
      setDuration(elapsed);
    }
  }, [isStreaming, setDuration]);

  useEffect(() => {
    if (defaultOpen && !isStreaming && isOpen && !hasAutoClosedRef) {
      const timer = setTimeout(() => {
        setIsOpen(false);
        setHasAutoClosedRef(true);
      }, AUTO_CLOSE_DELAY);

      return () => clearTimeout(timer);
    }
  }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosedRef]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
  };

  return (
    <ReasoningContext.Provider
      value={{ isStreaming, isOpen, setIsOpen, duration }}
    >
      <Collapsible
        className={cn("not-prose mb-4 print:hidden", className)}
        onOpenChange={handleOpenChange}
        open={isOpen}
        {...props}
      >
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  );
}

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

export function ReasoningTrigger({ className, children, ...props }: ReasoningTriggerProps) {
  const { isStreaming, isOpen } = useReasoning();

  return (
    <CollapsibleTrigger
      className={cn(
        "flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground transition-colors rounded-md p-2 hover:bg-muted/50",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <ReasoningIcon className="size-4" />
          {isStreaming ? (
            <Shimmer duration={1.5} spread={1.5}>
              Pensando paso a paso...
            </Shimmer>
          ) : (
            <p>Ver proceso de razonamiento</p>
          )}
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform ml-auto",
              isOpen ? "rotate-180" : "rotate-0"
            )}
          />
        </>
      )}
    </CollapsibleTrigger>
  );
}

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: React.ReactNode;
};

export function ReasoningContent({ className, children, ...props }: ReasoningContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        "mt-4 text-sm",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      {...props}
    >
      {children}
    </CollapsibleContent>
  );
}
