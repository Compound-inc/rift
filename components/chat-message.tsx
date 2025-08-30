"use client";

import { ChatBubble, ChatBubbleMessage } from "./ui/chat-bubble";
import { MarkdownContent } from "./ui/markdown-content";
import { Edit, RefreshCcw } from "lucide-react";
import CustomButton from "./custom-button";
import CopyButton from "./ui/copy-button";
import { useState } from "react";
import EditMessage from "./edit-message";
import { UseChatHelpers, type UIMessage } from "@ai-sdk/react";
import { toast } from "sonner";

export default function ChatMessage({
  message,
  setMessages,
  reload,
}: {
  message: UIMessage;
  setMessages: UseChatHelpers<UIMessage>["setMessages"];
  // TODO: reload property doesn't exist in AI SDK 5.0 - implement differently
  reload: any;
}) {
  const isUser = message.role === "user";
  const [mode, setMode] = useState<"view" | "edit">("view");
  
  // Concatenate all text parts into a single string to avoid duplicate bubbles
  const combinedText = (message.parts || [])
    .filter((p: any) => p?.type === "text" && typeof p.text === "string")
    .map((p: any) => p.text)
    .join("");

  // TODO: Implement deleteTrailingMessages when we add the messages API
  // const deleteTrailingMessages = useMutation(api.messages.deleteTrailingMessages);

  const handleSetMode = (mode: "view" | "edit") => {
    setMode(mode);
  };

  // TODO: Implement proper retry functionality with Convex
  const handleRetry = async (draftContent?: string) => {
    console.log("Retry functionality not yet implemented");

    try {
      console.log("Would delete trailing messages for:", message.id);
    } catch (error) {
      toast.error("Failed to delete trailing messages");
    }

    // @ts-expect-error todo: support UIMessage in setMessages
    setMessages((messages: UIMessage[]) => {
      const index = messages.findIndex((m: UIMessage) => m.id === message.id);

      if (index !== -1) {
        const updatedMessage = {
          ...message,
          parts: [{ type: "text", text: draftContent || "" }],
        };

        return [...messages.slice(0, index), updatedMessage];
      }

      return messages;
    });

    // reload();
  };

  if (!combinedText) return null;

  if (isUser) {
    return (
      <div>
        {mode === "view" ? (
          <ChatBubble
            className="max-w-[90%] justify-self-end break-words"
            variant="sent"
          >
            <div className="group flex flex-col items-end gap-1">
              <ChatBubbleMessage
                className="bg-chat-user-background text-chat-text px-4 py-3"
                variant="sent"
              >
                <MarkdownContent content={combinedText} id={message.id} />
              </ChatBubbleMessage>
              <div className="pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100">
                <CustomButton
                  description="Retry message"
                  className="bg-transparent"
                  onClick={() => handleRetry(combinedText)}
                >
                  <RefreshCcw />
                </CustomButton>
                <CustomButton
                  description="Edit message"
                  className="bg-transparent"
                  onClick={() => handleSetMode("edit")}
                >
                  <Edit />
                </CustomButton>
                <CopyButton value={combinedText} />
              </div>
            </div>
          </ChatBubble>
        ) : (
          <EditMessage
            initialText={combinedText}
            setMode={handleSetMode}
            setMessages={setMessages}
            reload={reload}
            message={message}
          />
        )}
      </div>
    );
  }

  return (
    <ChatBubble
      className="w-full max-w-full break-words"
      variant="received"
    >
      <div className="group flex w-full flex-col items-start">
        <ChatBubbleMessage
          variant="sent"
          className="text-chat-text bg-transparent px-0"
        >
          <MarkdownContent content={combinedText} id={message.id} />
        </ChatBubbleMessage>
        <div className="pointer-events-none flex items-center opacity-0 group-hover:pointer-events-auto group-hover:opacity-100">
          <CopyButton value={combinedText} />
        </div>
      </div>
    </ChatBubble>
  );
}
