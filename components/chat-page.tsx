"use client";

import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import ChatInterface from "@/components/chat-interface";
import ErrorMessage from "@/components/error-message";
import { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { Authenticated, Unauthenticated } from "convex/react";
import { ChatInputContainer } from "@/components/chat-input-container";
import { useMutation } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useModel } from "@/contexts/model-context";
import { generateUUID } from "@/lib/utils";
import { toast } from "sonner";

interface ChatPageProps {
  id: string;
}

type ConvexMessage = {
  messageId: string;
  content: string;
  role: UIMessage["role"];
  created_at: number;
};

// Separate component for the persistent input
function ChatInput() {
  const [input, setInput] = useState("");
  const { selectedModel } = useModel();
  const sendMessage = useMutation(api.threads.sendMessage);
  const pathname = usePathname();
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const messageContent = input.trim();
    const messageId = generateUUID();
    
    // Extract threadId from current pathname
    const threadId = pathname.startsWith("/chat/") ? pathname.split("/chat/")[1] : null;
    
    if (!threadId) {
      toast.error("No active chat thread");
      return;
    }

    // Clear the input immediately
    setInput("");

    try {
      // Send message to existing thread
      const result = await sendMessage({
        threadId: threadId,
        content: messageContent,
        model: selectedModel,
        messageId: messageId,
      });

      console.log("Message sent to thread:", result);
      
      // Refresh the page to show the new message
      router.refresh();
      
    } catch (error) {
      console.error("Failed to send message:", error);
      
      // Restore the input content on error
      setInput(messageContent);
      
      toast.error("Failed to send message. Please try again.");
    }
  };

  return (
    <ChatInputContainer
      input={input}
      status="idle"
      showScrollButton={false}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
      onStop={() => {}}
      onScrollToBottom={() => {}}
    />
  );
}

function Content({ id }: ChatPageProps) {
  // Load thread info
  const threadInfo = useQuery(api.threads.getThreadInfo, { threadId: id });

  // Load messages with pagination (newest first)
  const { results, status, loadMore } = usePaginatedQuery(
    api.threads.getThreadMessagesPaginated,
    { threadId: id },
    { initialNumItems: 10 },
  );

  // Auto-load older messages when scrolling near the top of the viewport
  useEffect(() => {
    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null;
    if (!viewport) return;

    const handleScroll = () => {
      if (viewport.scrollTop < 80 && status === "CanLoadMore") {
        loadMore(10);
      }
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, [status, loadMore]);

  // Handle loading states - queries will return undefined until authentication is complete
  if (threadInfo === undefined || results === undefined) {
    return (
      <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col px-2 pt-14">
        <div className="flex items-center justify-center h-full">
          <div></div>
        </div>
      </div>
    );
  }

  // Handle errors - thread not found
  if (threadInfo === null) {
    return (
      <ErrorMessage 
        chatError="Thread not found" 
        error="The requested thread could not be found." 
      />
    );
  }

  // Convert Convex messages to UI messages (reverse to chronological order)
  function convertToUIMessages(convexMessages: Array<ConvexMessage>): Array<UIMessage> {
    if (!convexMessages) return [];

    return convexMessages.map((message) => ({
      id: message.messageId,
      parts: [{ type: "text", text: message.content }],
      role: message.role,
      content: message.content,
      createdAt: new Date(message.created_at),
    }));
  }

  // Results come newest-first; reverse to oldest-first for display
  const initialMessages = convertToUIMessages((results as Array<ConvexMessage> | undefined || []).slice().reverse());

  return (
    <div className="pb-32">
      <ChatInterface
        id={id}
        initialMessages={initialMessages}
      />
    </div>
  );
}

export default function ChatPage({ id }: ChatPageProps) {
  return (
    <>
      <Authenticated>
        {/* Persistent Input Container - outside Content to prevent recreation */}
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="mx-auto max-w-3xl px-4 pt-4">
            <ChatInput />
          </div>
        </div>

        <Content id={id} />
      </Authenticated>
      <Unauthenticated>
        {null}
      </Unauthenticated>
    </>
  );
}
