"use client";

import {
  type InputHTMLAttributes,
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@rift/utils";

import { Button } from "./button";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Switch } from "./switch";

/**
 * Single row in a form toggle section: left-aligned title/description/link,
 * optional middle pricing, right-aligned toggle.
 */
export interface FormToggleItem {
  id: string;
  title: string;
  /** Optional icon or other content rendered before the title (e.g. provider icon) */
  icon?: ReactNode;
  /** Optional description; when omitted or empty, only title (and icon) are shown */
  description?: string;
  /** Optional "Learn more" link URL; shows link with external icon when set */
  learnMoreHref?: string;
  /** Optional slot for a per-row action (e.g. "View all models" link) rendered below description */
  actionSlot?: ReactNode;
  /** Optional main price line (e.g. "$10 / month") */
  price?: string;
  /** Optional secondary price line (e.g. "+ $1.20/1M events") */
  priceSub?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * Optional toggle section rendered inside the form card (e.g. Add-Ons style).
 */
export interface FormToggleSection {
  /** Optional heading above the toggle rows (e.g. "Add-Ons") */
  sectionTitle?: string;
  /** When true, each toggle row gets a full-width hover background from content edge to edge (border to border). */
  rowHover?: boolean;
  items: FormToggleItem[];
}

/**
 * Config for using a Select as the form's main field (instead of an input).
 * Submitted as { [name]: value } on Save.
 */
export interface FormSelectConfig {
  name: string;
  /** Initial selected value; defaults to first option's value if omitted */
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}

/**
 * Props for the settings-style Form component.
 * Renders a card with title, description, optional main field (input or select), optional toggle section, help text, and submit button.
 *
 * Extends native form attributes so you can pass className, aria-*, data-*, etc.
 * Main field supports both controlled (value + onValueChange) and uncontrolled (defaultValue via inputAttrs/selectConfig) usage.
 */
export interface FormProps extends Omit<
  React.ComponentProps<"form">,
  "title" | "children"
> {
  /** Section title shown at the top; also used for form accessibility (aria-labelledby) */
  title: string;
  /** Short description below the title */
  description: string;
  /** Optional. When omitted, no text input is rendered. Ignored if selectConfig is provided. */
  inputAttrs?: InputHTMLAttributes<HTMLInputElement>;
  /**
   * Optional fixed prefix shown to the left of the input (e.g. "https://www.").
   * Only used when inputAttrs is used (no selectConfig).
   */
  inputPrefix?: string | ReactNode;
  /**
   * Optional. When provided, the main field is a Select (dropdown) instead of an input.
   * Submitted as { [selectConfig.name]: value } on Save.
   */
  selectConfig?: FormSelectConfig;
  /**
   * Optional toggle section: rows with left-aligned text, optional pricing in the middle, toggle on the right.
   */
  toggleSection?: FormToggleSection;
  /**
   * Optional error message shown above helpText in the footer. When set, the footer uses
   * error styling (red text, red-tinted background) and the error is announced to assistive tech (role="alert").
   * Use for validation or submit errors so inputs and settings forms can show feedback in one place.
   */
  error?: string | ReactNode;
  /**
   * Optional success message shown in the footer. When set (and no error exists), the footer
   * uses a blue info-style treatment to acknowledge a completed mutation.
   */
  success?: string | ReactNode;
  /**
   * Optional help text or custom node below the content.
   * When a string is passed, it is rendered as HTML (dangerouslySetInnerHTML). Only use trusted content to avoid XSS.
   * Prefer passing ReactNode (e.g. JSX) for dynamic or user-derived content.
   */
  helpText?: string | ReactNode;
  /** Optional custom content rendered to the right of the title/description header row. */
  headerSlot?: ReactNode;
  /** Optional class override for the header row container. */
  headerClassName?: string;
  /**
   * Optional custom content area rendered in the form body.
   * Useful for non-input controls (for example, avatar upload UI) while
   * preserving the same settings card structure.
   */
  contentSlot?: ReactNode;
  /** Optional additional classes for the form content container (`p-6` section). */
  contentClassName?: string;
  /** Submit button label */
  buttonText?: string;
  /** Optional secondary button rendered to the left of the submit button */
  secondaryButtonText?: string;
  /** Optional handler for secondary button click */
  onSecondaryClick?: () => void;
  /** Optional. Disables the submit and secondary buttons */
  buttonDisabled?: boolean;
  /** Optional variant for the submit button (e.g., "danger" for destructive actions) */
  buttonVariant?: "default" | "danger" | "ghost" | "dangerLight";
  /** Called on submit when a main field (input or select) is provided; optional when form is toggle-only */
  handleSubmit?: (data: Record<string, string>) => Promise<unknown>;
  /**
   * Controlled value for the main field (input or select). When provided, the form acts in controlled mode.
   * Omit to use uncontrolled mode (initial value from inputAttrs.defaultValue or selectConfig.defaultValue).
   */
  value?: string;
  /**
   * Called when the main field value changes. Use with value for controlled mode.
   */
  onValueChange?: (value: string) => void;
}

function getInitialInputValue(
  defaultValue: InputHTMLAttributes<HTMLInputElement>["defaultValue"],
  prefix: string,
): string | number | readonly string[] | undefined {
  if (typeof defaultValue !== "string" || typeof prefix !== "string")
    return defaultValue;
  if (defaultValue.startsWith(prefix)) return defaultValue.slice(prefix.length);
  return defaultValue;
}

export function Form({
  title,
  description,
  inputAttrs,
  inputPrefix,
  selectConfig,
  toggleSection,
  error,
  success,
  helpText,
  headerSlot,
  headerClassName,
  contentSlot,
  contentClassName,
  buttonText = "Save Changes",
  secondaryButtonText,
  onSecondaryClick,
  buttonDisabled,
  buttonVariant = "default",
  handleSubmit,
  value: controlledValue,
  onValueChange,
  className,
  onSubmit: onSubmitProp,
  ...rest
}: FormProps) {
  const hasInput = inputAttrs != null;
  const hasSelect = selectConfig != null;
  const hasMainField = hasInput || hasSelect;
  const prefixString =
    typeof inputPrefix === "string" ? inputPrefix : undefined;
  const isControlled = controlledValue !== undefined;

  const [uncontrolledValue, setUncontrolledValue] = useState<string>(() => {
    if (hasSelect && selectConfig && selectConfig.options.length > 0) {
      return selectConfig.defaultValue ?? selectConfig.options[0]!.value ?? "";
    }
    if (hasSelect && selectConfig) {
      return selectConfig.defaultValue ?? "";
    }
    if (hasInput && inputAttrs) {
      const raw =
        prefixString != null
          ? getInitialInputValue(inputAttrs.defaultValue, prefixString)
          : inputAttrs.defaultValue;
      return raw == null ? "" : String(raw);
    }
    return "";
  });

  const value = isControlled ? (controlledValue ?? "") : uncontrolledValue;
  const setValue = (next: string) => {
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
  };
  const [saving, setSaving] = useState(false);
  const [dismissedFeedbackKey, setDismissedFeedbackKey] = useState<string | null>(null);

  const sectionTitleId = useId();

  const submittedValue = hasInput
    ? prefixString != null
      ? `${prefixString}${String(value ?? "")}`
      : String(value ?? "")
    : String(value ?? "");

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmitProp?.(e);
    if (!hasMainField || handleSubmit == null) return;
    setSaving(true);
    try {
      await handleSubmit(
        hasSelect
          ? { [selectConfig!.name]: String(value ?? "") }
          : { [inputAttrs!.name as string]: submittedValue },
      );
    } finally {
      setSaving(false);
    }
  };

  const rawFeedbackKey =
    error != null
      ? `error:${typeof error === "string" ? error : "node"}`
      : success != null
        ? `success:${typeof success === "string" ? success : "node"}`
        : null;

  /**
   * Auto-dismiss transient footer feedback after a visible period.
   * When a new message arrives, the timer restarts for the new key.
   */
  useEffect(() => {
    if (rawFeedbackKey == null) {
      setDismissedFeedbackKey(null);
      return;
    }

    if (dismissedFeedbackKey === rawFeedbackKey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDismissedFeedbackKey(rawFeedbackKey);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dismissedFeedbackKey, rawFeedbackKey]);

  const isDismissed =
    rawFeedbackKey != null && dismissedFeedbackKey === rawFeedbackKey;
  const visibleError = !isDismissed ? error : null;
  const visibleSuccess = !isDismissed && visibleError == null ? success : null;

  const feedbackTone =
    visibleError != null
      ? "error"
      : visibleSuccess != null
        ? "info"
        : "default";
  const feedbackKey =
    visibleError != null
      ? `error:${typeof visibleError === "string" ? visibleError : "node"}`
      : visibleSuccess != null
        ? `success:${typeof visibleSuccess === "string" ? visibleSuccess : "node"}`
        : "help";

  const submitButton = (
    <Button
      type="submit"
      variant={buttonVariant}
      size="large"
      disabled={saving || buttonDisabled}
      aria-busy={saving}
    >
      {buttonText}
    </Button>
  );

  return (
    <form
      {...rest}
      onSubmit={handleFormSubmit}
      className={cn(
        "overflow-hidden rounded-xl border border-bg-emphasis bg-transparent",
        className,
      )}
      aria-labelledby={sectionTitleId}
      aria-busy={saving}
      data-state={saving ? "busy" : "idle"}
    >
      {/* Layer container: emphasis background acts as the visual base. */}
      <div className="relative bg-emphasis/50">
        <div
          className={cn(
            "relative z-10 flex flex-col space-y-6 rounded-b-2xl bg-bg-muted p-6",
            contentClassName,
          )}
        >
          <div
            className={cn(
              "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
              headerClassName,
            )}
          >
            <div className="flex flex-col space-y-1">
              <h2
                id={sectionTitleId}
                className="text-base font-semibold text-content-emphasis text-xl"
              >
                {title}
              </h2>
              <p className="text-sm text-content-subtle">{description}</p>
            </div>
            {headerSlot != null ? <div className="shrink-0">{headerSlot}</div> : null}
          </div>

          {contentSlot != null ? contentSlot : null}

          {hasSelect ? (
            <Select value={value} onValueChange={(v) => setValue(v ?? "")}>
              <SelectTrigger className="w-full max-w-md" aria-label={title}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start">
                {selectConfig!.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : hasInput ? (
            inputPrefix != null ? (
              <div className="flex w-full max-w-md overflow-visible rounded-md border border-border-default bg-bg-default text-content-emphasis sm:text-sm">
                <span
                  className="flex shrink-0 items-center border-r border-border-default bg-bg-subtle px-3 py-2 text-content-muted"
                  aria-hidden
                >
                  {inputPrefix}
                </span>
                <Input
                  {...inputAttrs!}
                  type={inputAttrs!.type ?? "text"}
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className={cn(
                    "min-w-0 flex-1 rounded-none rounded-r-md border-0 border-l-0 bg-transparent px-3 py-2 placeholder:text-content-muted",
                    "focus-visible:border-content-subtle focus-visible:ring-3 focus-visible:ring-content-subtle/50 focus-visible:ring-offset-0",
                  )}
                />
              </div>
            ) : (
              <Input
                {...inputAttrs!}
                type={inputAttrs!.type ?? "text"}
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={cn(
                  "max-w-md rounded-md border-border-default text-content-emphasis placeholder:text-content-muted focus-visible:border-content-subtle focus-visible:ring-content-subtle/50 sm:text-sm",
                  inputAttrs!.className,
                )}
              />
            )
          ) : null}

          {toggleSection != null && toggleSection.items.length > 0 && (
            <div className="flex flex-col">
              {toggleSection.sectionTitle != null && (
                <h3 className="mb-4 text-base font-semibold text-content-emphasis">
                  {toggleSection.sectionTitle}
                </h3>
              )}
              <div
                className={cn(
                  !toggleSection.rowHover && "divide-y divide-border-default",
                )}
              >
                {toggleSection.items.map((item, index) => {
                  const rowHover = toggleSection.rowHover === true;
                  return (
                    <Fragment key={item.id}>
                      {rowHover && index > 0 ? (
                        <div
                          className="border-t border-border-default"
                          aria-hidden
                        />
                      ) : null}
                      <div
                        className={cn(
                          rowHover && "-mx-6 px-6 py-4 hover:bg-bg-inverted/5",
                          !rowHover && "py-4",
                        )}
                      >
                        <div
                          className={cn(
                            "grid grid-cols-[40%_1fr_1fr] items-center gap-4",
                            rowHover && "py-0",
                          )}
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="flex items-center gap-2 font-medium text-content-emphasis">
                              {item.icon != null ? (
                                <span className="flex shrink-0" aria-hidden>
                                  {item.icon}
                                </span>
                              ) : null}
                              {item.title}
                            </p>
                            {(item.description != null &&
                              item.description !== "") ||
                            item.learnMoreHref != null ? (
                              <p className="text-sm text-content-subtle">
                                {item.description}
                                {item.learnMoreHref != null ? (
                                  <>
                                    {" "}
                                    <a
                                      href={item.learnMoreHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 font-medium text-accent-default underline underline-offset-2 hover:text-accent-default/80"
                                    >
                                      Learn more
                                      <ExternalLink
                                        className="size-3.5"
                                        aria-hidden
                                      />
                                    </a>
                                  </>
                                ) : null}
                              </p>
                            ) : null}
                            {item.actionSlot != null ? (
                              <div className="pt-1">{item.actionSlot}</div>
                            ) : null}
                          </div>
                          <div className="min-w-0 text-center">
                            {item.price != null ? (
                              <>
                                <p className="font-medium text-content-emphasis">
                                  {item.price}
                                </p>
                                {item.priceSub != null && (
                                  <p className="text-sm text-content-subtle">
                                    {item.priceSub}
                                  </p>
                                )}
                              </>
                            ) : null}
                          </div>
                          <div className="flex justify-end">
                            <Switch
                              checked={item.checked}
                              onCheckedChange={item.onCheckedChange}
                              disabled={item.disabled}
                              aria-label={`Toggle ${item.title}`}
                            />
                          </div>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {(helpText != null || error != null || success != null || hasMainField) && (
          <div
            className={cn(
              "relative z-0 -mt-3 flex flex-col items-start justify-between gap-4 rounded-b-xl border-t px-5 pb-4 pt-6 transition-[background-color,border-color] duration-250 ease-out sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:pb-3 sm:pt-5",
              feedbackTone === "error"
                ? "border-border-subtle bg-bg-error"
                : feedbackTone === "info"
                  ? "border-border-subtle bg-bg-info/25"
                  : "border-border-subtle bg-bg-emphasis/50",
            )}
          >
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
                    <p className="text-content-error font-medium" role="alert">
                      {visibleError}
                    </p>
                  ) : (
                    <div className="text-content-error font-medium" role="alert">
                      {visibleError}
                    </div>
                  )
                ) : visibleSuccess != null ? (
                  typeof visibleSuccess === "string" ? (
                    <p className="text-content-info font-medium" role="status" aria-live="polite">
                      {visibleSuccess}
                    </p>
                  ) : (
                    <div className="text-content-info font-medium" role="status" aria-live="polite">
                      {visibleSuccess}
                    </div>
                  )
                ) : helpText != null ? (
                  typeof helpText === "string" ? (
                    <p
                      className="text-content-subtle prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-content-default transition-colors"
                      dangerouslySetInnerHTML={{ __html: helpText }}
                    />
                  ) : (
                    helpText
                  )
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex h-10 shrink-0 items-center gap-2">
            {secondaryButtonText && hasMainField && (
              <Button
                type="button"
                variant="ghost"
                size="large"
                disabled={saving || buttonDisabled}
                onClick={onSecondaryClick}
              >
                {secondaryButtonText}
              </Button>
            )}
            {hasMainField ? submitButton : null}
          </div>
          {saving && (
            <span role="status" aria-live="polite" className="sr-only">
              Saving…
            </span>
          )}
          </div>
        )}
      </div>
    </form>
  );
}
