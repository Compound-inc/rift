"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./button";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  side?: "left" | "right" | "top" | "bottom";
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md", 
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-full"
};

const sideClasses = {
  left: "left-0 top-0 h-full",
  right: "right-0 top-0 h-full",
  top: "top-0 left-0 w-full",
  bottom: "bottom-0 left-0 w-full"
};

export function Drawer({
  isOpen,
  onClose,
  children,
  title,
  className,
  side = "right",
  size = "lg"
}: DrawerProps) {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div
        className={cn(
          "fixed z-50 bg-background border shadow-lg transition-transform duration-300 ease-in-out",
          sideClasses[side],
          sizeClasses[size],
          side === "left" && (isOpen ? "translate-x-0" : "-translate-x-full"),
          side === "right" && (isOpen ? "translate-x-0" : "translate-x-full"),
          side === "top" && (isOpen ? "translate-y-0" : "-translate-y-full"),
          side === "bottom" && (isOpen ? "translate-y-0" : "translate-y-full"),
          className
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{title}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

interface DrawerContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DrawerContent({ children, className }: DrawerContentProps) {
  return (
    <div className={cn("h-full overflow-y-auto", className)}>
      {children}
    </div>
  );
}

interface DrawerFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DrawerFooter({ children, className }: DrawerFooterProps) {
  return (
    <div className={cn("p-4 border-t bg-muted/30", className)}>
      {children}
    </div>
  );
}

