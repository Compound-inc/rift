"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { generateUUID } from "@/lib/utils";
import { useModel } from "@/contexts/model-context";
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
    <div>
      <h1>Chat Interface</h1>
    </div>
  );
}
