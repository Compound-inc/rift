"use client";

import ChatInterface from "@/components/chat-interface";
import { ChatInputContainer } from "@/components/chat-input-container";
import { generateUUID } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useModel } from "@/contexts/model-context";
import { toast } from "sonner";
import { Authenticated, Unauthenticated } from "convex/react";
import { UIMessage } from "ai";
import { useChatCache } from "@/contexts/chat-cache";

export default function Home() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "streaming" | "ready" | "error">("idle");
  const [optimisticMessages, setOptimisticMessages] = useState<UIMessage[]>([]);
  const { selectedModel } = useModel();
  const createThread = useMutation(api.threads.createThread);
  const router = useRouter();
  const { setMessages } = useChatCache();

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const messageContent = input.trim();
    const threadId = generateUUID();
    const messageId = generateUUID();
    
    // Create optimistic message for instant UI update
    const optimisticMessage: UIMessage = {
      id: messageId,
      role: "user",
      parts: [{ type: "text" as const, text: messageContent }],
    };

    // Add optimistic message to UI immediately
    setOptimisticMessages([optimisticMessage]);
    // Pre-populate cache for the new thread to avoid flicker after navigation
    setMessages(threadId, [optimisticMessage]);
    
    // Clear the input immediately
    setInput("");
    setStatus("submitting");

    try {
      // Create new thread with initial message
      const result = await createThread({
        threadId: threadId,
        content: messageContent,
        model: selectedModel,
        messageId: messageId,
      });

      setStatus("submitted");
      
      // Redirect to the new chat thread
      router.push(`/chat/${threadId}`);
      
    } catch (error) {
      console.error("Failed to create thread:", error);
      
      // Remove optimistic message on error
      setOptimisticMessages([]);
      
      // Restore the input content on error
      setInput(messageContent);
      setStatus("error");
      
      toast.error("Failed to create chat. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen h-full flex-col">
      <div className="flex-1">
        <Authenticated>
          <div className="h-full">
            <ChatInterface 
              id="welcome" 
              disableInput={true}
              initialMessages={optimisticMessages}
            />
          </div>
        </Authenticated>
        <Unauthenticated>
          {null}
        </Unauthenticated>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 mt-auto">
        <ChatInputContainer
          input={input}
          status={status}
          showScrollButton={false}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          onStop={() => {}}
          onScrollToBottom={() => {}}
        />
      </div>
    </div>
  );
}
