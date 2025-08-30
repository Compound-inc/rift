import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type ScrollButtonAlignment = "left" | "center" | "right";

interface ScrollButtonProps {
  onClick: () => void;
  alignment?: ScrollButtonAlignment;
  className?: string;
}

export function ScrollButton({
  onClick,
  alignment = "right",
  className,
}: ScrollButtonProps) {
  const alignmentClasses = {
    left: "left-4",
    center: "left-1/2 -translate-x-1/2",
    right: "right-4",
  };

  return (
    <Button
      variant="secondary"
      className={cn(
        "hover:bg-chat-scroll-hover text-chat-scroll-text bg-sidebar border-sidebar-border absolute bottom-4 h-8 cursor-pointer rounded-full border-2 text-xs font-semibold shadow-none",
        alignmentClasses[alignment],
        className,
      )}
      onClick={onClick}
    >
      Scroll to bottom
      <ChevronDown className="h-4 w-4" />
    </Button>
  );
}

interface ChatMessageAreaProps {
  children: ReactNode;
  className?: string;
  scrollButtonAlignment?: ScrollButtonAlignment;
}

export function ChatMessageArea({ children, className }: ChatMessageAreaProps) {
  return (
    <ScrollArea className="relative flex-1">
      <div className={cn(className, "min-h-0 pb-40")}>{children}</div>
    </ScrollArea>
  );
}

ChatMessageArea.displayName = "ChatMessageArea";
