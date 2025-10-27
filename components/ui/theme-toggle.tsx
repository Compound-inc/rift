"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ThemeToggle({ className, size = "md" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-10 w-10"
  };

  const iconSizeClasses = {
    sm: "size-3",
    md: "size-4",
    lg: "size-5"
  };

  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={cn(
        "inline-flex items-center justify-center rounded-md border bg-background/80 backdrop-blur-sm transition-colors shadow-sm dark:bg-popover-main dark:border-border",
        "hover:bg-background hover:shadow-md cursor-pointer outline-none",
        sizeClasses[size],
        className
      )}
    >
      {isDark ? (
        <Sun className={cn("transition-transform", iconSizeClasses[size])} />
      ) : (
        <Moon className={cn("transition-transform", iconSizeClasses[size])} />
      )}
    </button>
  );
}
