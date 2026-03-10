import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@rift/utils"

const inputVariants = cva(
  "block w-full min-w-0 border text-foreground-strong transition-colors placeholder:text-foreground-secondary focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 file:h-6 file:text-sm file:font-medium file:text-foreground-strong file:inline-flex file:border-0 file:bg-transparent sm:text-sm",
  {
    variants: {
      variant: {
        default:
          "border-border-base bg-transparent focus-visible:border-foreground-tertiary focus-visible:ring-3 focus-visible:ring-foreground-tertiary/50 aria-invalid:border-foreground-error aria-invalid:ring-3 aria-invalid:ring-foreground-error/20",
        alt:
          "rounded-xl bg-white/10 border-black/10 dark:border-white/10 text-black dark:text-white transition-all duration-200 hover:bg-white/20 dark:hover:bg-black/30 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-black/40 dark:placeholder:text-white/40 aria-invalid:border-red-500 dark:aria-invalid:border-red-400 aria-invalid:bg-red-50/50 dark:aria-invalid:bg-red-900/20",
      },
      inputSize: {
        default:
          "h-9 rounded-md px-3 py-2",
        large:
          "h-12 rounded-xl px-4 py-3",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
)

export type InputProps = Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants> & {
    showPasswordToggle?: boolean
  }

function Input({
  className,
  type,
  variant = "default",
  inputSize = "default",
  showPasswordToggle = false,
  ...props
}: InputProps) {
  const showPasswordLabel = "Show"
  const hidePasswordLabel = "Hide"
  const [passwordVisible, setPasswordVisible] = React.useState(false)
  const shouldShowPasswordToggle = showPasswordToggle && type === "password"
  const resolvedType = shouldShowPasswordToggle
    ? passwordVisible
      ? "text"
      : "password"
    : type
  const inputClassName = cn(
    inputVariants({ variant, inputSize }),
    shouldShowPasswordToggle && "pr-12",
    className
  )

  if (shouldShowPasswordToggle) {
    return (
      <div className="relative">
        <InputPrimitive
          type={resolvedType}
          data-slot="input"
          data-size={inputSize}
          data-variant={variant}
          className={inputClassName}
          {...props}
        />
        <button
          type="button"
          className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-black/50 transition-colors outline-none hover:text-black focus-visible:ring-2 focus-visible:ring-border-strong/50 disabled:pointer-events-none disabled:opacity-50 dark:text-white/50 dark:hover:text-white"
          aria-label={passwordVisible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={passwordVisible}
          onClick={() => setPasswordVisible((current) => !current)}
          disabled={props.disabled}
        >
          {passwordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    )
  }

  return (
    <InputPrimitive
      type={resolvedType}
      data-slot="input"
      data-size={inputSize}
      data-variant={variant}
      className={inputClassName}
      {...props}
    />
  )
}

export { Input, inputVariants }
