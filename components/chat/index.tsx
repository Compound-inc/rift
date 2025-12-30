"use client";

import { useChat, type UIMessage } from "@ai-sdk-tools/store";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { generateUUID } from "@/lib/utils";
import { useModel } from "@/contexts/model-context";
import { useInitialMessage } from "@/contexts/initial-message-context";
import { useCallback, useEffect, useRef, useMemo, useState, useLayoutEffect } from "react";
import { useRegeneration } from "./hooks/use-regeneration";
import { ToolType, getDefaultTools } from "@/lib/ai/model-tools";
import { resolveModel } from "@/lib/ai/ai-providers";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader } from "@/components/ai/loader";
import { AttachmentsIcon } from "@/components/ui/icons/svg-icons";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai/conversation";
import { Message, MessageContent } from "@/components/ai/message";

import { useChatUIStore } from "./ui-store";
import { WelcomeScreen } from "./components/welcome-screen";
import { MessageRenderer } from "./components/message-renderer";
import { ChatInputArea } from "./components/chat-input-area";
import type { ChatInterfaceProps } from "./types";
import { ChatStoreProvider, useChatStateInstance } from "@/lib/stores/hooks";
import { Effect } from "effect";
import { saveCachedThreadMessages } from "@/lib/local-first/thread-messages-cache";
import { useStickToBottom } from "@/lib/hooks/use-stick-to-bottom";

import {
  updateMessageContentEffect,
  parseServerError,
  isQuotaError,
  isNoSubscriptionError,
  isAbortError,
  shouldShowErrorToast,
  submitMessageEffect,
} from "./services";
import { uploadWithStateEffect } from "./services/upload-service";
import { getErrorMessage } from "./errors";

function ChatInterfaceInternal({
  id,
  initialMessages,
  serverMessages,
  hasMoreMessages = false,
  disableInput = false,
  onInitialMessage,
  customInstructionId: initialCustomInstructionId,
}: ChatInterfaceProps) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    scrollRef,
    contentRef,
    isAtBottom,
    scrollToBottom,
    markInitialScrollDone,
    reset: resetStickToBottom,
  } = useStickToBottom();

  const { selectedModel, setSelectedModel } = useModel();
  const { consumeInitialMessage } = useInitialMessage();
  const { isAuthenticated } = useConvexAuth();
  const promptDisabled = disableInput;
  const { user } = useAuth();
  const prevIdRef = useRef(id);
  const autoStartTriggeredRef = useRef(false);
  const hadActiveSessionRef = useRef(false);

  const chatKey = useChatUIStore((s) => s.chatKey);
  const setInput = useChatUIStore((s) => s.setInput);
  const setSelectedFiles = useChatUIStore((s) => s.setSelectedFiles);
  const setUploadedAttachments = useChatUIStore((s) => s.setUploadedAttachments);
  const setIsUploading = useChatUIStore((s) => s.setIsUploading);
  const setUploadingFiles = useChatUIStore((s) => s.setUploadingFiles);
  const setIsSendingMessage = useChatUIStore((s) => s.setIsSendingMessage);
  const setIsSearchEnabled = useChatUIStore((s) => s.setIsSearchEnabled);
  const setQuotaError = useChatUIStore((s) => s.setQuotaError);
  const setShowNoSubscriptionDialog = useChatUIStore((s) => s.setShowNoSubscriptionDialog);
  const triggerError = useChatUIStore((s) => s.triggerError);
  const setChatError = useChatUIStore((s) => s.setChatError);
  const customInstructionId = useChatUIStore((s) => s.customInstructionId);
  const setCustomInstructionId = useChatUIStore((s) => s.setCustomInstructionId);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounterRef = useRef(0);

  const handleProcessFiles = useCallback(
    async (fileArray: File[]) => {
      if (!fileArray || fileArray.length === 0) return;

      await Effect.runPromise(
        uploadWithStateEffect(fileArray, {
          getState: useChatUIStore.getState,
          setSelectedFiles,
          setUploadingFiles,
          setUploadedAttachments,
          setChatError,
          triggerError,
        }),
      );
    },
    [setSelectedFiles, setUploadingFiles, setUploadedAttachments, setChatError, triggerError]
  );

  const prevModelRef = useRef(selectedModel);
  const currentModelRef = useRef(selectedModel);
  
  // Ref to track latest server messages for use in closures (avoids stale closure issue)
  const historicalMessagesRef = useRef<UIMessage[]>([]);
  
  useEffect(() => {
    currentModelRef.current = selectedModel;
    if (prevModelRef.current !== selectedModel) {
      prevModelRef.current = selectedModel;
      setQuotaError(null);
      setShowNoSubscriptionDialog(false);
    }
  }, [selectedModel, setQuotaError, setShowNoSubscriptionDialog]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSearchState = localStorage.getItem("webSearchEnabled");
      const searchEnabled = savedSearchState === "true";
      setIsSearchEnabled(searchEnabled);
    }
  }, [selectedModel, setIsSearchEnabled]);

  const isThread = id !== "welcome";

  // Server messages come from CachedChatWrapper's one-off fetch (no subscription needed)
  const historicalMessagesFromServer = serverMessages ?? [];

  // Prefer cache until server has loaded
  const historicalMessages: UIMessage[] = useMemo(() => {
    if (!isThread) return [];
    if (historicalMessagesFromServer.length > 0) {
      return historicalMessagesFromServer;
    }
    return initialMessages ?? [];
  }, [isThread, historicalMessagesFromServer, initialMessages]);

  // Keep ref in sync for use in closures (prepareSendMessagesRequest)
  useEffect(() => {
    // Prefer server data, fall back to cache
    historicalMessagesRef.current = historicalMessagesFromServer.length > 0 
      ? historicalMessagesFromServer 
      : (initialMessages ?? []);
  }, [historicalMessagesFromServer, initialMessages]);

  const chatStateInstance = useChatStateInstance();

  const chatHelpers =
    useChat({
      id: `${id}-${chatKey}`,
      generateId: generateUUID,
      ...((() => {
        try {
          const state = chatStateInstance.getState();
          const throttled = state.getThrottledMessages?.() || state.messages || [];
          if (Array.isArray(throttled) && throttled.length > 0) {
            return { messages: throttled as UIMessage[] };
          }
        } catch {}
        if (isThread && initialMessages && initialMessages.length > 0) {
          return { messages: initialMessages };
        }
        return {};
      })()),
      onFinish() {
        if (pathname === "/") {
          router.push(`/chat/${id}`);
          router.refresh();
        }
      },
      onError(error: Error) {
        console.error("Chat error:", error);
        const handleError = Effect.gen(function* () {
          const parsedError = yield* parseServerError(error);

          // Handle based on error type
          if (isNoSubscriptionError(parsedError)) {
            setShowNoSubscriptionDialog(true);
            setQuotaError(null);
            return;
          }

          if (isQuotaError(parsedError)) {
            setQuotaError({
              type: parsedError.quotaType,
              message: parsedError.message,
              currentUsage: parsedError.currentUsage,
              limit: parsedError.limit,
              otherTypeUsage: parsedError.otherTypeUsage,
              otherTypeLimit: parsedError.otherTypeLimit,
            });
            setShowNoSubscriptionDialog(false);
            return;
          }

          if (isAbortError(parsedError)) {
            // Don't show error for user-cancelled operations
            return;
          }

          setQuotaError(null);
          setShowNoSubscriptionDialog(false);
          if (shouldShowErrorToast(parsedError)) {
            triggerError(getErrorMessage(parsedError));
          }
        });

        Effect.runPromise(handleError).catch((e) => {
          console.error("Error parsing failed:", e);
          triggerError("An error occurred. Please try again.");
        });
      },
      transport: new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, trigger, messageId }) => {
          const currentModel = currentModelRef.current;
          const currentDefaultTools = getDefaultTools(currentModel);
          const currentSearchState =
            typeof window !== "undefined"
              ? localStorage.getItem("webSearchEnabled") === "true"
              : false;
          const currentEnabledTools = currentSearchState
            ? [...currentDefaultTools, "web_search" as ToolType]
            : currentDefaultTools;

          // Use ref to get latest server data (avoids stale closure issue)
          const serverData = historicalMessagesRef.current;

          const anchor = trigger === "regenerate-message" ? regenerateAnchorRef.current : null;
          const base = anchor ? pruneAt(serverData, anchor.id, anchor.role) : serverData;
          const hookMessages = anchor ? pruneAt(messages, anchor.id, anchor.role) : messages;

          // Use server versions for existing messages, hook only for new messages
          const serverIds = new Set(base.map((m: UIMessage) => m.id));
          const newMessagesFromHook = hookMessages.filter((m: UIMessage) => !serverIds.has(m.id));
          const requestMessages = [...base, ...newMessagesFromHook];

          const currentCustomInstructionId = useChatUIStore.getState().customInstructionId;

          return {
            body: {
              messages: requestMessages,
              modelId: resolveModel(currentModel),
              threadId: id,
              enabledTools: currentEnabledTools,
              customInstructionId: currentCustomInstructionId,
              trigger,
              messageId,
            },
          };
        },
      }),
    });

  const { messages, status, setMessages, sendMessage, stop } = chatHelpers as any;
  const regenerateRef = useRef<null | ((opts?: { messageId?: string }) => Promise<void>)>(null);
  regenerateRef.current = (chatHelpers as any).regenerate ?? null;

  useEffect(() => {
    chatStateInstance.syncFromAISDK(messages, status === 'streaming' ? 'streaming' : 'ready');
  }, [messages, status, chatStateInstance]);

    const {
    regenerateAnchorRef,
    pruneAt,
    handleRegenerateAssistant,
    handleRegenerateAfterUser,
    handleEditUserMessage,
  } = useRegeneration({
    setMessages,
    status,
    stop,
    regenerate: async ({ messageId }: { messageId: string }) => {
      if (regenerateRef.current) {
        await regenerateRef.current({ messageId });
      }
    },
    onError: (error) => {
      // Extract error message from cause if available
      const causeMessage = error.cause instanceof Error 
        ? error.cause.message 
        : typeof error.cause === "string" 
          ? error.cause 
          : null;
      
      const displayMessage = causeMessage || error.message;
      
      if (error._tag === "RegenerationError") {
        triggerError(`Failed to regenerate: ${displayMessage}`);
      } else if (error._tag === "EditError") {
        triggerError(`Failed to edit: ${displayMessage}`);
      }
    },
  });

  const updateUserMessageContent = useMutation(api.threads.updateUserMessageContent);

  // Track if user has had active interaction (streaming/sending) in this session
  // This helps distinguish between stale cached messages vs live session messages
  const isActivelyGenerating = status === "streaming" || status === "submitted";
  if (isActivelyGenerating) {
    hadActiveSessionRef.current = true;
  }

  const renderedMessages: UIMessage[] = useMemo(() => {
    if (!isThread) {
      if (messages.length > 0) return messages;
      if (initialMessages && initialMessages.length > 0) return initialMessages;
      return [];
    }

    // During active generation, use server for history + hook for new/streaming messages
    if (isActivelyGenerating && messages.length > 0) {
      if (historicalMessagesFromServer.length > 0) {
        // Use server versions for existing messages, hook only for new messages (includes streaming)
        const serverIds = new Set(historicalMessagesFromServer.map((m: UIMessage) => m.id));
        const newMessagesFromHook = messages.filter((m: UIMessage) => !serverIds.has(m.id));
        return [...historicalMessagesFromServer, ...newMessagesFromHook];
      }
      return messages;
    }

    // After active session (user sent message/received stream), merge server + new hook messages
    if (hadActiveSessionRef.current && messages.length > 0) {
      if (historicalMessagesFromServer.length > 0) {
        // Use server versions for existing messages (source of truth)
        // Only use hook for NEW messages not in server (user's new message, AI response)
        const serverIds = new Set(historicalMessagesFromServer.map((m: UIMessage) => m.id));
        const newMessagesFromHook = messages.filter((m: UIMessage) => !serverIds.has(m.id));
        return [...historicalMessagesFromServer, ...newMessagesFromHook];
      }
      // No server data but we have hook messages - use them (preserves AI response)
      return messages;
    }

    // Fresh navigation (no active session) - prefer server data for fresh content
    if (historicalMessagesFromServer.length > 0) {
      return historicalMessagesFromServer;
    }

    // Server not loaded yet - use cache for instant loading
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }

    return historicalMessages;
  }, [isThread, historicalMessages, historicalMessagesFromServer, messages, initialMessages, isActivelyGenerating]);

  const lastNonEmptyRenderRef = useRef<UIMessage[]>([]);
  useEffect(() => {
    if (renderedMessages.length > 0) {
      lastNonEmptyRenderRef.current = renderedMessages;
    }
  }, [renderedMessages]);

  const displayMessages: UIMessage[] = useMemo(() => {
    // Use last non-empty render if current is empty (prevents flicker during transitions)
    if (renderedMessages.length === 0 && isThread && lastNonEmptyRenderRef.current.length > 0) {
      return lastNonEmptyRenderRef.current;
    }
    return renderedMessages;
  }, [renderedMessages, isThread]);

  // Track expected AI responses for layout shift prevention
  const expectedResponseCount = useMemo(() => {
    if (!isThread || status === "streaming" || status === "submitted") {
      return 0; // Don't wait during streaming
    }
    return displayMessages.filter(
      (m) => m.role === "assistant" && m.parts.some((p) => p.type === "text")
    ).length;
  }, [displayMessages, isThread, status]);

  const [readyResponseCount, setReadyResponseCount] = useState(0);
  const readyResponseIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setReadyResponseCount(0);
    readyResponseIdsRef.current.clear();
  }, [id]);

  const handleResponseReady = useCallback((messageId: string) => {
    if (!readyResponseIdsRef.current.has(messageId)) {
      readyResponseIdsRef.current.add(messageId);
      setReadyResponseCount((prev) => prev + 1);
    }
  }, []);

  const allResponsesReady = useMemo(() => {
    if (status === "streaming" || status === "submitted") return true;
    if (expectedResponseCount === 0) return true;
    return readyResponseCount >= expectedResponseCount;
  }, [status, expectedResponseCount, readyResponseCount]);

  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    if (allResponsesReady || !isThread || displayMessages.length === 0) {
      setForceShow(false);
      return;
    }

    const timeout = setTimeout(() => {
      setForceShow(true);
    }, 300);

    return () => clearTimeout(timeout);
  }, [allResponsesReady, isThread, displayMessages.length, id]);

  useEffect(() => {
    setForceShow(false);
  }, [id]);

  const shouldShowMessages = allResponsesReady || forceShow || status === "streaming" || status === "submitted";

  // Initial scroll to bottom (instant, then switch to smooth after 150ms)
  const hasInitialScrolledRef = useRef(false);
  const initialScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useLayoutEffect(() => {
    if (shouldShowMessages && displayMessages.length > 0 && !hasInitialScrolledRef.current) {
      scrollToBottom("instant");
      hasInitialScrolledRef.current = true;
      if (initialScrollTimeoutRef.current) clearTimeout(initialScrollTimeoutRef.current);
      initialScrollTimeoutRef.current = setTimeout(() => markInitialScrollDone(), 150);
    }
  }, [shouldShowMessages, displayMessages.length, scrollToBottom, markInitialScrollDone]);

  useEffect(() => {
    hasInitialScrolledRef.current = false;
    if (initialScrollTimeoutRef.current) {
      clearTimeout(initialScrollTimeoutRef.current);
      initialScrollTimeoutRef.current = null;
    }
    resetStickToBottom();
  }, [id, resetStickToBottom]);

  // Persist to cache (debounced, skip while streaming)
  useEffect(() => {
    if (!isThread) return;
    if (!displayMessages || displayMessages.length === 0) return;
    if (status === "streaming") return;

    const handle = setTimeout(() => {
      void saveCachedThreadMessages(id, displayMessages);
    }, 750);

    return () => clearTimeout(handle);
  }, [id, isThread, displayMessages, status]);

  useEffect(() => {
    if (prevIdRef.current !== id) {
      setInput("");
      setSelectedFiles([]);
      setUploadedAttachments([]);
      setUploadingFiles([]);
      setIsUploading(false);
      setIsSendingMessage(false);
      setQuotaError(null);
      setShowNoSubscriptionDialog(false);
      prevIdRef.current = id;
    }
  }, [id, setInput, setSelectedFiles, setUploadedAttachments, setUploadingFiles, setIsUploading, setIsSendingMessage, setQuotaError, setShowNoSubscriptionDialog]);

  const onRegenerateAssistant = useCallback(
    (messageId: string) => {
      handleRegenerateAssistant(messageId, renderedMessages);
    },
    [handleRegenerateAssistant, renderedMessages],
  );

  const onRegenerateAfterUser = useCallback(
    (messageId: string) => {
      handleRegenerateAfterUser(messageId, renderedMessages);
    },
    [handleRegenerateAfterUser, renderedMessages],
  );

  const sendMessageRef = useRef<((message: UIMessage) => Promise<void>) | null>(null);
  sendMessageRef.current = sendMessage;


  const hasAssistantMessage = useMemo(
    () => renderedMessages.some((m) => m.role === "assistant"),
    [renderedMessages],
  );

  useEffect(() => {
    if (isThread && isAuthenticated && !autoStartTriggeredRef.current) {
      const initialMessage = consumeInitialMessage(id);
      if (initialMessage) {
        autoStartTriggeredRef.current = true;
        sendMessageRef.current?.(initialMessage);
      }
    }
  }, [id, isThread, isAuthenticated, consumeInitialMessage, sendMessageRef]);

  useEffect(() => {
    if (isThread) {
      setCustomInstructionId(initialCustomInstructionId);
    } else {
      // Reset only for welcome page
      setCustomInstructionId(undefined);
    }
  }, [isThread, initialCustomInstructionId, setCustomInstructionId]);

  useEffect(() => {
    if (prevIdRef.current !== id) {
      autoStartTriggeredRef.current = false;
      hadActiveSessionRef.current = false;
      setMessages([]);
      prevIdRef.current = id;
    }
  }, [id, setMessages]);


  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const state = useChatUIStore.getState();
      const {
        input,
        uploadedAttachments,
        uploadingFiles,
        isSendingMessage,
      } = state;
      const isGenerating =
        status === "streaming" || status === "submitted" || isSendingMessage;

      // Prevent sending when input is disabled, unauthenticated, or while auth is (re)loading
      if (
        promptDisabled ||
        isGenerating ||
        (!input.trim() &&
          uploadedAttachments.length === 0 &&
          uploadingFiles.length === 0)
      ) {
        return;
      }

      const messageContent = input.trim();
      const messageId = generateUUID();

      try { if (regenerateAnchorRef.current) regenerateAnchorRef.current = null; } catch {}

      setQuotaError(null);
      setInput("");
      setIsSendingMessage(true);

      const currentAttachments = [...uploadedAttachments];
      const parts: any[] = [];

      if (messageContent) {
        parts.push({ type: "text", text: messageContent });
      }

      currentAttachments.forEach((attachment) => {
        parts.push({
          type: "file",
          mediaType: attachment.mediaType,
          url: attachment.url,
          attachmentId: attachment.attachmentId,
        });
      });

      const program = submitMessageEffect({
        id,
        messageId,
        parts,
        onInitialMessage,
        sendMessage,
        setMessages,
        triggerError,
        setInput,
        setIsSendingMessage,
      });

      const result = await Effect.runPromise(Effect.either(program));

      if (result._tag === "Right" && result.right) {
        // Only clear attachments after a successful send
        setUploadedAttachments([]);
        setSelectedFiles([]);
        setUploadingFiles([]);
        setIsUploading(false);
        return;
      }

      if (result._tag === "Left") {
        const error = result.left as any;
        if (error?._tag !== "AbortError") {
          triggerError(getErrorMessage(error));
          setInput(messageContent);
          if (id === "welcome") {
            setMessages([]);
          }
        }
      }
    },
    [
      promptDisabled,
      status,
      id,
      onInitialMessage,
      setMessages,
      sendMessage,
      setQuotaError,
      setInput,
      setIsSendingMessage,
      setUploadedAttachments,
      setSelectedFiles,
      setUploadingFiles,
      setIsUploading,
      triggerError,
      regenerateAnchorRef,
    ]
  );

  const handleStop = useCallback(() => {
    stop();
    chatStateInstance.getState().setStatus('ready');
    setIsSendingMessage(false);
  }, [stop, chatStateInstance, setIsSendingMessage]);

  const handleSuggestionClick = useCallback((prompt: string) => {
    setInput(prompt);
  }, [setInput]);


  const handleScrollToBottom = useCallback(() => {
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  return (
    <div
      className="flex h-screen w-full min-h-0 flex-col relative"
      onDragEnter={(e) => {
        const dt = e.dataTransfer;
        const hasFiles = !!dt && Array.from(dt.types || []).includes("Files");
        if (!hasFiles) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        setIsDragActive(true);
      }}
      onDragOver={(e) => {
        const dt = e.dataTransfer;
        const hasFiles = !!dt && Array.from(dt.types || []).includes("Files");
        if (!hasFiles) return;
        e.preventDefault();
        dt.dropEffect = "copy";
        setIsDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (dragCounterRef.current > 0) {
          dragCounterRef.current -= 1;
        }
        if (dragCounterRef.current <= 0) {
          setIsDragActive(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragActive(false);
        const files = Array.from(e.dataTransfer?.files || []);
        if (!files || files.length === 0) return;
        void handleProcessFiles(files);
      }}
    >
      <div className="flex-1 min-h-0">
        <Conversation ref={scrollRef as React.RefObject<HTMLDivElement>}>
          <ConversationContent ref={contentRef as React.RefObject<HTMLDivElement>} className="mx-auto w-full max-w-full md:max-w-3xl p-4 pb-[140px] md:pb-35">
            
            {!isThread && renderedMessages.length === 0 && (
              <WelcomeScreen 
                user={user} 
                onSuggestionClick={handleSuggestionClick}
              />
            )}
            <div
              className={shouldShowMessages ? "" : "opacity-0"}
            >
              {displayMessages.map((message, index) => {
              const isLast = index === displayMessages.length - 1;
              const isStreaming = isLast && (status === "streaming");
              return (
                <MessageRenderer
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming}
                  disableRegenerate={status === "streaming"}
                  onRegenerateAssistantMessage={onRegenerateAssistant}
                  onRegenerateAfterUserMessage={onRegenerateAfterUser}
                  onResponseReady={() => handleResponseReady(message.id)}
                  onEditUserMessage={async (
                    messageId: string,
                    newContent: string
                  ) => {
                    // Edit with retry
                    const program = Effect.gen(function* () {
                      // Persist edit to Convex
                      yield* updateMessageContentEffect({
                        updateFn: (params) => updateUserMessageContent(params),
                        messageId,
                        content: newContent,
                      });

                      // Optimistically update local hook store
                      setMessages((curr: UIMessage[]) =>
                        curr.map((m) =>
                          m.id === messageId
                            ? {
                                ...m,
                                parts: [
                                  ...m.parts.filter(
                                    (p: any) => p.type !== "text"
                                  ),
                                  { type: "text", text: newContent } as any,
                                ],
                              }
                            : m
                        )
                      );

                      // Then trigger regeneration (prune-after-user semantics)
                      handleRegenerateAfterUser(messageId, renderedMessages);
                    }).pipe(
                      Effect.tapError((error) =>
                        Effect.sync(() => {
                          console.error("Edit message failed", error);
                        })
                      ),
                      Effect.catchAll((error) =>
                        Effect.sync(() => {
                          triggerError(getErrorMessage(error));
                        })
                      )
                    );

                    await Effect.runPromise(program);
                  }}
                />
              );
            })}
            </div>
            {(status === "submitted" || status === "streaming") &&
              !hasAssistantMessage && (
                <Message from={"assistant"}>
                  <MessageContent from={"assistant"}>
                    <div className="py-1">
                      <Loader />
                    </div>
                  </MessageContent>
                </Message>
              )}
          </ConversationContent>
        </Conversation>
      </div>

      <ChatInputArea
        disableInput={promptDisabled}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onSubmit={handleSubmit}
        onStop={handleStop}
        threadId={isThread ? id : undefined}
        isAtBottom={isAtBottom}
        onScrollToBottom={handleScrollToBottom}
        showScrollToBottom={!isAtBottom && displayMessages.length > 0}
      />

      {isDragActive && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center pointer-events-none">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-white/20 bg-white/80 dark:bg-popover-main backdrop-blur-sm shadow-xl p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/10">
              <AttachmentsIcon className="h-7 w-7 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Arrastra y suelta archivos</h3>
            <p className="text-sm text-muted-foreground mb-2">Archivos de imagen y PDF hasta 10MB cada uno</p>
            <p className="text-xs text-muted-foreground">Máximo 5 archivos por mensaje</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatInterface(props: ChatInterfaceProps) {
  return (
    <ChatStoreProvider initialMessages={props.initialMessages || []}>
      <ChatInterfaceInternal {...props} />
    </ChatStoreProvider>
  );
}