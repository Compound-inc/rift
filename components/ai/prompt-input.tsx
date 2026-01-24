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
  XIcon,
  AttachmentsIcon,
} from "@/components/ui/icons/svg-icons";
import { AlertTriangle } from "lucide-react";
import NextImage from "next/image";
import type {
  ComponentProps,
  HTMLAttributes,
  KeyboardEventHandler,
} from "react";
import { Children, useRef, useEffect, useCallback, useState } from "react";

// Constants for the prompt input shape
const FLARE_SIZE = 64; // w-16 = 64px (size of corner flare squares)
const TOP_BORDER_RADIUS = 24; // rounded-t-3xl = 1.5rem = 24px

export type PromptInputProps = HTMLAttributes<HTMLFormElement> & {
  borderClassName?: string;
};

/**
 * SVG border that traces the unified shape outline including the corner flares.
 * Creates a single continuous path that follows:
 * - Left flare arc (concave curve)
 * - Left side of form
 * - Top-left rounded corner
 * - Top edge
 * - Top-right rounded corner
 * - Right side of form
 * - Right flare arc (concave curve)
 */
const PromptInputBorderSvg = ({ 
  width, 
  height, 
  strokeStyle,
  className
}: { 
  width: number; 
  height: number; 
  strokeStyle: React.CSSProperties;
  className?: string;
}) => {
  const totalWidth = width + (FLARE_SIZE * 2);
  const totalHeight = height;
  
  if (height < FLARE_SIZE) return null;
  
  const formLeft = FLARE_SIZE;
  const formRight = FLARE_SIZE + width;
  const flareTop = totalHeight - FLARE_SIZE;
  
  const path = [
    `M 0 ${totalHeight}`,
    `A ${FLARE_SIZE} ${FLARE_SIZE} 0 0 0 ${formLeft} ${flareTop}`,
    `L ${formLeft} ${TOP_BORDER_RADIUS}`,
    `A ${TOP_BORDER_RADIUS} ${TOP_BORDER_RADIUS} 0 0 1 ${formLeft + TOP_BORDER_RADIUS} 0`,
    `L ${formRight - TOP_BORDER_RADIUS} 0`,
    `A ${TOP_BORDER_RADIUS} ${TOP_BORDER_RADIUS} 0 0 1 ${formRight} ${TOP_BORDER_RADIUS}`,
    `L ${formRight} ${flareTop}`,
    `A ${FLARE_SIZE} ${FLARE_SIZE} 0 0 0 ${totalWidth} ${totalHeight}`,
  ].join(' ');

  return (
    <svg
      className={cn("absolute pointer-events-none hidden md:block z-20", className)}
      style={{
        left: -FLARE_SIZE,
        bottom: 0,
        width: totalWidth,
        height: totalHeight,
      }}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      fill="none"
      overflow="visible"
    >
      <path
        d={path}
        strokeWidth="1"
        style={strokeStyle}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

/** Mobile border - simple rectangle without flares */
const PromptInputMobileBorder = ({ className }: { className?: string }) => (
  <div 
    className={cn(
      "absolute inset-0 rounded-none pointer-events-none md:hidden border",
      className
    )}
  />
);

/** Extracts the color value from border class and applies it to SVG stroke */
const getBorderColorForSvg = (
  borderClass?: string
): { strokeStyle: React.CSSProperties; className?: string } => {
  if (!borderClass) {
    return { strokeStyle: { stroke: "transparent" } };
  }
  
  // Handle custom border classes by using CSS variable directly
  if (borderClass === "border-border") {
    return { strokeStyle: { stroke: "var(--color-border)" } };
  }
  
  // For other border classes (like "border-red-500"), convert to text color class
  // and use currentColor in the SVG stroke
  const textClass = borderClass.replace(/^border-/, "text-");
  return { 
    strokeStyle: { stroke: "currentColor" },
    className: textClass
  };
};

export const PromptInput = ({
  className,
  children,
  borderClassName,
  ...props
}: PromptInputProps) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (formRef.current) {
        setDimensions({
          width: formRef.current.offsetWidth,
          height: formRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (formRef.current) {
      resizeObserver.observe(formRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const { strokeStyle, className: svgClassName } = getBorderColorForSvg(borderClassName);

  return (
    <div className="relative w-full z-[20] overflow-visible">
      {/* Desktop: SVG border tracing the unified shape */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <PromptInputBorderSvg
          width={dimensions.width}
          height={dimensions.height}
          strokeStyle={strokeStyle}
          className={svgClassName}
        />
      )}

      {/* Mobile: Simple border */}
      <PromptInputMobileBorder className={borderClassName} />

      {/* Left flare: outward-curving corner effect */}
      <div className="absolute bottom-0 right-full w-16 h-16 bg-background-secondary overflow-hidden md:block hidden">
        <div className="absolute top-0 left-0 w-[200%] h-[200%] rounded-full bg-background -translate-x-1/2 -translate-y-1/2" />
      </div>
      
      <form
        ref={formRef}
        className={cn(
          "relative w-full divide-y overflow-hidden rounded-none md:rounded-t-3xl rounded-b-none bg-background-secondary z-10",
          className,
        )}
        {...props}
      >
        {children}
      </form>

      {/* Right flare: outward-curving corner effect */}
      <div className="absolute bottom-0 left-full w-16 h-16 bg-background-secondary overflow-hidden md:block hidden">
        <div className="absolute top-0 right-0 w-[200%] h-[200%] rounded-full bg-background translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Floor: covers parent border below the prompt input */}
      <div className="absolute top-full left-0 right-0 h-4 bg-background-secondary md:block hidden" />
      <div className="absolute top-full right-full w-16 h-4 bg-background-secondary md:block hidden" />
      <div className="absolute top-full left-full w-16 h-4 bg-background-secondary md:block hidden" />
    </div>
  );
};

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

      // Check if device is mobile/touch device
      const isMobile = typeof window !== "undefined" && (
        window.matchMedia("(max-width: 768px)").matches || 
        'ontouchstart' in window || 
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
      );

      if (isMobile) {
        // On mobile, Enter always adds a new line
        return;
      }

      // Desktop behavior: Enter submits, Shift+Enter adds newline
      if (e.shiftKey) return; // Allow newline with Shift+Enter

      // Submit on Enter (desktop)
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
        "text-[16px] md:text-[16px] leading-[28px] tracking-[0.015em] proportional-nums whitespace-pre-wrap",
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
    className={cn("flex items-center justify-between px-3 py-2 md:p-1 pb-[max(env(safe-area-inset-bottom),1rem)] md:pb-1", className)}
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
        variant === "ghost" && "",
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
  variant = "secondary",
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
      tabIndex={-1}
      aria-hidden="true"
      {...props}
    />
  );
};

export type PromptInputErrorProps = {
  error: string | null;
  onDismiss?: () => void;
};

export const PromptInputError = ({
  error,
  onDismiss,
}: PromptInputErrorProps) => {
  if (!error) return null;

  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50">
      <AlertTriangle className="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm text-red-800 dark:text-red-200 max-h-[200px] overflow-y-auto">
        {error}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
          title="Descartar error"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
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
    <div className="flex flex-wrap gap-2 p-2 dark:bg-black/25">
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
            className="relative group w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-border bg-gray-50 dark:bg-popover-main"
          >
            {isUploading ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-popover-main">
                <LoadingIcon className="w-6 h-6 text-gray-500 dark:text-gray-400 animate-spin" />
              </div>
            ) : isImage && imageSrc ? (
              <NextImage
                src={imageSrc}
                alt={file.name}
                className="w-full h-full object-cover"
                width={64}
                height={64}
                unoptimized
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
                title={`Eliminar ${file.name}`}
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
