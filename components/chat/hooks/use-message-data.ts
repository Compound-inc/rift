import { useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { UIMessage } from "@ai-sdk/react";
import type { ConvexMessage } from "../types";

interface UseMessageDataProps {
  id: string;
  initialMessages?: UIMessage[];
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
  isAuthenticated: boolean;
  consumeInitialMessage: (id: string) => UIMessage | null;
  sendMessageRef: React.RefObject<((message: UIMessage) => Promise<void>) | null>;
}

export function useMessageData({
  id,
  initialMessages,
  messages,
  setMessages,
  isAuthenticated,
  consumeInitialMessage,
  sendMessageRef,
}: UseMessageDataProps) {
  const autoStartTriggeredRef = useRef(false);
  const isThread = id !== "welcome";
  const convex = useConvex();
  
  // Use server-fetched messages directly (no conversion needed)
  const effectiveThreadDocs = initialMessages || [];

  // Initialize messages from initialMessages
  useEffect(() => {
    if (
      initialMessages &&
      initialMessages.length > 0 &&
      messages.length === 0
    ) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages, messages.length]);

  // Process messages immediately when available
  useEffect(() => {
    // Process messages immediately when available
    if (messages.length === 0 && effectiveThreadDocs.length > 0) {
      setMessages(effectiveThreadDocs);
    }
  }, [messages.length, effectiveThreadDocs, setMessages]);

  // Auto-start with initial message from context
  useEffect(() => {
    if (!autoStartTriggeredRef.current && isThread && isAuthenticated) {
      const initialMessage = consumeInitialMessage(id);

      if (initialMessage) {
        // Mark as triggered to prevent duplicate calls
        autoStartTriggeredRef.current = true;

        // Start AI streaming - this will handle both user message persistence and AI response
        sendMessageRef.current?.(initialMessage);
      }
    }
  }, [id, isThread, isAuthenticated, consumeInitialMessage, sendMessageRef]);

  const renderedMessages: UIMessage[] = useMemo(() => {
    // If we have AI SDK messages (for streaming), use them
    if (messages.length > 0) {
      return messages;
    }
    
    // Otherwise use server-fetched messages
    if (effectiveThreadDocs.length > 0) {
      return effectiveThreadDocs;
    }
    
    // Fallback to initial messages
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }

    return [];
  }, [messages, effectiveThreadDocs, initialMessages]);

  const hasAssistantMessage = useMemo(
    () => renderedMessages.some((m) => m.role === "assistant"),
    [renderedMessages],
  );

  return {
    renderedMessages,
    hasAssistantMessage,
    effectiveThreadDocs,
  };
}
