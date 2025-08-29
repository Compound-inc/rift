"use client";

import { ConvexProvider } from "convex/react";
import { convex } from "@/lib/convex";
import { ThemeProvider } from "@/components/theme-provider";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ConvexProvider client={convex}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <Toaster />
        <Suspense fallback={<div />}>{children}</Suspense>
      </ThemeProvider>
    </ConvexProvider>
  );
}
