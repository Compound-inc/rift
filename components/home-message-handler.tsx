"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useModel } from "@/contexts/model-context";
import { generateUUID } from "@/lib/utils";
import { UIMessage } from "ai";
import { useChatCache } from "@/contexts/chat-cache";
import { ReactNode } from "react";

interface HomeMessageHandlerProps {
  children: (handleInitialMessage: (message: UIMessage) => Promise<void>) => ReactNode;
}

export function HomeMessageHandler({ children }: HomeMessageHandlerProps) {
  const router = useRouter();
  const { selectedModel } = useModel();
  const { setMessages } = useChatCache();
  const createThread = useMutation(api.threads.createThread);

  const handleInitialMessage = async (message: UIMessage) => {
    const newThreadId = generateUUID();

    // Extract text content from message parts (for cache only)
    const textContent = message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as any).text)
      .join(" ");

    // Seed cache immediately to preserve optimistic UI across navigation
    setMessages(newThreadId, [message]);

    try {
      await createThread({
        threadId: newThreadId,
        model: selectedModel,
      });
    } catch (error) {
      console.error("Failed to create thread:", error);
      return;
    }

    // Navigate to the new chat page; cached message avoids flicker
    router.push(`/chat/${newThreadId}`);
  };

  return <>{children(handleInitialMessage)}</>;
} 