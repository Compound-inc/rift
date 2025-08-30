"use client";

import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import ChatInterface from "@/components/chat-interface";
import ErrorMessage from "@/components/error-message";
import { UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
import { Authenticated, Unauthenticated } from "convex/react";
import { ChatInputContainer } from "@/components/chat-input-container";
import { useMutation } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useModel } from "@/contexts/model-context";
import { generateUUID } from "@/lib/utils";
import { toast } from "sonner";
import { useChatCache } from "@/contexts/chat-cache";

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
  const { getMessages, setMessages, getThreadInfo } = useChatCache();

  // Read from cache first for instant UI
  const cachedMessages = getMessages(id);
  const cachedInfo = getThreadInfo(id);

  // Skip thread info query if preloaded in cache
  const threadInfo = useQuery(
    api.threads.getThreadInfo,
    cachedInfo ? "skip" : { threadId: id }
  );

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

  // When results arrive, sync cache
  useEffect(() => {
    if (!results) return;
    const msgs = (results as Array<ConvexMessage>)
      .slice()
      .reverse()
      .map((m) => ({
        id: m.messageId,
        role: m.role,
        parts: [{ type: "text" as const, text: m.content }],
      }));
    setMessages(id, msgs);
  }, [results, id, setMessages]);

  const initialMessages = useMemo(() => {
    if (cachedMessages && cachedMessages.length > 0) return cachedMessages;
    if (!results) return [] as UIMessage[];
    return (results as Array<ConvexMessage>)
      .slice()
      .reverse()
      .map((m) => ({
        id: m.messageId,
        parts: [{ type: "text" as const, text: m.content }],
        role: m.role,
      })) as UIMessage[];
  }, [cachedMessages, results]);

  // Handle loading states - but still render cached messages instantly
  if (!cachedInfo && threadInfo === undefined) {
    // If we have cached messages, render them immediately; otherwise, render an empty shell
    if (cachedMessages && cachedMessages.length > 0) {
      return (
        <div className="flex-1 min-h-0 flex">
          <ChatInterface id={id} initialMessages={cachedMessages} />
        </div>
      );
    }
    return <div className="pb-32" />;
  }

  // Handle errors - thread not found
  if (!cachedInfo && threadInfo === null) {
    return (
      <ErrorMessage 
        chatError="Thread not found" 
        error="The requested thread could not be found." 
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 flex">
      <ChatInterface
        id={id}
        initialMessages={initialMessages}
      />
    </div>
  );
}

export default function ChatPage({ id }: ChatPageProps) {
  return (
    <div className="flex min-h-screen h-full flex-col">
      <Authenticated>
        <div className="flex-1 min-h-0 flex">
          <Content id={id} />
        </div>
      </Authenticated>
      <Unauthenticated>
        {null}
      </Unauthenticated>
      <div className="mx-auto w-full max-w-3xl px-4 pt-4 mt-auto">
        <ChatInput />
      </div>
    </div>
  );
}
