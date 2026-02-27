"use client";

import {
  type InputHTMLAttributes,
  type ReactNode,
  useId,
  useState,
} from "react";
import { ExternalLink, Loader2 } from "lucide-react";

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
  description: string;
  /** Optional "Learn more" link URL; shows link with external icon when set */
  learnMoreHref?: string;
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
   * Optional help text or custom node below the content.
   * When a string is passed, it is rendered as HTML (dangerouslySetInnerHTML). Only use trusted content to avoid XSS.
   * Prefer passing ReactNode (e.g. JSX) for dynamic or user-derived content.
   */
  helpText?: string | ReactNode;
  /** Submit button label */
  buttonText?: string;
  /** Optional secondary button rendered to the left of the submit button */
  secondaryButtonText?: string;
  /** Optional handler for secondary button click */
  onSecondaryClick?: () => void;
  /** Optional. Disables the submit and secondary buttons */
  buttonDisabled?: boolean;
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
  helpText,
  buttonText = "Save Changes",
  secondaryButtonText,
  onSecondaryClick,
  buttonDisabled,
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

  const submitButton = (
    <Button
      type="submit"
      variant="default"
      size="large"
      disabled={saving || buttonDisabled}
      aria-busy={saving}
    >
      {saving ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span>Saving...</span>
        </>
      ) : (
        buttonText
      )}
    </Button>
  );

  return (
    <form
      {...rest}
      onSubmit={handleFormSubmit}
      className={cn(
        "rounded-xl border border-border-subtle bg-bg-default",
        className,
      )}
      aria-labelledby={sectionTitleId}
      aria-busy={saving}
      data-state={saving ? "busy" : "idle"}
    >
      <div className="relative flex flex-col space-y-6 p-6">
        <div className="flex flex-col space-y-1">
          <h2
            id={sectionTitleId}
            className="text-base font-semibold text-content-emphasis text-xl"
          >
            {title}
          </h2>
          <p className="text-sm text-content-subtle">{description}</p>
        </div>

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
              className="max-w-md rounded-md border-border-default text-content-emphasis placeholder:text-content-muted focus-visible:border-content-subtle focus-visible:ring-content-subtle/50 sm:text-sm"
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
            <div className="divide-y divide-border-default">
              {toggleSection.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[40%_1fr_1fr] items-center gap-4 py-4 first:pt-0"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-content-emphasis">
                      {item.title}
                    </p>
                    <p className="text-sm text-content-subtle">
                      {item.description}
                      {item.learnMoreHref != null && (
                        <>
                          {" "}
                          <a
                            href={item.learnMoreHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-accent-default underline underline-offset-2 hover:text-accent-default/80"
                          >
                            Learn more
                            <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        </>
                      )}
                    </p>
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
              ))}
            </div>
          </div>
        )}
      </div>

      {(helpText != null || hasMainField) && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-b-xl border-t border-border-subtle bg-bg-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:py-3">
          {typeof helpText === "string" ? (
            <p
              className="text-sm text-content-subtle prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-content-default transition-colors"
              dangerouslySetInnerHTML={{ __html: helpText }}
            />
          ) : (
            helpText
          )}
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
    </form>
  );
}
