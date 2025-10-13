import { useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import type { UIMessage } from "@ai-sdk/react";

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
  const prevIdRef = useRef(id);
  const isThread = id !== "welcome";
  const convex = useConvex();
  
  // Cleanup effect when thread ID changes
  useEffect(() => {
    if (prevIdRef.current !== id) {
      // Reset auto-start trigger for new thread
      autoStartTriggeredRef.current = false;
      
      // Clear messages immediately when navigating to new thread
      setMessages([]);
      
      // Update previous ID reference
      prevIdRef.current = id;
    }
  }, [id, setMessages]);
  
  // Initialize messages from initialMessages when available
  useEffect(() => {
    if (messages.length === 0 && initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [messages.length, initialMessages, setMessages, id]);

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
    
    // Fallback to initial messages
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }

    return [];
  }, [messages, initialMessages]);

  const hasAssistantMessage = useMemo(
    () => renderedMessages.some((m) => m.role === "assistant"),
    [renderedMessages],
  );

  return {
    renderedMessages,
    hasAssistantMessage,
  };
}
