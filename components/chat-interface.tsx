"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { generateUUID, copyToClipboard } from "../lib/utils";
import { useModel } from "@/contexts/model-context";
import { useInitialMessage } from "@/contexts/initial-message-context";
import { useMessageRegeneration } from "@/hooks/use-message-regeneration";
import { useMessageEdit } from "@/hooks/use-message-edit";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";

import { ToolType, getDefaultTools } from "@/lib/ai/model-tools";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import {
  AttachmentsIcon,
  RedoIcon,
  CopyIcon,
  BranchIcon,
  EditIcon,
  GlobeIcon,
  IdeaIcon,
  BrainPersonIcon,
  GrowthIcon,
  LampIcon,
  XIcon,
  CheckIcon,
  LoadingIcon,
  DeskIcon,
  StudentIcon,
  DoddleLine,
} from "@/components/ui/icons/svg-icons";
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
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai/prompt-input";
import { ModelSelector } from "@/components/ai/model-selector";
import { Response } from "@/components/ai/response";
import { Actions, Action } from "@/components/ai/actions";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai/reasoning";
import { Loader } from "@/components/ai/loader";
import { usePaginatedQuery, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, Preloaded } from "convex/react";
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
  preloadedMessages,
}: {
  id: string;
  initialMessages?: UIMessage[];
  disableInput?: boolean;
  onInitialMessage?: (message: UIMessage) => Promise<void>;
  preloadedMessages?: Preloaded<
    typeof api.threads.getThreadMessagesPaginatedSafe
  >;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedModel, setSelectedModel } = useModel();
  const { consumeInitialMessage } = useInitialMessage();
  const [input, setInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoStartTriggeredRef = useRef(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessageRef = useRef<((message: UIMessage) => Promise<void>) | null>(
    null,
  );
  const [quotaError, setQuotaError] = useState<{
    type: "standard" | "premium";
    message: string;
    currentUsage: number;
    limit: number;
    otherTypeUsage: number;
    otherTypeLimit: number;
  } | null>(null);
  const { isAuthenticated } = useConvexAuth();
  const { user } = useAuth();

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

  // Use preloaded messages if available
  const preloadedResults = preloadedMessages
    ? usePreloadedQuery(preloadedMessages)
    : null;

  // Only run the Convex query when authenticated and no preloaded messages
  const { results: threadDocs = [] } = usePaginatedQuery(
    api.threads.getThreadMessagesPaginatedSafe,
    isThread && !preloadedMessages ? { threadId: id } : "skip",
    { initialNumItems: 10 },
  );

  // Use preloaded messages if available, otherwise use the query results
  const effectiveThreadDocs = preloadedResults?.page || threadDocs;

  // Force useChat to re-initialize when model changes
  const [chatKey, setChatKey] = useState(0);
  const prevModelRef = useRef(selectedModel);

  useEffect(() => {
    if (prevModelRef.current !== selectedModel) {
      prevModelRef.current = selectedModel;
      setChatKey((prev) => prev + 1);
      // Clear quota error when switching models
      setQuotaError(null);
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

        // Check if this is a quota error and parse JSON response
        if (
          error.message.includes("quota exceeded") ||
          error.message.includes("Message quota exceeded")
        ) {
          try {
            // Parse JSON error response
            const jsonMatch = error.message.match(/\{.*\}/);
            if (jsonMatch) {
              const errorResponse = JSON.parse(jsonMatch[0]);
              if (
                errorResponse.error === "Quota exceeded" &&
                errorResponse.quotaInfo &&
                errorResponse.otherQuotaInfo
              ) {
                setQuotaError({
                  type: errorResponse.quotaType || "standard",
                  message: errorResponse.message,
                  currentUsage: errorResponse.quotaInfo.currentUsage,
                  limit: errorResponse.quotaInfo.limit,
                  otherTypeUsage: errorResponse.otherQuotaInfo.currentUsage,
                  otherTypeLimit: errorResponse.otherQuotaInfo.limit,
                });
              }
            }
          } catch {
            // If parsing fails, show generic quota error
            setQuotaError({
              type: "standard",
              message: "Message quota exceeded",
              currentUsage: 0,
              limit: 0,
              otherTypeUsage: 0,
              otherTypeLimit: 0,
            });
          }
        } else {
          // Clear quota error for non-quota errors
          setQuotaError(null);

          // Don't show error toast for aborted requests (user stopped generation)
          if (
            !error.message.includes("aborted") &&
            !error.message.includes("cancelled")
          ) {
            toast.error("An error occurred. Please try again.");
          }
        }
      },
      transport: new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, trigger, messageId }) => {
          // Get current tools state at the time of sending
          const currentDefaultTools = getDefaultTools(selectedModel);
          const currentSearchState =
            typeof window !== "undefined"
              ? localStorage.getItem("webSearchEnabled") === "true"
              : false;
          const currentEnabledTools = currentSearchState
            ? [...currentDefaultTools, "web_search" as ToolType]
            : currentDefaultTools;

          // For regeneration, we need to handle the messageId and trigger
          if (trigger === "regenerate-message" && messageId) {
            // The messages array should already be filtered by AI SDK
            // but we can add additional processing here if needed
          }

          return {
            body: {
              messages,
              modelId: selectedModel,
              threadId: id,
              enabledTools: currentEnabledTools,
              trigger,
              messageId,
            },
          };
        },
      }),
    });

  // Initialize regeneration hook
  const { regenerateAssistantMessage, regenerateAfterUserMessage } =
    useMessageRegeneration({
      messages,
      setMessages,
      regenerate,
    });

  // Initialize edit hook
  const {
    editText,
    startEditing,
    cancelEditing,
    saveEdit,
    updateEditText,
    isEditing,
    isLoading,
  } = useMessageEdit({
    messages,
    setMessages,
    regenerateAfterUserMessage,
    threadId: id,
    status,
  });

  useEffect(() => {
    const textarea = editTextareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const maxHeight = 200;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [editText]);

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
    // Process messages immediately when available
    if (messages.length === 0 && effectiveThreadDocs.length > 0) {
      // Convert Convex messages to UIMessage format
      interface ConvexMessage {
        messageId: string;
        role: "user" | "assistant" | "system";
        reasoning?: string;
        content?: string;
      }
      const convexMessages = [...effectiveThreadDocs]
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
  }, [messages.length, effectiveThreadDocs, setMessages]);

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
    if (isThread && effectiveThreadDocs.length > 0) {
      // Convert Convex messages to UIMessage format (oldest-first for display)
      interface ConvexMessage {
        messageId: string;
        role: "user" | "assistant" | "system";
        reasoning?: string;
        content?: string;
      }
      const convexMessages = [...effectiveThreadDocs]
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
  }, [isThread, effectiveThreadDocs, messages, initialMessages]);

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

      // Clear any existing quota error when user tries to send a new message
      setQuotaError(null);
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

  return (
    <div className="flex h-screen w-full min-h-0 flex-col relative">
      {/* Single scrollable area that includes messages and actions - now takes full height */}
      <div className="flex-1 min-h-0">
        <Conversation>
          <ConversationContent className="mx-auto w-full max-w-3xl p-4 pb-30">
            {/* Greeting message for welcome page when no messages */}
            {!isThread && renderedMessages.length === 0 && (
              <div className="flex items-center justify-center min-h-[70vh]">
                <div className="text-center max-w-2xl">
                  <div className="relative">
                    <motion.h1
                      className="text-4xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center"
                      layout
                    >
                      Hola,
                      {user && (user.firstName || user.lastName) && (
                        <div className="relative inline-block ml-2">
                          <motion.span
                            className="font-semibold animate-subtle-shine relative inline-block"
                            initial={{
                              opacity: 0,
                              x: -15,
                              scale: 0.95,
                              width: 0,
                            }}
                            animate={{
                              opacity: 1,
                              x: 0,
                              scale: 1,
                              width: "auto",
                            }}
                            transition={{
                              duration: 1.2,
                              ease: [0.16, 1, 0.3, 1],
                              opacity: {
                                duration: 1.2,
                                ease: [0.16, 1, 0.3, 1],
                              },
                              x: {
                                duration: 1.2,
                                ease: [0.16, 1, 0.3, 1],
                              },
                              scale: {
                                duration: 1.2,
                                ease: [0.16, 1, 0.3, 1],
                              },
                              width: {
                                duration: 1.2,
                                ease: [0.16, 1, 0.3, 1],
                              },
                            }}
                            style={{
                              overflow: "visible",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {user.firstName || user.lastName}
                          </motion.span>
                          <motion.div
                            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2"
                            initial={{
                              opacity: 0,
                              scale: 0.8,
                              y: -5,
                            }}
                            animate={{
                              opacity: 1,
                              scale: 1,
                              y: 0,
                            }}
                            transition={{
                              duration: 1.5,
                              delay: 1.0,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                          >
                            <DoddleLine className="w-38 h-20 text-blue-600 dark:text-blue-400" />
                          </motion.div>
                        </div>
                      )}
                    </motion.h1>
                  </div>
                  <h2 className="text-3xl text-gray-600 dark:text-gray-400 font-normal mb-8">
                    ¿Qué quieres hacer hoy?
                  </h2>

                  {/* Prompt suggestions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    {[
                      {
                        icon: (
                          <StudentIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        ),
                        title: "Técnicas de estudio",
                        prompt:
                          "¿Cómo puedo mejorar mi memoria para recordar mejor?",
                      },
                      {
                        icon: (
                          <IdeaIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                        ),
                        title: "Habilidades de escritura",
                        prompt:
                          "Enséñame a estructurar mejor mis ideas al escribir",
                      },
                      {
                        icon: (
                          <BrainPersonIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        ),
                        title: "Pensamiento crítico",
                        prompt:
                          "¿Cómo puedo analizar mejor la información que leo?",
                      },
                      {
                        icon: (
                          <DeskIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                        ),
                        title: "Organización personal",
                        prompt: "Ayúdame a crear un plan de estudio efectivo",
                      },
                      {
                        icon: (
                          <LampIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        ),
                        title: "Resolución creativa",
                        prompt:
                          "¿Cómo puedo desarrollar mi creatividad para proyectos?",
                      },
                      {
                        icon: (
                          <GrowthIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        ),
                        title: "Crecimiento personal",
                        prompt:
                          "¿Qué hábitos me ayudan a ser un mejor estudiante?",
                      },
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="bg-white/50 dark:bg-gray-800/50 rounded-3xl p-4 border border-gray-200 dark:border-gray-700 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors shadow-container-small cursor-pointer"
                      >
                        <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                          {item.icon} {item.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.prompt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
                              isStreaming={
                                status === "streaming" &&
                                message.id === messages[messages.length - 1]?.id
                              }
                              defaultOpen={false}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>
                                <div className="space-y-2">
                                  {reasoningParts.map((part, i) => (
                                    <div
                                      key={i}
                                      className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"
                                    >
                                      {(part as { text: string }).text}
                                    </div>
                                  ))}
                                </div>
                              </ReasoningContent>
                            </Reasoning>
                          )}

                          {/* Render non-reasoning parts */}
                          {nonReasoningParts.map((part, i: number) => {
                            if (part.type === "text" && "text" in part) {
                              {/* Edit mode disabled for now
                              // Check if this message is being edited
                              if (
                                message.role === "user" &&
                                isEditing(message.id)
                              ) {
                                return (
                                  <div
                                    key={`${message.id}-${i}`}
                                    className="space-y-3"
                                  >
                                    <PromptInputTextarea
                                      ref={editTextareaRef}
                                      value={editText}
                                      onChange={(e) =>
                                        updateEditText(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                          cancelEditing();
                                        } else if (
                                          e.key === "Enter" &&
                                          (e.ctrlKey || e.metaKey)
                                        ) {
                                          e.preventDefault();
                                          saveEdit(message.id);
                                        }
                                      }}
                                      className="w-full min-h-0 max-h-[200px] resize-none px-1"
                                      placeholder="Edit your message..."
                                      autoFocus
                                    />
                                    <PromptInputToolbar>
                                      <div className="flex items-center gap-2 w-[60dvw] justify-end">
                                        <PromptInputButton
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={cancelEditing}
                                          title="Cancel (Escape)"
                                        >
                                          <XIcon className="size-4" />
                                        </PromptInputButton>
                                        <PromptInputSubmit
                                          type="button"
                                          variant="default"
                                          size="icon"
                                          onClick={() => saveEdit(message.id)}
                                          disabled={
                                            !editText.trim() || isLoading
                                          }
                                          title="Save (Ctrl+Enter)"
                                        >
                                          {isLoading ? (
                                            <LoadingIcon className="size-4 animate-spin" />
                                          ) : (
                                            <CheckIcon className="size-4" />
                                          )}
                                        </PromptInputSubmit>
                                      </div>
                                    </PromptInputToolbar>
                                  </div>
                                );
                              }
                              */}

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
                        onClick={() => regenerateAssistantMessage(message.id)}
                        label="Retry"
                        tooltip="Regenerate response"
                      >
                        <RedoIcon className="size-4" />
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
                        <BranchIcon className="size-4" />
                      </Action>
                    </Actions>
                  </div>
                )}
                {/* Actions for user messages */}
                {message.role === "user" && (
                  <div className="px-0">
                    <Actions className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <Action
                        onClick={() => regenerateAfterUserMessage(message.id)}
                        label="Retry"
                        tooltip="Retry message"
                      >
                        <RedoIcon className="size-4" />
                      </Action>
                      {/* Edit button disabled for now
                      <Action
                        onClick={() => startEditing(message.id)}
                        disabled={
                          status === "streaming" || status === "submitted"
                        }
                        label="Edit"
                        tooltip={
                          status === "streaming" || status === "submitted"
                            ? "Cannot edit while AI is responding"
                            : "Edit message"
                        }
                      >
                        <EditIcon className="size-4" />
                      </Action>
                      */}
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
                        <BranchIcon className="size-4" />
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
      </div>

      {/* Prompt input overlayed at bottom of the main area (not part of scroll flow) */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="mx-auto w-full max-w-3xl px-2">
          {/* Quota Error Message */}
          {quotaError && (
            <div className="mb-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg text-red-800 dark:text-red-200 text-sm shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-red-600 dark:text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="font-semibold">
                    {quotaError.type === "premium" ? "Premium" : "Standard"}{" "}
                    quota exceeded
                  </div>
                </div>
                <button
                  onClick={() => setQuotaError(null)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                  aria-label="Close"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              <div className="text-red-700 dark:text-red-300">
                {quotaError.type === "premium" ? "Premium" : "Standard"}:{" "}
                {quotaError.limit > 0
                  ? `${quotaError.currentUsage}/${quotaError.limit} mensajes`
                  : "Límite alcanzado"}
                <br />
                {quotaError.type === "premium" ? "Standard" : "Premium"}:{" "}
                {quotaError.otherTypeLimit > 0
                  ? `${quotaError.otherTypeUsage}/${quotaError.otherTypeLimit} mensajes`
                  : "Cambiar a otros modelos"}
              </div>
            </div>
          )}
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              onChange={handleInputChange}
              value={input}
              disabled={disableInput}
              placeholder="Escribe tu mensaje..."
            />
            <PromptInputToolbar>
              <PromptInputTools>
                <PromptInputButton
                  onClick={handleAttachClick}
                  aria-label="Add attachments"
                  disabled={disableInput}
                >
                  <AttachmentsIcon className="size-4" />
                </PromptInputButton>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PromptInputButton
                        onClick={handleSearchToggle}
                        aria-label="Toggle web search"
                        disabled={disableInput}
                        variant={isSearchEnabled ? "default" : "ghost"}
                        className={
                          isSearchEnabled
                            ? "bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
                            : ""
                        }
                      >
                        <GlobeIcon className="size-4" />
                      </PromptInputButton>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center">
                      <p>
                        {isSearchEnabled ? "Desactivar" : "Activar"} búsqueda
                        web
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Buscar en la web información actual
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <ModelSelector
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                />
              </PromptInputTools>
              <PromptInputSubmit
                disabled={disableInput}
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
