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
import { useConvexAuth, usePaginatedQuery, useMutation, useQuery } from "convex/react";
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

// Effect services and error types
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

// Internal component that uses the store
function ChatInterfaceInternal({
  id,
  initialMessages,
  hasMoreMessages = false,
  disableInput = false,
  onInitialMessage,
  customInstructionId: initialCustomInstructionId,
}: ChatInterfaceProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Stick-to-bottom hook for auto-scrolling
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

  // Avoid subscribing to fast-changing slices to prevent keystroke re-renders
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

  // Centralized file processing for drag-and-drop uploads
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

  // Apply model change effects
  const prevModelRef = useRef(selectedModel);
  // Ref to track current model for access in closures (like useChat transport)
  const currentModelRef = useRef(selectedModel);
  
  useEffect(() => {
    // Keep ref updated
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

  // State to enable client-side pagination when user clicks "Load More"
  const [enableClientPagination, setEnableClientPagination] = useState(false);

  // Always fetch from Convex for threads to get fresh data
  // Even when cache provides initialMessages, Convex runs in background for updates
  const shouldFetchHistoryFromConvex = isThread;

  // Paginated query for historical messages (skipped when offline and cache exists)
  const { 
    results: paginatedMessages, 
    status: paginationStatus, 
    loadMore 
  } = usePaginatedQuery(
    api.threads.getThreadMessagesPaginatedSafe,
    // If initialMessages is undefined OR an empty array, fetch from client.
    shouldFetchHistoryFromConvex ? { threadId: id } : "skip",
    { initialNumItems: 20 }
  );

  // Transform paginated messages to UIMessage format
  const historicalMessagesFromServer: UIMessage[] = useMemo(() => {
    if (!paginatedMessages || !isThread) return [];
    
    // Reverse order since query returns desc (newest first), we want oldest first for display
    return paginatedMessages.reverse().map((m: any) => ({
      id: m.messageId,
      role: m.role,
      parts: [
        ...(m.reasoning ? [{ type: "reasoning", text: m.reasoning }] : []),
        ...(m.content ? [{ type: "text", text: m.content }] : []),
        ...(m.attachments ? m.attachments.map((att: any) => ({
          type: "file" as const,
          mediaType: att.mimeType,
          url: att.attachmentUrl,
          attachmentId: att.attachmentId,
          attachmentType: att.attachmentType,
        })) : []),
        ...(m.sources ? m.sources.map((source: any) => ({
          type: "source-url" as const,
          sourceId: source.sourceId,
          url: source.url,
          title: source.title,
        })) : []),
      ],
    }));
  }, [paginatedMessages, isThread]);

  // Combine historical messages from server with initialMessages (from cache)
  const historicalMessages: UIMessage[] = useMemo(() => {
    if (!isThread) return [];

    const cacheCount = initialMessages?.length ?? 0;
    const serverCount = historicalMessagesFromServer.length;

    // If we have cache data, only switch to server data if it has at least as many messages
    // This prevents jarring visual changes when server returns fewer messages (e.g., pagination)
    if (cacheCount > 0) {
      if (serverCount >= cacheCount) {
        // Server has same or more messages, use server data
        return historicalMessagesFromServer;
      }
      // Server has fewer messages, keep using cache to avoid content disappearing
      return initialMessages!;
    }

    // No cache, use server data if available
    if (serverCount > 0) {
      return historicalMessagesFromServer;
    }

    return [];
  }, [isThread, historicalMessagesFromServer, initialMessages]);

  // Access chat state instance early so we can seed useChat with last throttled messages
  const chatStateInstance = useChatStateInstance();

  // Force useChat to re-initialize when model changes, but seed with last known messages
  const chatHelpers =
    useChat({
      id: `${id}-${chatKey}`,
      generateId: generateUUID,
      // Seed chat hook with last throttled messages from Zustand if available,
      // otherwise fall back to SSR initial messages when present.
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

        // Parse server error
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

          // Clear quota error and dialog for other errors
          setQuotaError(null);
          setShowNoSubscriptionDialog(false);

          // Show error toast if appropriate
          if (shouldShowErrorToast(parsedError)) {
            triggerError(getErrorMessage(parsedError));
          }
        });

        Effect.runPromise(handleError).catch((e) => {
          // Fallback error handling
          console.error("Error parsing failed:", e);
          triggerError("An error occurred. Please try again.");
        });
      },
      transport: new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, trigger, messageId }) => {
          // Get current tools state at the time of sending
          const currentModel = currentModelRef.current;
          const currentDefaultTools = getDefaultTools(currentModel);
          const currentSearchState =
            typeof window !== "undefined"
              ? localStorage.getItem("webSearchEnabled") === "true"
              : false;
          const currentEnabledTools = currentSearchState
            ? [...currentDefaultTools, "web_search" as ToolType]
            : currentDefaultTools;

          // Build request context
          const baseBeforePrune =
            initialMessages && initialMessages.length > 0
              ? initialMessages
              : historicalMessages;

          // For regeneration, we prune at the anchor.
          // For normal messages, we rely on the pivot logic relative to the hook messages.
          const anchor = trigger === "regenerate-message" ? regenerateAnchorRef.current : null;
          const base = anchor ? pruneAt(baseBeforePrune, anchor.id, anchor.role) : baseBeforePrune;
          
          // If regenerating, also prune the hook messages at the anchor point
          const hookMessages = anchor ? pruneAt(messages, anchor.id, anchor.role) : messages;

          // Apply Pivot Logic to merge base and hookMessages
          let requestMessages: UIMessage[] = [];
          const pivotIndexInLocal = hookMessages.findIndex((localMsg: UIMessage) =>
            base.some((baseMsg: UIMessage) => baseMsg.id === localMsg.id)
          );

          if (pivotIndexInLocal !== -1) {
            const pivotId = hookMessages[pivotIndexInLocal].id;
            const pivotIndexInBase = base.findIndex((baseMsg: UIMessage) => baseMsg.id === pivotId);

            if (pivotIndexInBase !== -1) {
              requestMessages = [...base.slice(0, pivotIndexInBase), ...hookMessages];
            } else {
               // Fallback
               const usedIds = new Set(hookMessages.map((m: UIMessage) => m.id));
               requestMessages = [...base.filter((m: UIMessage) => !usedIds.has(m.id)), ...hookMessages];
            }
          } else {
            const usedIds = new Set(hookMessages.map((m: UIMessage) => m.id));
            requestMessages = [...base.filter((m: UIMessage) => !usedIds.has(m.id)), ...hookMessages];
          }

          // Get current customInstructionId from store
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

  // Sync AI SDK messages to Zustand store for optimized rendering
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

  // Merge historical messages with AI SDK streaming messages (overlay stream onto base by id)
  const renderedMessages: UIMessage[] = useMemo(() => {
    if (!isThread) {
      if (messages.length > 0) return messages;
      if (initialMessages && initialMessages.length > 0) return initialMessages;
      return [];
    }

    const base =
      initialMessages && initialMessages.length > 0
        ? initialMessages
        : historicalMessages;

    const pivotIndexInLocal = messages.findIndex((localMsg: UIMessage) =>
      base.some((baseMsg: UIMessage) => baseMsg.id === localMsg.id)
    );

    if (pivotIndexInLocal !== -1) {
      const pivotId = messages[pivotIndexInLocal].id;
      const pivotIndexInBase = base.findIndex((baseMsg: UIMessage) => baseMsg.id === pivotId);

      if (pivotIndexInBase !== -1) {
        // Take history up to pivot, then append local messages (which includes the pivot and everything after)
        const merged = [...base.slice(0, pivotIndexInBase), ...messages];
        return merged;
      }
    }

    // Fallback: If no overlapping pivot found, assume local messages are new/appended
    // Filter duplicates just in case, but rely on base + local structure
    const usedIds = new Set(messages.map((m: UIMessage) => m.id));
    const merged = [
      ...base.filter((m: any) => !usedIds.has(m.id)),
      ...messages,
    ];
    return merged;
  }, [isThread, historicalMessages, messages, initialMessages]);

  // Preserve last non-empty render while pagination is loading to prevent flicker on model change
  const lastNonEmptyRenderRef = useRef<UIMessage[]>([]);
  useEffect(() => {
    if (renderedMessages.length > 0) {
      lastNonEmptyRenderRef.current = renderedMessages;
    }
  }, [renderedMessages]);

  const displayMessages: UIMessage[] = useMemo(() => {
    const loadingHistory = paginationStatus === "LoadingFirstPage" || paginationStatus === "LoadingMore";
    if (renderedMessages.length === 0 && isThread && loadingHistory) {
      return lastNonEmptyRenderRef.current;
    }
    return renderedMessages;
  }, [renderedMessages, isThread, paginationStatus]);

  // Track if all AI responses are ready to prevent layout shift
  // Count expected assistant responses with text parts
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

  // Reset ready count when thread changes
  useEffect(() => {
    setReadyResponseCount(0);
    readyResponseIdsRef.current.clear();
  }, [id]);

  // Handler for when a response finishes rendering
  const handleResponseReady = useCallback((messageId: string) => {
    if (!readyResponseIdsRef.current.has(messageId)) {
      readyResponseIdsRef.current.add(messageId);
      setReadyResponseCount((prev) => prev + 1);
    }
  }, []);

  // Check if all responses are ready
  const allResponsesReady = useMemo(() => {
    // During streaming, always show
    if (status === "streaming" || status === "submitted") return true;
    // No responses expected, show immediately
    if (expectedResponseCount === 0) return true;
    // Check if all expected responses are ready
    return readyResponseCount >= expectedResponseCount;
  }, [status, expectedResponseCount, readyResponseCount]);

  // Fallback timeout - show content after 300ms even if responses aren't ready
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

  // Reset forceShow when thread changes
  useEffect(() => {
    setForceShow(false);
  }, [id]);

  const shouldShowMessages = allResponsesReady || forceShow || status === "streaming" || status === "submitted";

  // Initial scroll to bottom when thread loads (instant, no animation)
  // Wait until messages are ready to show before scrolling
  const hasInitialScrolledRef = useRef(false);
  const initialScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useLayoutEffect(() => {
    // Only scroll once messages are ready to be shown and we haven't scrolled yet
    if (shouldShowMessages && displayMessages.length > 0 && !hasInitialScrolledRef.current) {
      scrollToBottom("instant");
      hasInitialScrolledRef.current = true;
      
      // Delay marking initial scroll done to allow late-rendering content
      // (like Streamdown markdown) to also benefit from instant scroll
      // The ResizeObserver will catch content growth and use instant scroll
      // until this timeout fires, then switch to smooth scroll
      if (initialScrollTimeoutRef.current) {
        clearTimeout(initialScrollTimeoutRef.current);
      }
      initialScrollTimeoutRef.current = setTimeout(() => {
        markInitialScrollDone();
      }, 150); // Small delay for heavy components to render
    }
  }, [shouldShowMessages, displayMessages.length, scrollToBottom, markInitialScrollDone]);

  // Reset scroll state when thread changes
  useEffect(() => {
    hasInitialScrolledRef.current = false;
    if (initialScrollTimeoutRef.current) {
      clearTimeout(initialScrollTimeoutRef.current);
      initialScrollTimeoutRef.current = null;
    }
    resetStickToBottom();
  }, [id, resetStickToBottom]);

  // Persist conversation locally for instant/offline loading.
  // We avoid saving while actively streaming to keep writes low and store stable history.
  useEffect(() => {
    if (!isThread) return;
    if (!displayMessages || displayMessages.length === 0) return;
    if (status === "streaming") return;

    const handle = setTimeout(() => {
      void saveCachedThreadMessages(id, displayMessages);
    }, 750);

    return () => clearTimeout(handle);
  }, [id, isThread, displayMessages, status]);

  // Cleanup effect when thread ID changes - reset all UI state
  useEffect(() => {
    if (prevIdRef.current !== id) {
      // Clear all input and file state
      setInput("");
      setSelectedFiles([]);
      setUploadedAttachments([]);
      setUploadingFiles([]);
      setIsUploading(false);
      setIsSendingMessage(false);
      
      // Clear error states
      setQuotaError(null);
      setShowNoSubscriptionDialog(false);

      // Update previous ID reference
      prevIdRef.current = id;
    }
  }, [id, setInput, setSelectedFiles, setUploadedAttachments, setUploadingFiles, setIsUploading, setIsSendingMessage, setQuotaError, setShowNoSubscriptionDialog]);

  // Bind handlers from the hook to current renderedMessages
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

  // Store sendMessage in ref to prevent useEffect from re-running
  const sendMessageRef = useRef<((message: UIMessage) => Promise<void>) | null>(null);
  sendMessageRef.current = sendMessage;


  const hasAssistantMessage = useMemo(
    () => renderedMessages.some((m) => m.role === "assistant"),
    [renderedMessages],
  );

  // Auto-start with initial message from context (preserve existing behavior)
  useEffect(() => {
    if (isThread && isAuthenticated && !autoStartTriggeredRef.current) {
      const initialMessage = consumeInitialMessage(id);
      if (initialMessage) {
        autoStartTriggeredRef.current = true;
        sendMessageRef.current?.(initialMessage);
      }
    }
  }, [id, isThread, isAuthenticated, consumeInitialMessage, sendMessageRef]);

  // Set custom instruction from prop
  useEffect(() => {
    if (isThread) {
      setCustomInstructionId(initialCustomInstructionId);
    } else {
      // Reset only for welcome page
      setCustomInstructionId(undefined);
    }
  }, [isThread, initialCustomInstructionId, setCustomInstructionId]);

  // Cleanup effect when thread ID changes
  useEffect(() => {
    if (prevIdRef.current !== id) {
      autoStartTriggeredRef.current = false;
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

      // Reset regeneration pruning state for normal submissions so new messages are included
      try {
        if (regenerateAnchorRef.current) {
          regenerateAnchorRef.current = null;
        }
      } catch {}

      // Clear any existing quota error when user tries to send a new message
      setQuotaError(null);
      setInput("");

      // Set sending state but keep attachments until we know the send succeeded
      setIsSendingMessage(true);

      // Snapshot attachments for this send attempt
      const currentAttachments = [...uploadedAttachments];

      // Build message parts using captured attachments
      const parts: any[] = [];

      if (messageContent) {
        parts.push({ type: "text", text: messageContent });
      }

      // Use captured uploaded attachments
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
    // Abort the request
    stop();
    
    // Manually force status to 'ready' since AI SDK doesn't properly update on abort
    chatStateInstance.getState().setStatus('ready');
    setIsSendingMessage(false);
  }, [stop, chatStateInstance, setIsSendingMessage]);

  const handleSuggestionClick = useCallback((prompt: string) => {
    setInput(prompt);
  }, [setInput]);

  // Handle loading more messages with scroll position preservation
  const handleLoadMore = useCallback(() => {
    // If we're using server data and haven't enabled client pagination yet, enable it first
    if (initialMessages && !enableClientPagination) {
      setEnableClientPagination(true);
      return;
    }
    
    if (paginationStatus === "CanLoadMore") {
      const scrollContainer = document.querySelector('[role="log"]');
      const oldScrollHeight = scrollContainer?.scrollHeight || 0;
      
      loadMore(5);
      
      // Preserve scroll position after loading
      setTimeout(() => {
        if (scrollContainer) {
          const newScrollHeight = scrollContainer.scrollHeight;
          scrollContainer.scrollTop += (newScrollHeight - oldScrollHeight);
        }
      }, 100);
    }
  }, [paginationStatus, loadMore, initialMessages, enableClientPagination]);

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
            {/* Load More button for threads */}
            {isThread && (paginationStatus === "CanLoadMore" || (initialMessages && hasMoreMessages && !enableClientPagination)) && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={handleLoadMore}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors"
                >
                  Load older messages
                </button>
              </div>
            )}
            
            {/* Greeting message for welcome page when no messages */}
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
          
          {/* Scroll to bottom button - shown when user scrolls up */}
          {!isAtBottom && displayMessages.length > 0 && (
            <button
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-36 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 bg-background/90 backdrop-blur-sm border border-border rounded-full shadow-lg hover:bg-accent transition-all duration-200"
              aria-label="Scroll to bottom"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
              <span className="text-sm font-medium">New messages</span>
            </button>
          )}
        </Conversation>
      </div>

      {/* Prompt input overlayed at bottom of the main area */}
      <ChatInputArea
        disableInput={promptDisabled}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onSubmit={handleSubmit}
        onStop={handleStop}
        threadId={isThread ? id : undefined}
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

// Wrapper component that provides the store
export default function ChatInterface(props: ChatInterfaceProps) {
  return (
    <ChatStoreProvider initialMessages={props.initialMessages || []}>
      <ChatInterfaceInternal {...props} />
    </ChatStoreProvider>
  );
}