"use client";

import ChatMessage from "@/components/chat-message";
import ChatWelcome from "@/components/chat-welcome";

import { ChatMessageArea } from "@/components/ui/chat-message-area";
import { MessageLoading } from "@/components/ui/message-loading";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { usePathname, useRouter } from "next/navigation";
import { ChatInputContainer } from "@/components/chat-input-container";
import { generateUUID } from "@/lib/utils";
import { useModel } from "@/contexts/model-context";
import { getStoredApiKeys } from "@/lib/api-keys";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ChatInterface({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages?: UIMessage[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedModel } = useModel();
  const [input, setInput] = useState("");
  
  const createThread = useMutation(api.threads.createThread);
  const sendMessage = useMutation(api.threads.sendMessage);

  const {
    messages,
    stop,
    status,
    setMessages,
  } = useChat({
    id,
    generateId: generateUUID,

    onFinish({ message }: { message: UIMessage }) {
      console.log("AI response finished:", message);

      // TODO: Save message to Convex database
      // TODO: Update thread with new message
      // TODO: Handle navigation logic

      if (pathname === "/") {
        router.push(`/chat/${id}`);
        router.refresh();
      }
    },

    onError(error: Error) {
      console.error("Chat error:", error);
      
      // TODO: Implement proper error handling
      // TODO: Show user-friendly error messages
      // TODO: Handle different error types (API key, credits, etc.)

      toast.error("An error occurred. Please try again.");
    },
  });

  // Set initial messages when the component mounts
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  const [containerRef, showScrollButton, scrollToBottom] =
    useScrollToBottom<HTMLDivElement>();

  // TODO: Implement proper stream stopping with Convex integration
  const handleStopStream = async () => {
    stop();

    // TODO: Save partial response to Convex
    // TODO: Update thread status
    // TODO: Handle navigation

    if (pathname === "/") {
      router.push(`/chat/${id}`);
      router.refresh();
    }
  };

  // Implement proper input handling for AI SDK v2
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const messageContent = input.trim();
    const messageId = generateUUID();
    const threadId = id;

    // Optimistic UI update - add the message immediately
    const optimisticMessage: UIMessage = {
      id: messageId,
      role: "user",
      parts: [{ type: "text", text: messageContent }],
    };

    // Add the optimistic message to the UI
    setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

    // Clear the input immediately for snappy UI
    setInput("");

    try {
      // Determine if we're in an existing thread or need to create a new one
      const isExistingThread = pathname.startsWith("/chat/") && pathname !== "/";
      
      if (isExistingThread) {
        // We're in an existing thread, use sendMessage
        const result = await sendMessage({
          threadId: threadId,
          content: messageContent,
          model: selectedModel,
          messageId: messageId,
        });

        console.log("Message sent to existing thread:", result);
      } else {
        // We're on the home page, create a new thread
        const result = await createThread({
          threadId: threadId,
          content: messageContent,
          model: selectedModel,
          messageId: messageId,
        });

        console.log("Thread and message created:", result);
        
        // Route to the newly created thread
        router.push(`/chat/${threadId}`);
        router.refresh();
      }
      
    } catch (error) {
      console.error("Failed to send message:", error);
      
      // Remove the optimistic message on error
      setMessages((prevMessages) => 
        prevMessages.filter(msg => msg.id !== messageId)
      );
      
      // Restore the input content on error
      setInput(messageContent);
      
      toast.error("Failed to send message. Please try again.");
    }
  };

  const reload = () => {
    // TODO: Implement reload functionality
    console.log("Reload functionality not yet implemented");
  };

  return (
    <ChatMessageArea
      scrollButtonAlignment="center"
      className="h-screen max-h-screen"
    >
      <div
        ref={containerRef}
        className="relative mx-auto flex h-full w-full max-w-3xl flex-col px-2 pt-14"
      >
        {messages.length > 0 || input.length > 0 ? (
          <div className="flex flex-col px-4 pb-30">
            {messages.map((message: UIMessage) => (
              <div className="flex-1" key={message.id}>
                <ChatMessage
                  message={message}
                  reload={reload}
                  setMessages={setMessages}
                />
              </div>
            ))}
            {status === "submitted" && (
              <div className="block">
                <MessageLoading />
              </div>
            )}
          </div>
        ) : (
          <ChatWelcome onQuestionClick={setInput} />
        )}

        {/* Input is now handled by the parent component */}
      </div>
    </ChatMessageArea>
  );
}
