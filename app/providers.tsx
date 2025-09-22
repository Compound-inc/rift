"use client";

import { ModelProvider } from "@/contexts/model-context";
import { InitialMessageProvider } from "@/contexts/initial-message-context";
import { Theme } from "@radix-ui/themes";
import { ReactNode } from "react";
import { AIDevtools } from "@ai-sdk-tools/devtools";

interface ProvidersProps {
  children: ReactNode;
  initialModel?: string;
}

export function Providers({ children, initialModel }: ProvidersProps) {
  return (
    <Theme>
      <ModelProvider initialModel={initialModel}>
        <AIDevtools />
        <InitialMessageProvider>{children}</InitialMessageProvider>
      </ModelProvider>
    </Theme>
  );
}
