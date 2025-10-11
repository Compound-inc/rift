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
import {
  SentIcon,
  LoadingIcon,
  StopIcon,
  DeleteIcon,
  XIcon,
  AttachmentsIcon,
} from "@/components/ui/icons/svg-icons";
import { AlertTriangle } from "lucide-react";
import type {
  ComponentProps,
  HTMLAttributes,
  KeyboardEventHandler,
} from "react";
import { Children, useRef, useEffect, useCallback, useState } from "react";

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
  placeholder = "¿Qué te gustaría saber?",
  ...props
}: PromptInputTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const maxHeight = 150;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight, props.value]);

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
      ref={textareaRef}
      className={cn(
        "w-full resize-none rounded-none border-none p-3 shadow-none outline-none ring-0",
        "field-sizing-content bg-transparent dark:bg-transparent max-h-[200px] overflow-y-auto",
        "focus-visible:ring-0",
        className,
      )}
      name="message"
      onChange={(e) => {
        onChange?.(e);
        adjustHeight();
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
        "shrink-0 gap-1.5",
        variant === "ghost" && "text-black",
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
  let Icon = <SentIcon className="size-5" />;
  let isStreaming = false;
  let buttonTitle = "Enviar mensaje";

  if (status === "submitted") {
    Icon = <LoadingIcon className="size-5 animate-spin" />;
    buttonTitle = "Enviando...";
  } else if (status === "streaming") {
    Icon = <StopIcon className="size-5" />;
    isStreaming = true;
    buttonTitle = "Detener generación";
  } else if (status === "error") {
    Icon = <AlertTriangle className="size-5" />;
    buttonTitle = "Ocurrió un error";
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
      className={cn(
        "gap-1.5 rounded-lg transition-colors shadow-container-small",
        className,
      )}
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
  <SelectTrigger className={cn(className)} {...props} />
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

export type PromptInputFileUploadProps = ComponentProps<"input"> & {
  onFilesSelected?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
};

export const PromptInputFileUpload = ({
  className,
  onFilesSelected,
  disabled,
  ...props
}: PromptInputFileUploadProps) => {
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const files = e.target.files;
      if (files && files.length > 0) {
        onFilesSelected?.(e);
        // Reset input to allow selecting the same file again
        e.target.value = "";
      }
    },
    [disabled, onFilesSelected]
  );

  return (
    <input
      type="file"
      accept="image/*,application/pdf"
      multiple
      disabled={disabled}
      onChange={handleFileChange}
      className={cn("hidden", className)}
      {...props}
    />
  );
};

export type PromptInputFilePreviewProps = {
  files: (File | { name: string; type: string; url?: string; isUploading?: boolean })[];
  onRemoveFile?: (index: number) => void;
  disabled?: boolean;
};

export const PromptInputFilePreview = ({
  files,
  onRemoveFile,
  disabled,
}: PromptInputFilePreviewProps) => {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-2 border-t bg-muted/50">
      {files.map((file, index) => {
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';
        const isUploading = 'isUploading' in file ? file.isUploading : false;
        
        // Check if it's a File object or a FileAttachment-like object
        const isFileObject = file instanceof File;
        const imageSrc = isFileObject 
          ? URL.createObjectURL(file as File)
          : (file as { url?: string }).url;
        
        return (
          <div
            key={`${file.name}-${index}`}
            className="relative group w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
          >
            {isUploading ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                <LoadingIcon className="w-6 h-6 text-gray-500 dark:text-gray-400 animate-spin" />
              </div>
            ) : isImage && imageSrc ? (
              <img
                src={imageSrc}
                alt={file.name}
                className="w-full h-full object-cover"
              />
            ) : isPdf ? (
              <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-950/20">
                <span className="text-red-600 dark:text-red-400 font-bold text-lg">PDF</span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-blue-950/20">
                <AttachmentsIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            
            {!disabled && onRemoveFile && !isUploading && (
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                title={`Remove ${file.name}`}
              >
                <XIcon className="w-6 h-6 text-white" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
