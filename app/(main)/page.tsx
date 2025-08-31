import ChatInterface from "@/components/chat-interface";
import { HomeMessageHandler } from "@/components/home-message-handler";

export default function Home() {
  return (
    <HomeMessageHandler>
      {(handleInitialMessage) => (
        <ChatInterface
          id="welcome"
          onInitialMessage={handleInitialMessage}
        />
      )}
    </HomeMessageHandler>
  );
}
