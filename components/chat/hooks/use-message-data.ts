import { useEffect, useMemo, useRef } from "react";
import { usePaginatedQuery, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { UIMessage } from "@ai-sdk/react";
import type { Preloaded } from "convex/react";
import type { ConvexMessage } from "../types";

interface UseMessageDataProps {
  id: string;
  initialMessages?: UIMessage[];
  preloadedMessages?: Preloaded<typeof api.threads.getThreadMessagesPaginatedSafe>;
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
  isAuthenticated: boolean;
  consumeInitialMessage: (id: string) => UIMessage | null;
  sendMessageRef: React.RefObject<((message: UIMessage) => Promise<void>) | null>;
}

export function useMessageData({
  id,
  initialMessages,
  preloadedMessages,
  messages,
  setMessages,
  isAuthenticated,
  consumeInitialMessage,
  sendMessageRef,
}: UseMessageDataProps) {
  const autoStartTriggeredRef = useRef(false);
  const isThread = id !== "welcome";

  // Use preloaded messages if available
  const preloadedResults = preloadedMessages
    ? usePreloadedQuery(preloadedMessages)
    : null;

  // Only run the Convex query when authenticated and no preloaded messages
  const { results: threadDocs = [] } = usePaginatedQuery(
    api.threads.getThreadMessagesPaginatedSafe,
    isThread && !preloadedMessages ? { threadId: id } : "skip",
    { initialNumItems: 10 },
  );

  // Use preloaded messages if available, otherwise use the query results
  const effectiveThreadDocs = preloadedResults?.page || threadDocs;

  // Convert Convex messages to UIMessage format
  const convertConvexToUIMessage = (convexMessages: ConvexMessage[]): UIMessage[] => {
    return [...convexMessages]
      .reverse()
      .map((m: ConvexMessage) => ({
        id: m.messageId,
        role: m.role,
        parts: [
          ...(m.reasoning ? [{ type: "reasoning", text: m.reasoning }] : []),
          ...(m.content ? [{ type: "text", text: m.content }] : []),
          ...(m.attachments ? m.attachments.map(att => ({
            type: "file" as const,
            mediaType: att.mimeType,
            url: att.attachmentUrl,
            attachmentId: att.attachmentId,
            attachmentType: att.attachmentType,
          })) : []),
          ...(m.sources ? m.sources.map(source => ({
            type: "source-url" as const,
            sourceId: source.sourceId,
            url: source.url,
            title: source.title,
          })) : []),
        ],
      })) as UIMessage[];
  };

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
      const convexMessages = convertConvexToUIMessage(effectiveThreadDocs);
      setMessages(convexMessages);
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
    // Convert Convex messages to UIMessage format for display
    if (isThread && effectiveThreadDocs.length > 0) {
      const convexMessages = convertConvexToUIMessage(effectiveThreadDocs);

      // If we have AI SDK messages (for streaming), merge them with Convex messages
      if (messages.length > 0) {
        // Find the last user message from AI SDK to see if we need to add it
        const lastUserMessage = messages.find((m) => m.role === "user");
        if (
          lastUserMessage &&
          !convexMessages.some((m) => m.id === lastUserMessage.id)
        ) {
          return [...convexMessages, lastUserMessage];
        }
        return messages;
      }

      return convexMessages;
    }

    // Fallback to AI SDK messages or initial messages
    if (messages.length > 0) {
      return messages;
    }
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }

    return [];
  }, [isThread, effectiveThreadDocs, messages, initialMessages]);

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
