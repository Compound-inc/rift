"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useModel } from "@/contexts/model-context";
import { useInitialMessage } from "@/contexts/initial-message-context";
import { generateUUID } from "@/lib/utils";
import { UIMessage } from "ai";
import { ReactNode } from "react";

interface HomeMessageHandlerProps {
  children: (
    handleInitialMessage: (message: UIMessage) => Promise<void>,
  ) => ReactNode;
}

export function HomeMessageHandler({ children }: HomeMessageHandlerProps) {
  const router = useRouter();
  const { selectedModel } = useModel();
  const { setInitialMessage } = useInitialMessage();
  const createThread = useMutation(api.threads.createThread);

  const handleInitialMessage = async (message: UIMessage) => {
    const newThreadId = generateUUID();

    try {
      // Store the initial message in context for the chat page to consume
      setInitialMessage(newThreadId, message);

      // Create the thread
      await createThread({
        threadId: newThreadId,
        model: selectedModel,
      });

      // Navigate directly to the chat page - clean URL without parameters
      router.push(`/chat/${newThreadId}`);
    } catch (error) {
      console.error("Failed to create thread:", error);
      return;
    }
  };

  return <>{children(handleInitialMessage)}</>;
}
