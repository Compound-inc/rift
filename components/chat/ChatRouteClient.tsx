"use client";

import ChatInterface from "@/components/chat";
import { FirstMessageSendAnimationProvider } from "@/components/chat/first-message-send-animation";
import { HomeMessageHandler } from "@/components/home-message-handler";
import { ChatMessagesClient } from "@/components/chat-messages-client";
import { useSelectedThreadUrlSync } from "@/lib/hooks/useSelectedThreadUrlSync";
import { useSelectedThreadStore } from "@/lib/stores/selected-thread-store";
import { useIsClient } from "@/lib/hooks/useIsClient";

export function ChatRouteClient() {
  const isClient = useIsClient();
  useSelectedThreadUrlSync();
  const selectedThreadId = useSelectedThreadStore((s) => s.selectedThreadId);

  // Avoid flicker: don't render the welcome state until client has mounted + url sync is active.
  if (!isClient) {
    return null;
  }

  // Provider must wrap both branches so animation state (phase, sourcePoint) persists
  // when navigating from welcome to thread; otherwise the thread mounts with a fresh
  // provider and phase="idle", causing scroll-to-bottom to run and teleport the message.
  return (
    <FirstMessageSendAnimationProvider>
      {!selectedThreadId ? (
        <HomeMessageHandler
          action={(handleInitialMessage) => (
            <ChatInterface id="welcome" onInitialMessage={handleInitialMessage} />
          )}
        />
      ) : (
        <ChatMessagesClient threadId={selectedThreadId} />
      )}
    </FirstMessageSendAnimationProvider>
  );
}


