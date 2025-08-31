"use client";

import { ModelProvider } from "@/contexts/model-context";
import { ChatCacheProvider } from "@/contexts/chat-cache";
import { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
  initialModel?: string;
}

export function Providers({ children, initialModel }: ProvidersProps) {
  return (
    <ModelProvider initialModel={initialModel}>
      <ChatCacheProvider>
        {children}
      </ChatCacheProvider>
    </ModelProvider>
  );
} 