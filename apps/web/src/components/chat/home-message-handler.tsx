"use client";

import { useRouter } from "next/navigation";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { useModel } from "@/contexts/model-context";
import { useInitialMessage } from "@/contexts/initial-message-context";
import { generateUUID } from "@rift/utils";
import { UIMessage } from "ai";
import { ReactNode } from "react";
import { logThreadCreated } from "@/actions/audit";
import { toast } from "sonner";
import { useChatUIStore } from "@/components/chat/ui-store";
import { useLocale } from "@/contexts/locale-context";

interface HomeMessageHandlerProps {
  action: (
    handleInitialMessage: (message: UIMessage) => Promise<void>,
  ) => ReactNode;
}

export function HomeMessageHandler({ action }: HomeMessageHandlerProps) {
  const router = useRouter();
  const lang = useLocale();
  const { selectedModel } = useModel();
  const { setInitialMessage } = useInitialMessage();
  const createThread = useMutation(api.threads.createThread);
  const { isAuthenticated } = useConvexAuth();
  const customInstructionId = useChatUIStore((s) => s.customInstructionId);

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
        throw new Error("User not authenticated when creating thread");
      }

      // Create the thread
      await createThread({
        threadId: newThreadId,
        model: selectedModel,
        customInstructionId: customInstructionId,
      });

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
      router.push(`/${lang}/chat/${newThreadId}`);
    } catch (error: any) {
      console.error("Failed to create thread:", error);
      
      const isAuthError = error?.message?.includes("Unauthenticated") || 
                         error?.message?.includes("user must be logged in");
      
      if (isAuthError) {
        toast.error("Error de autenticación. Por favor recarga la página e intenta nuevamente.");
      } else {
        toast.error("Error al crear el chat. Por favor intenta nuevamente.");
      }

      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  return <>{action(handleInitialMessage)}</>;
}
