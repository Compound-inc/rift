import * as React from "react"
import { cn } from "@rift/utils"

type SpinnerIconProps = {
  size?: number
  clipId: string
}

function SpinnerIcon({ size = 16, clipId }: SpinnerIconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      style={{ color: "currentColor" }}
    >
      <title>Loading</title>
      <g clipPath={`url(#${clipId})`}>
        <path d="M8 0V4" stroke="currentColor" opacity="1" />
        <path d="M8 16V12" stroke="currentColor" opacity="0.5" />
        <path d="M3.29773 1.52783L5.64887 4.7639" stroke="currentColor" opacity="0.9" />
        <path d="M12.7023 1.52783L10.3511 4.7639" stroke="currentColor" opacity="0.1" />
        <path d="M12.7023 14.472L10.3511 11.236" stroke="currentColor" opacity="0.4" />
        <path d="M3.29773 14.472L5.64887 11.236" stroke="currentColor" opacity="0.6" />
        <path d="M15.6085 5.52783L11.8043 6.7639" stroke="currentColor" opacity="0.2" />
        <path d="M0.391602 10.472L4.19583 9.23598" stroke="currentColor" opacity="0.7" />
        <path d="M15.6085 10.4722L11.8043 9.2361" stroke="currentColor" opacity="0.3" />
        <path d="M0.391602 5.52783L4.19583 6.7639" stroke="currentColor" opacity="0.8" />
      </g>
      <defs>
        <clipPath id={clipId}>
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
}

export type SpinnerProps = React.ComponentProps<"div"> & {
  size?: number
}

function Spinner({ className, size = 16, ...props }: SpinnerProps) {
  const clipId = React.useId().replace(/:/g, "-")
  return (
    <div
      role="status"
      aria-label="Loading"
      data-slot="spinner"
      className={cn(
        "inline-flex animate-spin items-center justify-center",
        className
      )}
      {...props}
    >
      <SpinnerIcon size={size} clipId={clipId} />
    </div>
  )
}

export { Spinner }
