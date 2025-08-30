"use client";

import ChatMessage from "@/components/chat-message";
import ChatWelcome from "@/components/chat-welcome";

import { ChatMessageArea } from "@/components/ui/chat-message-area";
import { MessageLoading } from "@/components/ui/message-loading";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
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
  disableInput = false,
}: {
  id: string;
  initialMessages?: UIMessage[];
  disableInput?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedModel } = useModel();
  const [input, setInput] = useState("");
  
  const sendMessageMutation = useMutation(api.threads.sendMessage);

  const {
    messages,
    stop,
    status,
    setMessages,
    sendMessage,
  } = useChat({
    id,
    generateId: generateUUID,

    onFinish({ message }: { message: UIMessage }) {
      console.log("AI response finished:", message);

      if (pathname === "/") {
        router.push(`/chat/${id}`);
        router.refresh();
      }
    },

    onError(error: Error) {
      console.error("Chat error:", error);
      toast.error("An error occurred. Please try again.");
    },

    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages, modelId: selectedModel, threadId: id },
      }),
    }),
  });

  // Hydrate initial messages only if the local list is empty to avoid mid-stream overrides
  useEffect(() => {
    if ((initialMessages && initialMessages.length > 0) && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages, messages.length]);

  const [containerRef, showScrollButton, scrollToBottom] =
    useScrollToBottom<HTMLDivElement>();

  // Use initialMessages as a first-render fallback to avoid welcome flicker
  const renderedMessages: UIMessage[] =
    messages.length > 0 ? messages : initialMessages ?? [];

  const handleStopStream = async () => {
    stop();

    if (pathname === "/") {
      router.push(`/chat/${id}`);
      router.refresh();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (disableInput) return;
    setInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (disableInput || !input.trim()) return;

    const messageContent = input.trim();
    const messageId = generateUUID();

    // clear immediately for snappy UI
    setInput("");

    try {
      // Trigger AI SDK streaming only; server route persists the user message
      await sendMessage({
        id: messageId,
        role: "user",
        parts: [{ type: "text", text: messageContent }],
      });

      // Remove client-side duplicate persistence to Convex to avoid reordering/flicker
      // if (pathname.startsWith("/chat/") && pathname !== "/") {
      //   sendMessageMutation({
      //     threadId: id,
      //     content: messageContent,
      //     model: selectedModel,
      //     messageId: messageId,
      //   }).catch(() => {});
      // }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
      // restore input on error
      setInput(messageContent);
    }
  };

  const reload = () => {
    console.log("Reload functionality not yet implemented");
  };

  return (
    <ChatMessageArea
      scrollButtonAlignment="center"
    >
      <div
        ref={containerRef}
        className="relative mx-auto flex h-full w-full max-w-3xl flex-col px-2 pt-14"
      >
        {renderedMessages.length > 0 || input.length > 0 ? (
          <div className="flex flex-col px-4">
            {renderedMessages.map((message: UIMessage) => (
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

        <div className="fixed bottom-0 z-50 mt-auto w-2xl">
          <div className="absolute inset-0 rounded-2xl rounded-t-[20px] rounded-b-none border-8 border-b-0 bg-white/30 backdrop-blur-md dark:bg-black/30" />
          <ChatInputContainer
            input={input}
            status={status}
            showScrollButton={showScrollButton}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onStop={handleStopStream}
            onScrollToBottom={scrollToBottom}
          />
        </div>
      </div>
    </ChatMessageArea>
  );
}
