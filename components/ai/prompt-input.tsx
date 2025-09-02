"use client";

import { Button } from "@/components/ai/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ai/ui/select";
import { Textarea } from "@/components/ai/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChatStatus } from "ai";
import Image from "next/image";
import type {
  ComponentProps,
  HTMLAttributes,
  KeyboardEventHandler,
} from "react";
import { Children } from "react";

export type PromptInputProps = HTMLAttributes<HTMLFormElement>;

export const PromptInput = ({ className, ...props }: PromptInputProps) => (
  <form
    className={cn(
      "w-full divide-y overflow-hidden rounded-t-xl border bg-background shadow-sm",
      className,
    )}
    {...props}
  />
);

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) => {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;

      if (e.shiftKey) return; // Allow newline with Shift+Enter

      // Submit on Enter
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) form.requestSubmit();
    }
  };

  return (
    <Textarea
      className={cn(
        "w-full resize-none rounded-none border-none p-3 shadow-none outline-none ring-0",
        "field-sizing-content max-h-[6lh] bg-transparent dark:bg-transparent",
        "focus-visible:ring-0",
        className,
      )}
      name="message"
      onChange={(e) => {
        onChange?.(e);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputToolbar = ({
  className,
  ...props
}: PromptInputToolbarProps) => (
  <div
    className={cn("flex items-center justify-between p-1", className)}
    {...props}
  />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

export type PromptInputButtonProps = ComponentProps<typeof Button>;

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  ...props
}: PromptInputButtonProps) => {
  const newSize =
    (size ?? Children.count(props.children) > 1) ? "default" : "icon";

  return (
    <Button
      className={cn(
        "shrink-0 gap-1.5 rounded-lg",
        variant === "ghost" && "text-muted-foreground",
        newSize === "default" && "px-3",
        className,
      )}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    />
  );
};

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: ChatStatus;
  onStop?: () => void;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status,
  children,
  onStop,
  onClick,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <Image src="/sent.svg" alt="Send" width={16} height={16} className="size-4" />;
  let isStreaming = false;
  let buttonTitle = "Send message";

  if (status === "submitted") {
    Icon = <Image src="/loading.svg" alt="Loading" width={16} height={16} className="size-4 animate-spin" />;
    buttonTitle = "Sending...";
  } else if (status === "streaming") {
    Icon = <Image src="/stop.svg" alt="Stop" width={16} height={16} className="size-4" />;
    isStreaming = true;
    buttonTitle = "Stop generation";
  } else if (status === "error") {
    Icon = <Image src="/Delete.svg" alt="Error" width={16} height={16} className="size-4" />;
    buttonTitle = "Error occurred";
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isStreaming && onStop) {
      e.preventDefault();
      e.stopPropagation();
      onStop();
    } else if (onClick) {
      onClick(e);
    }
  };

  return (
    <Button
      className={cn("gap-1.5 rounded-lg", className)}
      size={size}
      type={isStreaming ? "button" : "submit"}
      variant={variant}
      onClick={handleClick}
      title={buttonTitle}
      aria-label={buttonTitle}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};

export type PromptInputModelSelectProps = ComponentProps<typeof Select>;

export const PromptInputModelSelect = (props: PromptInputModelSelectProps) => (
  <Select {...props} />
);

export type PromptInputModelSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;

export const PromptInputModelSelectTrigger = ({
  className,
  ...props
}: PromptInputModelSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "border-none font-medium text-muted-foreground shadow-none transition-colors",
      "!bg-transparent hover:!bg-accent hover:text-foreground",
      "dark:!bg-transparent dark:hover:!bg-accent",
      className,
    )}
    {...props}
  />
);

export type PromptInputModelSelectContentProps = ComponentProps<
  typeof SelectContent
>;

export const PromptInputModelSelectContent = ({
  className,
  ...props
}: PromptInputModelSelectContentProps) => (
  <SelectContent className={cn(className)} {...props} />
);

export type PromptInputModelSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputModelSelectItem = ({
  className,
  ...props
}: PromptInputModelSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
);

export type PromptInputModelSelectValueProps = ComponentProps<
  typeof SelectValue
>;

export const PromptInputModelSelectValue = ({
  className,
  ...props
}: PromptInputModelSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
);
