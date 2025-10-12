"use client";

import { Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";
import ChatInterface from "./chat";

interface ChatInterfaceWithPreloadProps {
  id: string;
  initialMessages?: any;
  disableInput?: boolean;
  onInitialMessage?: (message: any) => Promise<void>;
  preloadedMessages?: Preloaded<typeof api.threads.getThreadMessagesPaginatedSafe>;
}

// Component that uses preloaded data immediately
function ChatInterfaceWithPreloadedData({
  id,
  initialMessages,
  disableInput,
  onInitialMessage,
  preloadedMessages,
}: {
  id: string;
  initialMessages?: any;
  disableInput?: boolean;
  onInitialMessage?: (message: any) => Promise<void>;
  preloadedMessages: Preloaded<typeof api.threads.getThreadMessagesPaginatedSafe>;
}) {
  return (
    <ChatInterface
      id={id}
      initialMessages={initialMessages}
      disableInput={disableInput}
      onInitialMessage={onInitialMessage}
      preloadedMessages={preloadedMessages}
    />
  );
}

// Component that uses regular query (waits for auth)
function ChatInterfaceWithRegularQuery({
  id,
  initialMessages,
  disableInput,
  onInitialMessage,
}: {
  id: string;
  initialMessages?: any;
  disableInput?: boolean;
  onInitialMessage?: (message: any) => Promise<void>;
}) {
  return (
    <ChatInterface
      id={id}
      initialMessages={initialMessages}
      disableInput={disableInput}
      onInitialMessage={onInitialMessage}
    />
  );
}

// Main component that conditionally renders based on preloaded data availability
export default function ChatInterfaceWithPreload({
  id,
  initialMessages,
  disableInput = false,
  onInitialMessage,
  preloadedMessages,
}: ChatInterfaceWithPreloadProps) {
  // If we have preloaded messages, render them immediately (they're already authenticated server-side)
  if (preloadedMessages) {
    return (
      <ChatInterfaceWithPreloadedData
        id={id}
        initialMessages={initialMessages}
        disableInput={disableInput}
        onInitialMessage={onInitialMessage}
        preloadedMessages={preloadedMessages}
      />
    );
  }

  // Otherwise, use the regular query component (no auth checks needed - ChatInterface handles it)
  return (
    <ChatInterfaceWithRegularQuery
      id={id}
      initialMessages={initialMessages}
      disableInput={disableInput}
      onInitialMessage={onInitialMessage}
    />
  );
}
