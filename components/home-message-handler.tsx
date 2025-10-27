"use client";

import { useRouter } from "next/navigation";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useModel } from "@/contexts/model-context";
import { useInitialMessage } from "@/contexts/initial-message-context";
import { generateUUID } from "@/lib/utils";
import { UIMessage } from "@ai-sdk-tools/store";
import { ReactNode } from "react";
import { logThreadCreated } from "@/actions/audit";
import { toast } from "sonner";

interface HomeMessageHandlerProps {
  action: (
    handleInitialMessage: (message: UIMessage) => Promise<void>,
  ) => ReactNode;
}

export function HomeMessageHandler({ action }: HomeMessageHandlerProps) {
  const router = useRouter();
  const { selectedModel } = useModel();
  const { setInitialMessage } = useInitialMessage();
  const createThread = useMutation(api.threads.createThread);
  const { isAuthenticated } = useConvexAuth();

  // Retry helper with exponential backoff for transient auth failures
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        const isAuthError = error?.message?.includes("Unauthenticated") || 
                           error?.message?.includes("user must be logged in");
        
        // Only retry on auth errors, and not on the last attempt
        if (!isAuthError || i === maxRetries - 1) {
          throw error;
        }
        
        // Exponential backoff: 100ms, 300ms, 900ms
        const delay = Math.pow(3, i) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error("Max retries exceeded");
  };

  const handleInitialMessage = async (message: UIMessage) => {
    const newThreadId = generateUUID();

    try {
      // Store the initial message in context for the chat page to consume
      setInitialMessage(newThreadId, message);

      // Early check: If not authenticated, show error immediately
      // The retry logic will handle transient authentication states during token refresh
      if (!isAuthenticated) {
        toast.error("Por favor inicia sesión para crear un chat.");
        console.error("User not authenticated when creating thread");
        return;
      }

      // Create the thread with retry logic for transient auth failures during token refresh
      await retryWithBackoff(() =>
        createThread({
          threadId: newThreadId,
          model: selectedModel,
        })
      );

      try {
        const hasAttachment = Boolean(
          message.parts?.some((p) => p.type !== "text"),
        );
        const attachmentCount = message.parts?.filter((p) => p.type !== "text").length || 0;
        void logThreadCreated(newThreadId, selectedModel, hasAttachment, attachmentCount);
      } catch (e) {
        console.warn("Failed to log thread.create:", e);
      }

      // Trigger title generation in the background
      fetch("/api/generate-title", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId: newThreadId,
          userMessage:
            message.parts?.find((p) => p.type === "text")?.text || "",
        }),
      }).catch((error) => {
        console.warn("Failed to generate title:", error);
      });

      // Navigate directly to the chat page - clean URL without parameters
      router.push(`/chat/${newThreadId}`);
    } catch (error: any) {
      console.error("Failed to create thread:", error);
      
      const isAuthError = error?.message?.includes("Unauthenticated") || 
                         error?.message?.includes("user must be logged in");
      
      if (isAuthError) {
        toast.error("Error de autenticación. Por favor recarga la página e intenta nuevamente.");
      } else {
        toast.error("Error al crear el chat. Por favor intenta nuevamente.");
      }
      
      return;
    }
  };

  return <>{action(handleInitialMessage)}</>;
}
