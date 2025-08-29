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
  
  // TODO: Implement deleteTrailingMessages when we add the messages API
  // const deleteTrailingMessages = useMutation(api.messages.deleteTrailingMessages);

  const handleSetMode = (mode: "view" | "edit") => {
    setMode(mode);
  };

  // TODO: Implement proper retry functionality with Convex
  const handleRetry = async (draftContent?: string) => {
    console.log("Retry functionality not yet implemented");

    // TODO: Implement retry message for assistant
    // TODO: Delete trailing messages in Convex
    // TODO: Update messages state properly

    try {
      // TODO: Replace with actual Convex mutation when messages API is ready
      // await deleteTrailingMessages({ messageId: message.id });
      console.log("Would delete trailing messages for:", message.id);
    } catch (error) {
      toast.error("Failed to delete trailing messages");
    }

    // TODO: Fix this when we implement proper message handling
    // @ts-expect-error todo: support UIMessage in setMessages
    setMessages((messages: UIMessage[]) => {
      const index = messages.findIndex((m: UIMessage) => m.id === message.id);

      if (index !== -1) {
        const updatedMessage = {
          ...message,
          // TODO: Fix content property access for UIMessage
          // content: "",
          parts: [{ type: "text", text: draftContent || "" }],
        };

        return [...messages.slice(0, index), updatedMessage];
      }

      return messages;
    });

    // TODO: Implement reload functionality for AI SDK 5.0
    // reload();
  };

  return (
    <>
      {message.parts?.map((part: any, index: number) => {
        const { type } = part;
        const key = `message-${message.id}-part-${index}`;

        if (type === "text") {
          if (isUser) {
            return (
              <div key={key}>
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
                        <MarkdownContent content={part.text} id={message.id} />
                      </ChatBubbleMessage>
                      <div className="pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100">
                        <CustomButton
                          description="Retry message"
                          className="bg-transparent"
                          onClick={() => handleRetry(part.text)}
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
                        <CopyButton value={part.text} />
                      </div>
                    </div>
                  </ChatBubble>
                ) : (
                  <EditMessage
                    initialText={part.text}
                    setMode={handleSetMode}
                    setMessages={setMessages}
                    reload={reload}
                    message={message}
                  />
                )}
              </div>
            );
          } else {
            return (
              <ChatBubble
                className="w-full max-w-full break-words"
                key={key}
                variant="received"
              >
                <div className="group flex w-full flex-col items-start">
                  <ChatBubbleMessage
                    variant="sent"
                    className="text-chat-text bg-transparent px-0"
                  >
                    <MarkdownContent content={part.text} id={message.id} />
                  </ChatBubbleMessage>

                  {/* TODO: Implement proper annotation handling when we add annotations support */}
                  {/* TODO: Annotations property doesn't exist in UIMessage - implement differently */}
                  {/* {message.annotations?.map((annotation: any, index: number) => {
                    if (
                      typeof annotation === "object" &&
                      annotation !== null &&
                      "hasStopped" in annotation
                    ) {
                      return (
                        <div
                          key={`annotation-${index}`}
                          className="text-chat-text/75 mb-2 w-full rounded-lg bg-red-200 px-4 py-3 dark:bg-red-900/50 dark:text-red-400"
                        >
                          Stopped by user
                        </div>
                      );
                    }
                  })} */}

                  <div className="pointer-events-none flex items-center opacity-0 group-hover:pointer-events-auto group-hover:opacity-100">
                    <CopyButton value={part.text} />
                    
                    {/* TODO: Add retry message for assistant */}
                    {/* <CustomButton
                      description="Retry message"
                      className="bg-transparent"
                    >
                      <RefreshCcw />
                    </CustomButton> */}
                    
                    {/* TODO: Implement proper model ID display when we add annotations support */}
                    {/* TODO: Annotations property doesn't exist in UIMessage - implement differently */}
                    {/* {message.annotations?.map((annotation: any, index: number) => {
                      if (
                        typeof annotation === "object" &&
                        annotation !== null &&
                        "modelId" in annotation
                      ) {
                        return (
                          <p
                            className="text-sidebar-logo ml-1 text-xs font-semibold"
                            key={`annotation-${index}`}
                          >
                            {annotation.modelId as string}
                          </p>
                        );
                      }
                    })} */}
                  </div>
                </div>
              </ChatBubble>
            );
          }
        }
      })}
    </>
  );
}
