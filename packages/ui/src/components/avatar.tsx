"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@rift/utils"

type MarbleCssVars = React.CSSProperties & {
  "--color-0"?: string
  "--color-1"?: string
  "--color-2"?: string
}

const MARBLE_ELEMENTS = 3
const MARBLE_VIEWBOX_SIZE = 80
const DEFAULT_MARBLE_PALETTES = [
  ["var(--chart-3, #3b82f6)", "var(--chart-4, #f59e0b)", "var(--chart-5, #ef4444)"],
  ["#6366f1", "#8b5cf6", "#ec4899"],
  ["#10b981", "#059669", "#34d399"],
  ["#f59e0b", "#f97316", "#fb923c"],
  ["#3b82f6", "#2563eb", "#60a5fa"],
  ["#a855f7", "#9333ea", "#c084fc"],
  ["#ef4444", "#dc2626", "#f87171"],
  ["#06b6d4", "#0891b2", "#22d3ee"],
  ["#84cc16", "#65a30d", "#a3e635"],
  ["#f43f5e", "#e11d48", "#fb7185"],
  ["#14b8a6", "#0d9488", "#5eead4"],
  ["#8b5cf6", "#7c3aed", "#a78bfa"],
  ["#f97316", "#ea580c", "#fb923c"],
] as const

function getNumberFromSeed(seed: string) {
  return Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function getUnit(number: number, range: number, index?: number) {
  const value = number % range
  if (index && Math.floor((number / Math.pow(10, index)) % 10) % 2 === 0) {
    return -value
  }
  return value
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function ProceduralAvatarMarble({
  seed,
  name,
  colors,
  className,
  showInitials = true,
}: {
  seed: string
  name?: string
  colors?: string[]
  className?: string
  showInitials?: boolean
}) {
  const numFromSeed = React.useMemo(() => getNumberFromSeed(seed), [seed])
  const activeColors = React.useMemo(() => {
    if (colors && colors.length > 0) return colors
    return DEFAULT_MARBLE_PALETTES[numFromSeed % DEFAULT_MARBLE_PALETTES.length]
  }, [colors, numFromSeed])

  // Each blob transform is deterministic from the same seed so fallback avatars are stable per user.
  const properties = React.useMemo(() => {
    return Array.from({ length: MARBLE_ELEMENTS }, (_, i) => ({
      colorIndex: (numFromSeed + i) % activeColors.length,
      translateX: getUnit(numFromSeed * (i + 1), MARBLE_VIEWBOX_SIZE / 10, 1),
      translateY: getUnit(numFromSeed * (i + 1), MARBLE_VIEWBOX_SIZE / 10, 2),
      scale: 1.2 + getUnit(numFromSeed * (i + 1), MARBLE_VIEWBOX_SIZE / 20) / 10,
      rotate: getUnit(numFromSeed * (i + 1), 360, 1),
    }))
  }, [activeColors.length, numFromSeed])

  const uid = React.useId().replace(/:/g, "")
  const maskId = `mask__marble_${uid}`
  const filterId = `filter__marble_${uid}`

  const initials = React.useMemo(() => {
    if (!name) return ""
    return getInitials(name)
  }, [name])

  return (
    <svg
      viewBox={`0 0 ${MARBLE_VIEWBOX_SIZE} ${MARBLE_VIEWBOX_SIZE}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-full rounded-full", className)}
      style={
        {
          "--color-0": activeColors[properties[0].colorIndex],
          "--color-1": activeColors[properties[1].colorIndex],
          "--color-2": activeColors[properties[2].colorIndex],
        } as MarbleCssVars
      }
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={MARBLE_VIEWBOX_SIZE}
          height={MARBLE_VIEWBOX_SIZE}
        >
          <rect width={MARBLE_VIEWBOX_SIZE} height={MARBLE_VIEWBOX_SIZE} fill="white" />
        </mask>
        <filter id={filterId} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="7" result="effect1_foregroundBlur" />
        </filter>
      </defs>

      <g mask={`url(#${maskId})`}>
        <rect width={MARBLE_VIEWBOX_SIZE} height={MARBLE_VIEWBOX_SIZE} fill="var(--color-0)" />
        <path
          filter={`url(#${filterId})`}
          style={{ mixBlendMode: "overlay", fill: "var(--color-1)" }}
          d="M32.414 59.35L50.376 70.5H72.5v-71H33.728L26.5 13.381l19.057 27.08L32.414 59.35z"
          transform={`translate(${properties[1].translateX} ${properties[1].translateY}) rotate(${properties[1].rotate} ${
            MARBLE_VIEWBOX_SIZE / 2
          } ${MARBLE_VIEWBOX_SIZE / 2}) scale(${properties[2].scale})`}
        />
        <path
          filter={`url(#${filterId})`}
          style={{ fill: "var(--color-2)" }}
          d="M22.216 24L0 46.75l14.108 38.129L78 86l-3.081-59.276-22.378 4.005 12.972 20.186-23.35 27.395L22.215 24z"
          transform={`translate(${properties[2].translateX} ${properties[2].translateY}) rotate(${properties[2].rotate} ${
            MARBLE_VIEWBOX_SIZE / 2
          } ${MARBLE_VIEWBOX_SIZE / 2}) scale(${properties[2].scale})`}
        />

        {name && showInitials ? (
          <>
            <rect width={MARBLE_VIEWBOX_SIZE} height={MARBLE_VIEWBOX_SIZE} fill="rgba(0, 0, 0, 0.25)" />
            <text
              x="50%"
              y="50%"
              dominantBaseline="central"
              textAnchor="middle"
              style={{
                fill: "white",
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: 600,
                fontSize: `${MARBLE_VIEWBOX_SIZE * 0.35}px`,
              }}
            >
              {initials}
            </text>
          </>
        ) : null}
      </g>
    </svg>
  )
}

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "xs" | "sm" | "default" | "lg" | "xl"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "size-8 rounded-full after:rounded-full data-[size=sm]:size-6 data-[size=xs]:size-7 data-[size=lg]:size-10 data-[size=xl]:size-12 after:border-border-default group/avatar relative shrink-0 overflow-hidden select-none after:absolute after:inset-0 after:border after:mix-blend-darken dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "absolute inset-0 rounded-full aspect-square size-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  seed,
  name,
  colors,
  showInitials = true,
  children,
  ...props
}: AvatarPrimitive.Fallback.Props & {
  seed?: string
  name?: string
  colors?: string[]
  showInitials?: boolean
}) {
  const fallbackName = React.useMemo(() => {
    if (name) return name
    if (typeof children === "string") return children
    return ""
  }, [children, name])

  const fallbackSeed = React.useMemo(() => {
    if (seed && seed.length > 0) return seed
    if (fallbackName && fallbackName.length > 0) return fallbackName
    return "Anonymous"
  }, [fallbackName, seed])

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-bg-muted text-content-muted absolute inset-0 rounded-full flex size-full items-center justify-center overflow-hidden text-sm group-data-[size=sm]/avatar:text-xs group-data-[size=xs]/avatar:text-xs group-data-[size=xl]/avatar:text-base",
        className
      )}
      {...props}
    >
      <ProceduralAvatarMarble
        seed={fallbackSeed}
        name={fallbackName}
        colors={colors}
        showInitials={showInitials}
      />
    </AvatarPrimitive.Fallback>
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "bg-bg-inverted text-content-inverted ring-bg-default absolute ltr:right-0 rtl:left-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=xs]/avatar:size-2 group-data-[size=xs]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        "group-data-[size=xl]/avatar:size-4 group-data-[size=xl]/avatar:[&>svg]:size-2.5",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "*:data-[slot=avatar]:ring-bg-default group/avatar-group flex -space-x-2 rtl:space-x-reverse *:data-[slot=avatar]:ring-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "bg-bg-muted text-content-muted size-8 rounded-full text-sm group-has-data-[size=sm]/avatar-group:size-6 group-has-data-[size=xs]/avatar-group:size-7 group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=xl]/avatar-group:size-12 [&>svg]:size-4 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3 group-has-data-[size=xs]/avatar-group:[&>svg]:size-3 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=xl]/avatar-group:[&>svg]:size-6 ring-bg-default relative flex shrink-0 items-center justify-center ring-2",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
