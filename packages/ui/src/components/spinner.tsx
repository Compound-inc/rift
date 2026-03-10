import { cn } from "@rift/utils";
import React from "react";

export type SpinnerProps = React.SVGProps<SVGSVGElement> & {
  /**
   * Visual size of the spinner in pixels. Consumers can still override
   * dimensions via `className` (e.g. `size-5`).
   */
  size?: number;
};

/**
 * Shared spinner primitive based on the chat submit "sending" glyph.
 * It intentionally does not enforce animation so each usage can control
 * motion and timing (for example by applying `animate-spin` at call sites).
 */
export function Spinner({ className, size = 40, ...props }: SpinnerProps) {
  const clipId = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground-secondary", className)}
      role="status"
      aria-label="Loading"
      {...props}
    >
      <g clipPath={`url(#${clipId})`}>
        <path d="M20 2V8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path
          opacity="0.4"
          d="M20 32V38"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          opacity="0.4"
          d="M38 20H32"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M8 20H2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path
          opacity="0.4"
          d="M32.727 7.27344L28.4844 11.5161"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M11.5161 28.4844L7.27344 32.727"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          opacity="0.4"
          d="M32.727 32.727L28.4844 28.4844"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M11.5161 11.5161L7.27344 7.27344"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <defs>
        <clipPath id={clipId}>
          <rect width="40" height="40" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
