"use client"

import * as React from "react"
import { type ReactNode, useEffect, useId, useState } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AnimatePresence, motion } from "motion/react"
import { XIcon } from "lucide-react"

import { cn } from "@rift/utils"

import { Button } from "./button"

// ---------------------------------------------------------------------------
// Low-level dialog primitives (used to compose dialogs freely)
// ---------------------------------------------------------------------------

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/15 dark:bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50",
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "border border-border-base bg-surface-raised text-foreground-strong data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 grid max-w-[calc(100%-2rem)] gap-4 rounded-xl p-4 text-sm shadow-[0_2px_12px_rgb(0,0,0,0.05)] duration-100 sm:max-w-sm fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="iconSmall"
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            }
          />
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("gap-2 flex flex-col", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "border-t border-border-faint bg-surface-strong -mx-4 -mb-4 rounded-b-xl p-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="ghost">Close</Button>} />
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base leading-none font-medium text-foreground-strong", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-foreground-secondary text-sm *:[a]:hover:text-foreground-primary *:[a]:underline *:[a]:underline-offset-3",
        className,
      )}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// FormDialog — a settings-card–style dialog with title, description, content
// slot, and the same animated footer feedback bar as the Form component.
// ---------------------------------------------------------------------------

/**
 * Props for the settings-card–style FormDialog.
 *
 * Mirrors the Form component's API but wraps the content in a modal dialog
 * instead of an inline card. Supply `trigger` for a self-contained trigger +
 * dialog, or control it externally via `open` / `onOpenChange`.
 */
export interface FormDialogProps {
  /** Optional element that opens the dialog when clicked. */
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Dialog heading; also used for aria-labelledby. */
  title: string
  /** Short description rendered below the title. */
  description: string
  /** Body content rendered between the header and the footer. */
  children?: ReactNode
  /**
   * Optional error message shown in the footer. Takes precedence over
   * success and helpText. Announced via role="alert".
   */
  error?: string | ReactNode
  /**
   * Optional success message shown in the footer when no error is present.
   * Announced via aria-live="polite".
   */
  success?: string | ReactNode
  /**
   * Optional help text shown in the footer when no error or success exists.
   * Strings are rendered as HTML (dangerouslySetInnerHTML) — only use trusted
   * content to avoid XSS. Prefer ReactNode for dynamic or user-derived content.
   */
  helpText?: string | ReactNode
  /** Submit button label. Defaults to "Save Changes". */
  buttonText?: string
  /** Optional secondary button rendered to the left of the submit button. */
  secondaryButtonText?: string
  /** Called when the secondary button is clicked. */
  onSecondaryClick?: () => void
  /** When true, both the submit and secondary buttons are disabled. */
  buttonDisabled?: boolean
  /** When true, only the submit button is disabled. */
  submitButtonDisabled?: boolean
  /** When true, only the secondary button is disabled. */
  secondaryButtonDisabled?: boolean
  /** Variant for the submit button. Defaults to "default". */
  buttonVariant?: "default" | "danger" | "ghost" | "dangerLight"
  /**
   * Async handler called on form submit. The dialog remains open while the
   * promise is pending; the saving state is cleared when it settles.
   */
  handleSubmit?: () => Promise<unknown>
}

export function FormDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  children,
  error,
  success,
  helpText,
  buttonText = "Save Changes",
  secondaryButtonText,
  onSecondaryClick,
  buttonDisabled,
  submitButtonDisabled,
  secondaryButtonDisabled,
  buttonVariant = "default",
  handleSubmit,
}: FormDialogProps) {
  const sectionTitleId = useId()
  const [saving, setSaving] = useState(false)
  const [dismissedFeedbackKey, setDismissedFeedbackKey] = useState<
    string | null
  >(null)

  const rawFeedbackKey =
    error != null
      ? `error:${typeof error === "string" ? error : "node"}`
      : success != null
        ? `success:${typeof success === "string" ? success : "node"}`
        : null

  /**
   * Auto-dismiss transient footer feedback after 10 s.
   * The timer restarts whenever a new message key arrives.
   */
  useEffect(() => {
    if (rawFeedbackKey == null) {
      setDismissedFeedbackKey(null)
      return
    }
    if (dismissedFeedbackKey === rawFeedbackKey) return

    const id = window.setTimeout(() => {
      setDismissedFeedbackKey(rawFeedbackKey)
    }, 10_000)

    return () => window.clearTimeout(id)
  }, [dismissedFeedbackKey, rawFeedbackKey])

  const isDismissed =
    rawFeedbackKey != null && dismissedFeedbackKey === rawFeedbackKey
  const visibleError = !isDismissed ? error : null
  const visibleSuccess =
    !isDismissed && visibleError == null ? success : null

  const feedbackTone =
    visibleError != null ? "error" : visibleSuccess != null ? "info" : "default"

  const feedbackKey =
    visibleError != null
      ? `error:${typeof visibleError === "string" ? visibleError : "node"}`
      : visibleSuccess != null
        ? `success:${typeof visibleSuccess === "string" ? visibleSuccess : "node"}`
        : "help"

  const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (handleSubmit == null) return
    setSaving(true)
    try {
      await handleSubmit()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger != null && React.isValidElement(trigger) ? (
        <DialogPrimitive.Trigger render={trigger as React.ReactElement} />
      ) : null}

      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          aria-labelledby={sectionTitleId}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-lg",
            "-translate-x-1/2 -translate-y-1/2 outline-none",
            "overflow-hidden rounded-xl border border-surface-strong bg-transparent",
            "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 duration-100",
          )}
        >
          <form
            onSubmit={onFormSubmit}
            aria-busy={saving}
            data-state={saving ? "busy" : "idle"}
          >
            {/* Emphasis base layer — same layered background as Form */}
            <div className="relative bg-surface-strong/50">
              {/* Content card */}
              <div className="relative z-10 flex flex-col space-y-6 rounded-b-2xl bg-surface-raised p-6">
                {/* Close button */}
                <DialogPrimitive.Close
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      size="iconSmall"
                    >
                      <XIcon />
                      <span className="sr-only">Close</span>
                    </Button>
                  }
                />

                {/* Header */}
                <div className="flex flex-col space-y-1 pr-8">
                  <h2
                    id={sectionTitleId}
                    className="text-xl font-semibold text-foreground-strong"
                  >
                    {title}
                  </h2>
                  <p className="text-sm text-foreground-tertiary">{description}</p>
                </div>

                {/* Body */}
                {children != null ? children : null}
              </div>

              {/* Footer — visually identical to Form's footer */}
              <div
                className={cn(
                  "relative z-0 -mt-3 flex flex-col items-start justify-between gap-4 rounded-b-xl border-t px-5 pb-4 pt-6",
                  "transition-[background-color,border-color] duration-250 ease-out",
                  "sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:pb-3 sm:pt-5",
                  feedbackTone === "error"
                    ? "border-border-faint bg-surface-error"
                    : feedbackTone === "info"
                      ? "border-border-faint bg-surface-info/25"
                      : "border-border-faint bg-surface-strong",
                )}
              >
                {/* Feedback area */}
                <div className="min-h-[1.25rem] min-w-0 flex-1 text-sm">
                  <AnimatePresence initial={false} mode="wait">
                    <motion.div
                      key={feedbackKey}
                      initial={{ opacity: 0, y: 3, filter: "blur(0.5px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -2, filter: "blur(0.5px)" }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {visibleError != null ? (
                        typeof visibleError === "string" ? (
                          <p
                            className="font-medium text-foreground-error"
                            role="alert"
                          >
                            {visibleError}
                          </p>
                        ) : (
                          <div
                            className="font-medium text-foreground-error"
                            role="alert"
                          >
                            {visibleError}
                          </div>
                        )
                      ) : visibleSuccess != null ? (
                        typeof visibleSuccess === "string" ? (
                          <p
                            className="font-medium text-foreground-info"
                            role="status"
                            aria-live="polite"
                          >
                            {visibleSuccess}
                          </p>
                        ) : (
                          <div
                            className="font-medium text-foreground-info"
                            role="status"
                            aria-live="polite"
                          >
                            {visibleSuccess}
                          </div>
                        )
                      ) : helpText != null ? (
                        typeof helpText === "string" ? (
                          <p
                            className="text-foreground-tertiary prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-foreground-primary transition-colors"
                            dangerouslySetInnerHTML={{ __html: helpText }}
                          />
                        ) : (
                          helpText
                        )
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Actions */}
                <div className="flex h-10 shrink-0 items-center gap-2">
                  {secondaryButtonText != null && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="large"
                      disabled={saving || buttonDisabled || secondaryButtonDisabled}
                      onClick={onSecondaryClick}
                    >
                      {secondaryButtonText}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant={buttonVariant}
                    size="large"
                    disabled={saving || buttonDisabled || submitButtonDisabled}
                    aria-busy={saving}
                  >
                    {buttonText}
                  </Button>
                </div>

                {saving && (
                  <span role="status" aria-live="polite" className="sr-only">
                    Saving…
                  </span>
                )}
              </div>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
