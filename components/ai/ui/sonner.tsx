"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { cn } from "@/lib/utils"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className={cn(
        "toaster group [&_.sonner-toast]:bg-popover-main [&_.sonner-toast]:backdrop-blur-sm [&_.sonner-toast]:text-popover-text [&_.sonner-toast]:border-border/30 [&_.sonner-toast]:rounded-xl [&_.sonner-toast]:border"
      )}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover-main)",
          "--normal-text": "var(--popover-text)",
          "--normal-border": "var(--border)",
          "--border-radius": "calc(var(--radius) + 4px)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
