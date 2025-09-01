"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { generateUUID } from "../lib/utils";
import { useModel } from "@/contexts/model-context";
import { useInitialMessage } from "@/contexts/initial-message-context";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Message, MessageContent } from "@/components/ai/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai/prompt-input";
import { Response } from "@/components/ai/response";
import { Actions, Action } from "@/components/ai/actions";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai/reasoning";
import { Loader } from "@/components/ai/loader";
import { MODELS } from "@/lib/ai/ai-providers";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  PaperclipIcon,
  RefreshCwIcon,
  CopyIcon,
  GitBranchIcon,
  EditIcon,
} from "lucide-react";
import { Authenticated, useConvexAuth } from "convex/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai/conversation";

export default function ChatInterface({
  id,
  initialMessages,
  disableInput = false,
  onInitialMessage,
}: {
  id: string;
  initialMessages?: UIMessage[];
  disableInput?: boolean;
  onInitialMessage?: (message: UIMessage) => Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedModel, setSelectedModel } = useModel();
  const { consumeInitialMessage } = useInitialMessage();
  const [input, setInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoStartTriggeredRef = useRef(false);
  const sendMessageRef = useRef<((message: UIMessage) => Promise<void>) | null>(
    null,
  );
  const { isAuthenticated } = useConvexAuth();

  const isThread = id !== "welcome";

  // Only run the Convex query when authenticated
  const { results: threadDocs = [] } = usePaginatedQuery(
    api.threads.getThreadMessagesPaginated,
    isThread && isAuthenticated ? { threadId: id } : "skip",
    { initialNumItems: 10 },
  );

  const { messages, status, setMessages, sendMessage, regenerate } = useChat({
    id,
    generateId: generateUUID,
    onFinish() {
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

  // Store sendMessage in ref to prevent useEffect from re-running
  sendMessageRef.current = sendMessage;

  useEffect(() => {
    if (
      initialMessages &&
      initialMessages.length > 0 &&
      messages.length === 0
    ) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages, messages.length]);

  useEffect(() => {
    if (messages.length === 0 && threadDocs.length > 0 && isAuthenticated) {
      // Convert Convex messages to UIMessage format
      const convexMessages = [...threadDocs].reverse().map((m: any) => ({
        id: m.messageId,
        role: m.role,
        parts: [
          ...(m.reasoning
            ? [{ type: "reasoning", text: m.reasoning } as any]
            : []),
          ...(m.content ? [{ type: "text", text: m.content } as any] : []),
        ],
      }));
      setMessages(convexMessages);
    }
  }, [messages.length, threadDocs, setMessages, isAuthenticated]);

  // Auto-start with initial message from context
  useEffect(() => {
    if (!autoStartTriggeredRef.current && isThread && isAuthenticated) {
      const initialMessage = consumeInitialMessage(id);

      if (initialMessage) {
        // Mark as triggered to prevent duplicate calls
        autoStartTriggeredRef.current = true;

        // Start AI streaming - this will handle both user message persistence and AI response
        sendMessageRef.current?.(initialMessage);
      }
    }
  }, [id, isThread, isAuthenticated, consumeInitialMessage]);

  // Removed auto-start effect - no longer needed with Convex optimistic updates
  // The AI SDK sendMessage will handle streaming responses automatically

  const renderedMessages: UIMessage[] = useMemo(() => {
    // Convert Convex messages to UIMessage format for display
    if (isThread && isAuthenticated && threadDocs.length > 0) {
      // Convert Convex messages to UIMessage format (oldest-first for display)
      const convexMessages = [...threadDocs].reverse().map((m: any) => ({
        id: m.messageId,
        role: m.role,
        parts: [
          ...(m.reasoning
            ? [{ type: "reasoning", text: m.reasoning } as any]
            : []),
          ...(m.content ? [{ type: "text", text: m.content } as any] : []),
        ],
      }));

      // If we have AI SDK messages (for streaming), merge them with Convex messages
      if (messages.length > 0) {
        // Find the last user message from AI SDK to see if we need to add it
        const lastUserMessage = messages.find((m) => m.role === "user");
        if (
          lastUserMessage &&
          !convexMessages.some((m) => m.id === lastUserMessage.id)
        ) {
          return [...convexMessages, lastUserMessage];
        }
        return messages;
      }

      return convexMessages;
    }

    // Fallback to AI SDK messages or initial messages
    if (messages.length > 0) {
      return messages;
    }
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }

    return [];
  }, [isThread, isAuthenticated, threadDocs, messages, initialMessages]);

  const hasAssistantMessage = useMemo(
    () => renderedMessages.some((m) => m.role === "assistant"),
    [renderedMessages],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (disableInput) return;
      setInput(e.target.value);
    },
    [disableInput],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (disableInput || !input.trim()) return;

      const messageContent = input.trim();
      const messageId = generateUUID();

      setInput("");

      try {
        if (id === "welcome" && onInitialMessage) {
          // Handle initial message on welcome page
          const optimisticMessage: UIMessage = {
            id: messageId,
            role: "user",
            parts: [{ type: "text", text: messageContent }],
          };

          // Show optimistic message immediately
          setMessages([optimisticMessage]);

          // Call the onInitialMessage callback to create thread and navigate
          await onInitialMessage(optimisticMessage);
        } else if (id !== "welcome") {
          // Use AI SDK sendMessage for streaming response
          // The API route will handle user message persistence
          await sendMessage({
            id: messageId,
            role: "user",
            parts: [{ type: "text", text: messageContent }],
          });
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        toast.error("Failed to send message. Please try again.");
        setInput(messageContent);
        // Clear optimistic messages on error
        setMessages([]);
      }
    },
    [disableInput, input, id, onInitialMessage, setMessages, sendMessage],
  );

  const handleAttachClick = useCallback(() => {
    if (disableInput) return;
    fileInputRef.current?.click();
  }, [disableInput]);

  const handleFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      const names = files.map((f) => `[${f.name}]`).join(" ");
      setInput((prev) => (prev ? `${prev} ${names}` : names));
      // reset to allow selecting the same file again
      e.currentTarget.value = "";
    },
    [],
  );

  const models = MODELS;

  return (
    <div className="flex h-screen w-full min-h-0 flex-col relative">
      {/* Single scrollable area that includes messages and actions - now takes full height */}
      <div className="flex-1 min-h-0">
        <Authenticated>
          <Conversation>
            <ConversationContent className="mx-auto w-full max-w-3xl p-4 pb-30">
              {renderedMessages.map((message) => (
                <div key={message.id} className="group">
                  <Message from={message.role} key={message.id}>
                    <MessageContent from={message.role}>
                      {message.parts.map((part: any, i: number) => {
                        switch ((part as any).type) {
                          case "text":
                            return (
                              <Response key={`${message.id}-${i}`}>
                                {(part as any).text}
                              </Response>
                            );
                          case "reasoning":
                            return (
                              <Reasoning
                                key={`${message.id}-${i}`}
                                className="w-full"
                                isStreaming={status === "streaming"}
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>
                                  {(part as any).text}
                                </ReasoningContent>
                              </Reasoning>
                            );
                          default:
                            return null;
                        }
                      })}
                    </MessageContent>
                  </Message>
                  {/* Actions appear outside the message */}
                  {message.role === "assistant" && (
                    <div className="px-0">
                      <Actions className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-start">
                        <Action
                          onClick={() => regenerate?.()}
                          label="Retry"
                          tooltip="Regenerate response"
                        >
                          <RefreshCwIcon className="size-4" />
                        </Action>
                        <Action
                          onClick={() => {
                            // Get the text content from all parts
                            const textContent = message.parts
                              .filter((part: any) => part.type === "text")
                              .map((part: any) => part.text)
                              .join("\n");
                            navigator.clipboard.writeText(textContent);
                            toast.success("Copied to clipboard");
                          }}
                          label="Copy"
                          tooltip="Copy to clipboard"
                        >
                          <CopyIcon className="size-4" />
                        </Action>
                        <Action
                          onClick={() => {
                            // TODO: Implement branch functionality
                            toast.info("Branch feature coming soon");
                          }}
                          label="Branch"
                          tooltip="Create a new branch"
                        >
                          <GitBranchIcon className="size-4" />
                        </Action>
                      </Actions>
                    </div>
                  )}
                  {/* Actions for user messages */}
                  {message.role === "user" && (
                    <div className="px-0">
                      <Actions className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <Action
                          onClick={() => {
                            // TODO: Implement retry for user message
                            toast.info(
                              "Retry user message feature coming soon",
                            );
                          }}
                          label="Retry"
                          tooltip="Retry message"
                        >
                          <RefreshCwIcon className="size-4" />
                        </Action>
                        <Action
                          onClick={() => {
                            // TODO: Implement edit functionality
                            toast.info("Edit message feature coming soon");
                          }}
                          label="Edit"
                          tooltip="Edit message"
                        >
                          <EditIcon className="size-4" />
                        </Action>
                        <Action
                          onClick={() => {
                            // Get the text content from all parts
                            const textContent = message.parts
                              .filter((part: any) => part.type === "text")
                              .map((part: any) => part.text)
                              .join("\n");
                            navigator.clipboard.writeText(textContent);
                            toast.success("Copied to clipboard");
                          }}
                          label="Copy"
                          tooltip="Copy to clipboard"
                        >
                          <CopyIcon className="size-4" />
                        </Action>
                        <Action
                          onClick={() => {
                            // TODO: Implement branch functionality
                            toast.info("Branch feature coming soon");
                          }}
                          label="Branch"
                          tooltip="Create a new branch"
                        >
                          <GitBranchIcon className="size-4" />
                        </Action>
                      </Actions>
                    </div>
                  )}
                </div>
              ))}
              {(status === "submitted" || status === "streaming") &&
                !hasAssistantMessage && <Loader />}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </Authenticated>
      </div>

      {/* Prompt input overlayed at bottom of the main area (not part of scroll flow) */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="mx-auto w-full max-w-3xl px-2">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              onChange={handleInputChange}
              value={input}
              disabled={disableInput || !isAuthenticated}
              placeholder={
                !isAuthenticated
                  ? "Sign in to start chatting..."
                  : "Type your message..."
              }
            />
            <PromptInputToolbar>
              <PromptInputTools>
                <PromptInputButton
                  onClick={handleAttachClick}
                  aria-label="Add attachments"
                  disabled={disableInput || !isAuthenticated}
                >
                  <PaperclipIcon size={16} />
                </PromptInputButton>
                <PromptInputModelSelect
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                >
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {models.map((model) => (
                      <PromptInputModelSelectItem
                        key={model.id}
                        value={model.id}
                      >
                        {model.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
              <PromptInputSubmit disabled={disableInput || !isAuthenticated} />
            </PromptInputToolbar>
          </PromptInput>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
        </div>
      </div>
    </div>
  );
}
