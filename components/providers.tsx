"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <Toaster />
        <Suspense fallback={<div />}>{children}</Suspense>
      </ThemeProvider>
  );
}
