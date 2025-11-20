"use client";

import { ModelProvider } from "@/contexts/model-context";
import { InitialMessageProvider } from "@/contexts/initial-message-context";
import { Theme } from "@radix-ui/themes";
import { ReactNode } from "react";
import { Provider as AIStoreProvider } from "@ai-sdk-tools/store";
import { Analytics } from "@vercel/analytics/next"
interface ProvidersProps {
  children: ReactNode;
  initialModel?: string;
}

export function Providers({ children, initialModel }: ProvidersProps) {
  return (
    <Theme>
      <Analytics />
      <ModelProvider initialModel={initialModel}>
        <AIStoreProvider initialMessages={[]}>
            <InitialMessageProvider>{children}</InitialMessageProvider>
          </AIStoreProvider>
        </ModelProvider>
    </Theme>
  );
}
