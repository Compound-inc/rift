"use client";
import ChatInterface from "@/components/chat";
import { HomeMessageHandler } from "@/components/home-message-handler";

export default function Home() {
  return (
    <HomeMessageHandler
      action={(handleInitialMessage) => (
        <ChatInterface id="welcome" onInitialMessage={handleInitialMessage} />
      )}
    />
  );
}
