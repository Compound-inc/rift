import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@rift/utils";

const textareaVariants = cva(
  "block w-full min-w-0 border text-foreground-strong transition-colors placeholder:text-foreground-secondary focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 field-sizing-content sm:text-sm",
  {
    variants: {
      variant: {
        default:
          "border-border-base bg-transparent focus-visible:border-foreground-tertiary focus-visible:ring-3 focus-visible:ring-foreground-tertiary/50 aria-invalid:border-foreground-error aria-invalid:ring-3 aria-invalid:ring-foreground-error/20",
        alt: "rounded-xl bg-white/10 border-black/10 dark:border-white/10 text-black dark:text-white transition-all duration-200 hover:bg-white/20 dark:hover:bg-black/30 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-black/40 dark:placeholder:text-white/40 aria-invalid:border-red-500 dark:aria-invalid:border-red-400 aria-invalid:bg-red-50/50 dark:aria-invalid:bg-red-900/20",
      },
      inputSize: {
        default: "min-h-16 rounded-md px-3 py-2",
        large: "min-h-24 rounded-xl px-4 py-3",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  },
);

export type TextareaProps = React.ComponentPropsWithoutRef<"textarea"> &
  VariantProps<typeof textareaVariants>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { className, variant = "default", inputSize = "default", ...props },
    ref,
  ) {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        data-size={inputSize}
        data-variant={variant}
        className={cn(textareaVariants({ variant, inputSize }), className)}
        {...props}
      />
    );
  },
);

export { Textarea, textareaVariants };
