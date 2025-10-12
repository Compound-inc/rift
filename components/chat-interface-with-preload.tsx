"use client";

import ChatInterface from "./chat";

interface ChatInterfaceWithPreloadProps {
  id: string;
  initialMessages?: any;
  disableInput?: boolean;
  onInitialMessage?: (message: any) => Promise<void>;
}

// Simplified component that just renders ChatInterface
export default function ChatInterfaceWithPreload({
  id,
  initialMessages,
  disableInput = false,
  onInitialMessage,
}: ChatInterfaceWithPreloadProps) {
  return (
    <ChatInterface
      id={id}
      initialMessages={initialMessages}
      disableInput={disableInput}
      onInitialMessage={onInitialMessage}
    />
  );
}
