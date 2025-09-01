"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { generateUUID, copyToClipboard } from "../lib/utils";
import { useModel } from "@/contexts/model-context";
import { useInitialMessage } from "@/contexts/initial-message-context";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToolType, getDefaultTools } from "@/lib/ai/model-tools";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ai/ui/tooltip";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai/tool";
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
  SearchIcon,
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

  const [isSearchEnabled, setIsSearchEnabled] = useState<boolean>(false);

  // Initialize search state from localStorage when model changes
  useEffect(() => {
    // Only access localStorage on client side
    if (typeof window !== "undefined") {
      const savedSearchState = localStorage.getItem("webSearchEnabled");
      const searchEnabled = savedSearchState === "true";
      setIsSearchEnabled(searchEnabled);
    }
  }, [selectedModel]);

  const handleSearchToggle = useCallback(() => {
    const newSearchState = !isSearchEnabled;
    setIsSearchEnabled(newSearchState);

    // Save to localStorage (client side only)
    if (typeof window !== "undefined") {
      localStorage.setItem("webSearchEnabled", newSearchState.toString());
    }
  }, [isSearchEnabled]);

  const isThread = id !== "welcome";

  // Only run the Convex query when authenticated
  const { results: threadDocs = [] } = usePaginatedQuery(
    api.threads.getThreadMessagesPaginated,
    isThread && isAuthenticated ? { threadId: id } : "skip",
    { initialNumItems: 10 },
  );

  // Force useChat to re-initialize when model changes
  const [chatKey, setChatKey] = useState(0);
  const prevModelRef = useRef(selectedModel);

  useEffect(() => {
    if (prevModelRef.current !== selectedModel) {
      prevModelRef.current = selectedModel;
      setChatKey((prev) => prev + 1);
    }
  }, [selectedModel]);

  const { messages, status, setMessages, sendMessage, regenerate, stop } =
    useChat({
      id: `${id}-${chatKey}`,
      generateId: generateUUID,
      onFinish() {
        if (pathname === "/") {
          router.push(`/chat/${id}`);
          router.refresh();
        }
      },
      onError(error: Error) {
        console.error("Chat error:", error);
        // Don't show error toast for aborted requests (user stopped generation)
        if (
          !error.message.includes("aborted") &&
          !error.message.includes("cancelled")
        ) {
          toast.error("An error occurred. Please try again.");
        }
      },
      transport: new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => {
          // Get current tools state at the time of sending
          const currentDefaultTools = getDefaultTools(selectedModel);
          const currentSearchState =
            typeof window !== "undefined"
              ? localStorage.getItem("webSearchEnabled") === "true"
              : false;
          const currentEnabledTools = currentSearchState
            ? [...currentDefaultTools, "google_search" as ToolType]
            : currentDefaultTools;

          return {
            body: {
              messages,
              modelId: selectedModel,
              threadId: id,
              enabledTools: currentEnabledTools,
            },
          };
        },
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
      interface ConvexMessage {
        messageId: string;
        role: "user" | "assistant" | "system";
        reasoning?: string;
        content?: string;
      }
      const convexMessages = [...threadDocs]
        .reverse()
        .map((m: ConvexMessage) => ({
          id: m.messageId,
          role: m.role,
          parts: [
            ...(m.reasoning ? [{ type: "reasoning", text: m.reasoning }] : []),
            ...(m.content ? [{ type: "text", text: m.content }] : []),
          ],
        })) as UIMessage[];
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
      interface ConvexMessage {
        messageId: string;
        role: "user" | "assistant" | "system";
        reasoning?: string;
        content?: string;
      }
      const convexMessages = [...threadDocs]
        .reverse()
        .map((m: ConvexMessage) => ({
          id: m.messageId,
          role: m.role,
          parts: [
            ...(m.reasoning ? [{ type: "reasoning", text: m.reasoning }] : []),
            ...(m.content ? [{ type: "text", text: m.content }] : []),
          ],
        })) as UIMessage[];

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
                      {(() => {
                        // Group reasoning parts together
                        const reasoningParts = message.parts.filter(
                          (part) => part.type === "reasoning" && "text" in part,
                        );
                        const nonReasoningParts = message.parts.filter(
                          (part) => part.type !== "reasoning",
                        );

                        return (
                          <>
                            {/* Single reasoning section for all reasoning parts */}
                            {reasoningParts.length > 0 && (
                              <Reasoning
                                key={`${message.id}-reasoning`}
                                className="w-full mb-4"
                                isStreaming={status === "streaming"}
                                defaultOpen={false}
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>
                                  <div className="bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg p-5 border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-blue-200/30 dark:border-blue-800/30">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                      <div className="text-xs text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wide">
                                        AI Reasoning Process
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      {reasoningParts.map((part, i) => (
                                        <div
                                          key={i}
                                          className="relative pl-4 border-l-2 border-blue-300/40 dark:border-blue-700/40"
                                        >
                                          <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                            {(part as { text: string }).text}
                                          </div>
                                          {i < reasoningParts.length - 1 && (
                                            <div className="mt-3 mb-1 w-full h-px bg-gradient-to-r from-transparent via-blue-200/50 to-transparent dark:via-blue-800/50"></div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </ReasoningContent>
                              </Reasoning>
                            )}

                            {/* Render non-reasoning parts */}
                            {nonReasoningParts.map((part, i: number) => {
                              if (part.type === "text" && "text" in part) {
                                return (
                                  <Response key={`${message.id}-${i}`}>
                                    {part.text}
                                  </Response>
                                );
                              }
                              if (part.type === "tool-call") {
                                const toolCall = part as {
                                  toolName?: string;
                                  args?: unknown;
                                };
                                const toolName = toolCall.toolName || "tool";

                                return (
                                  <Tool
                                    key={`${message.id}-${i}`}
                                    className="my-2 border-blue-200 bg-blue-50/50"
                                  >
                                    <ToolHeader
                                      type={
                                        `tool-${toolName}` as `tool-${string}`
                                      }
                                      state="input-available"
                                    />
                                    <ToolContent>
                                      <ToolInput input={toolCall.args || {}} />
                                    </ToolContent>
                                  </Tool>
                                );
                              }
                              if (part.type === "tool-result") {
                                const toolResult = part as {
                                  toolName?: string;
                                  result?: unknown;
                                  isError?: boolean;
                                };
                                const toolName = toolResult.toolName || "tool";

                                return (
                                  <Tool
                                    key={`${message.id}-${i}`}
                                    className="my-2 border-green-200 bg-green-50/50"
                                  >
                                    <ToolHeader
                                      type={
                                        `tool-${toolName}` as `tool-${string}`
                                      }
                                      state={
                                        toolResult.isError
                                          ? "output-error"
                                          : "output-available"
                                      }
                                    />
                                    <ToolContent>
                                      <ToolOutput
                                        output={
                                          toolName === "google_search" ||
                                          toolName === "url_context" ? (
                                            <div className="p-3 text-sm">
                                              <div className="text-green-700 font-medium mb-2">
                                                ✓ Successfully retrieved
                                                information
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                Content has been analyzed and
                                                integrated into the response
                                                above.
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="p-3">
                                              <pre className="whitespace-pre-wrap text-xs">
                                                {typeof toolResult.result ===
                                                "string"
                                                  ? toolResult.result
                                                  : JSON.stringify(
                                                      toolResult.result,
                                                      null,
                                                      2,
                                                    )}
                                              </pre>
                                            </div>
                                          )
                                        }
                                        errorText={
                                          toolResult.isError
                                            ? "Tool execution failed"
                                            : undefined
                                        }
                                      />
                                    </ToolContent>
                                  </Tool>
                                );
                              }

                              return null;
                            })}
                          </>
                        );
                      })()}
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
                          onClick={async () => {
                            const textContent = message.parts
                              .filter((part) => part.type === "text")
                              .map((part) => (part as { text: string }).text)
                              .join("\n");
                            await copyToClipboard(textContent);
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
                          onClick={async () => {
                            const textContent = message.parts
                              .filter((part) => part.type === "text")
                              .map((part) => (part as { text: string }).text)
                              .join("\n");
                            await copyToClipboard(textContent);
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PromptInputButton
                        onClick={handleSearchToggle}
                        aria-label="Toggle web search"
                        disabled={disableInput || !isAuthenticated}
                        variant={isSearchEnabled ? "default" : "ghost"}
                        className={
                          isSearchEnabled
                            ? "bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
                            : ""
                        }
                      >
                        <SearchIcon size={16} />
                      </PromptInputButton>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center">
                      <p>{isSearchEnabled ? "Disable" : "Enable"} web search</p>
                      <p className="text-xs text-muted-foreground">
                        Search the web for current information
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
              <PromptInputSubmit
                disabled={disableInput || !isAuthenticated}
                status={status}
                onStop={() => {
                  // Preserve current streaming message content before stopping
                  const lastMessage = messages[messages.length - 1];
                  if (lastMessage && lastMessage.role === "assistant") {
                    setMessages((currentMessages) => {
                      const updatedMessages = [...currentMessages];
                      updatedMessages[updatedMessages.length - 1] = {
                        ...lastMessage,
                        parts: lastMessage.parts, // Preserve current content
                      };
                      return updatedMessages;
                    });
                  }

                  stop();
                }}
              />
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
