"use client";

import { ModelProvider } from "@/contexts/model-context";
import { InitialMessageProvider } from "@/contexts/initial-message-context";
import { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
  initialModel?: string;
}

export function Providers({ children, initialModel }: ProvidersProps) {
  return (
    <ModelProvider initialModel={initialModel}>
      <InitialMessageProvider>{children}</InitialMessageProvider>
    </ModelProvider>
  );
}
