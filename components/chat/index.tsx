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
import { useConvex, useConvexAuth, useMutation } from "convex/react";
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
import { transformConvexMessages } from "./utils/transformConvexMessages";

const HISTORY_PAGE_SIZE = 20;
const HISTORY_ROOT_MARGIN = "200px 0px 0px 0px";
const AUTOFILL_VIEWPORT_THRESHOLD_PX = 32;
const AUTOFILL_MAX_PAGES_PER_THREAD = 10;

function ChatInterfaceInternal({
  id,
  initialMessages,
  serverMessages,
  initialHistoryCursor,
  initialHistoryIsDone,
  disableInput = false,
  onInitialMessage,
  customInstructionId: initialCustomInstructionId,
}: ChatInterfaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const convex = useConvex();

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
  const activeThreadIdRef = useRef(id);
  useEffect(() => {
    activeThreadIdRef.current = id;
  }, [id]);

  // Server messages come from CachedChatWrapper's one-off fetch (no subscription needed)
  const historicalMessagesFromServer = serverMessages ?? [];

  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const requestInFlightRef = useRef(false);
  const autoFillAttemptsRef = useRef(0);

  const [olderEphemeralMessages, setOlderEphemeralMessages] = useState<UIMessage[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(
    initialHistoryCursor ?? null,
  );
  const [historyIsDone, setHistoryIsDone] = useState<boolean>(
    initialHistoryIsDone ?? true,
  );
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const pendingPrependScrollRef = useRef<null | { scrollTop: number; scrollHeight: number }>(
    null,
  );

  /**
   * If Convex only returns the most recent N messages (e.g. 5),
   * the local hook store may still contain older cached messages.
   *
   * Those older messages must NOT be treated as "new" relative to the server base,
   * otherwise they get appended after the server messages and scramble the history.
   *
   * We only consider hook messages AFTER the last server/base message as new.
   */
  const sliceHookMessagesAfterBaseTail = useCallback(
    (base: UIMessage[], hookMessages: UIMessage[]) => {
      if (!base || base.length === 0) return hookMessages;
      if (!hookMessages || hookMessages.length === 0) return [];

      const lastBaseId = base[base.length - 1]?.id;
      if (!lastBaseId) return hookMessages;

      // Find the last occurrence of the base tail in the hook list
      let lastIdx = -1;
      for (let i = hookMessages.length - 1; i >= 0; i--) {
        if (hookMessages[i]?.id === lastBaseId) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx === -1) return hookMessages;
      return hookMessages.slice(lastIdx + 1);
    },
    [],
  );

  // Prefer cache until server has loaded
  const historicalMessages: UIMessage[] = useMemo(() => {
    if (!isThread) return [];
    if (historicalMessagesFromServer.length > 0) {
      return historicalMessagesFromServer;
    }
    return initialMessages ?? [];
  }, [isThread, historicalMessagesFromServer, initialMessages]);

  // Combine ephemeral older pages (never cached) + base persisted history for UI + AI context.
  const baseHistory: UIMessage[] = useMemo(() => {
    if (!isThread) return [];
    if (!olderEphemeralMessages || olderEphemeralMessages.length === 0) {
      return historicalMessages;
    }
    return [...olderEphemeralMessages, ...historicalMessages];
  }, [isThread, olderEphemeralMessages, historicalMessages]);

  // Keep ref in sync for use in closures (prepareSendMessagesRequest)
  useEffect(() => {
    historicalMessagesRef.current = baseHistory;
  }, [baseHistory]);

  // Reset per-thread ephemeral pagination state; also keep cursor/isDone in sync with late-arriving server props.
  useEffect(() => {
    autoFillAttemptsRef.current = 0;
    setOlderEphemeralMessages([]);
    setHistoryCursor(initialHistoryCursor ?? null);
    setHistoryIsDone(initialHistoryIsDone ?? true);
  }, [id]);

  useEffect(() => {
    if (!isThread) return;
    if (olderEphemeralMessages.length > 0) return;
    setHistoryCursor(initialHistoryCursor ?? null);
    setHistoryIsDone(initialHistoryIsDone ?? true);
  }, [isThread, initialHistoryCursor, initialHistoryIsDone, olderEphemeralMessages.length]);

  const loadOlderPage = useCallback(
    async ({ preserveScroll }: { preserveScroll: boolean }) => {
      if (!isThread) return;
      if (historyIsDone) return;
      if (requestInFlightRef.current) return;

      const cursor = historyCursor && historyCursor.length > 0 ? historyCursor : null;
      if (!cursor) {
        setHistoryIsDone(true);
        return;
      }

      const requestThreadId = id;
      requestInFlightRef.current = true;
      setIsLoadingOlder(true);

      try {
        if (preserveScroll) {
          const el = scrollRef.current;
          if (el) {
            pendingPrependScrollRef.current = {
              scrollTop: el.scrollTop,
              scrollHeight: el.scrollHeight,
            };
          }
        } else {
          pendingPrependScrollRef.current = null;
        }

        const result = await convex.query(api.threads.getThreadMessagesPaginatedSafe, {
          threadId: id,
          paginationOpts: { numItems: HISTORY_PAGE_SIZE, cursor },
        });

        // Ignore late results if user navigated to a different thread mid-request.
        if (activeThreadIdRef.current !== requestThreadId) {
          pendingPrependScrollRef.current = null;
          return;
        }

        const nextCursor =
          typeof result.continueCursor === "string" && result.continueCursor.length > 0
            ? result.continueCursor
            : null;
        const done = !!result.isDone || nextCursor === null;
        setHistoryCursor(nextCursor);
        setHistoryIsDone(done);

        const page = result.page ?? [];
        if (!page || page.length === 0) {
          pendingPrependScrollRef.current = null;
          return;
        }

        const transformed = transformConvexMessages(page);

        // Dedupe against existing ephemeral + current persisted base history.
        const baseIds = new Set(historicalMessages.map((m) => m.id));

        setOlderEphemeralMessages((prev) => {
          const seen = new Set<string>([...baseIds, ...prev.map((m) => m.id)]);
          const newUnique = transformed.filter((m) => !seen.has(m.id));
          if (newUnique.length === 0) {
            pendingPrependScrollRef.current = null;
            return prev;
          }
          return [...newUnique, ...prev];
        });
      } catch (error) {
        console.error("Failed to load older messages:", error);
      } finally {
        requestInFlightRef.current = false;
        setIsLoadingOlder(false);
      }
    },
    [convex, historyCursor, historyIsDone, historicalMessages, id, isThread, scrollRef],
  );

  useEffect(() => {
    const container = scrollRef.current;
    const sentinel = topSentinelRef.current;
    if (!container || !sentinel) return;
    if (!isThread) return;
    if (historyIsDone) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          void loadOlderPage({ preserveScroll: !isAtBottom });
        }
      },
      {
        root: container,
        rootMargin: HISTORY_ROOT_MARGIN,
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historyIsDone, isAtBottom, isThread, loadOlderPage, scrollRef]);

  // Auto-fill: if content doesn't overflow, keep loading older pages (bounded) so users can scroll.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (!isThread) return;
    if (historyIsDone) return;
    if (requestInFlightRef.current || isLoadingOlder) return;
    if (autoFillAttemptsRef.current >= AUTOFILL_MAX_PAGES_PER_THREAD) return;

    if (container.scrollHeight <= container.clientHeight + AUTOFILL_VIEWPORT_THRESHOLD_PX) {
      autoFillAttemptsRef.current += 1;
      void loadOlderPage({ preserveScroll: false });
    }
  }, [
    baseHistory.length,
    historyIsDone,
    isLoadingOlder,
    isThread,
    loadOlderPage,
    scrollRef,
  ]);

  useLayoutEffect(() => {
    const pending = pendingPrependScrollRef.current;
    if (!pending) return;

    const el = scrollRef.current;
    if (!el) {
      pendingPrependScrollRef.current = null;
      return;
    }

    const nextScrollHeight = el.scrollHeight;
    const delta = nextScrollHeight - pending.scrollHeight;
    if (delta !== 0) {
      el.scrollTop = pending.scrollTop + delta;
    }

    pendingPrependScrollRef.current = null;
  }, [olderEphemeralMessages.length, scrollRef]);

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
          const hookAfterBase = sliceHookMessagesAfterBaseTail(base, hookMessages);
          const newMessagesFromHook = hookAfterBase.filter((m: UIMessage) => !serverIds.has(m.id));
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
      if (baseHistory.length > 0) {
        // Use base history (ephemeral older + server/cache) for existing messages,
        // hook only for new messages (includes streaming).
        const baseIds = new Set(baseHistory.map((m: UIMessage) => m.id));
        const hookAfterBase = sliceHookMessagesAfterBaseTail(baseHistory, messages);
        const newMessagesFromHook = hookAfterBase.filter((m: UIMessage) => !baseIds.has(m.id));
        return [...baseHistory, ...newMessagesFromHook];
      }
      return messages;
    }

    // After active session (user sent message/received stream), merge server + new hook messages
    if (hadActiveSessionRef.current && messages.length > 0) {
      if (baseHistory.length > 0) {
        // Use base versions for existing messages (source of truth),
        // only use hook for NEW messages (user's new message, AI response).
        const baseIds = new Set(baseHistory.map((m: UIMessage) => m.id));
        const hookAfterBase = sliceHookMessagesAfterBaseTail(baseHistory, messages);
        const newMessagesFromHook = hookAfterBase.filter((m: UIMessage) => !baseIds.has(m.id));
        return [...baseHistory, ...newMessagesFromHook];
      }
      // No server data but we have hook messages - use them (preserves AI response)
      return messages;
    }

    // Fresh navigation (no active session) - use base history (includes ephemeral older when present).
    if (baseHistory.length > 0) return baseHistory;
    return historicalMessages;
  }, [
    isThread,
    baseHistory,
    historicalMessages,
    messages,
    initialMessages,
    isActivelyGenerating,
    sliceHookMessagesAfterBaseTail,
  ]);

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

  const olderEphemeralIdSet = useMemo(() => {
    return new Set(olderEphemeralMessages.map((m) => m.id));
  }, [olderEphemeralMessages]);

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
      // Do not persist older pages loaded via infinite scroll (ephemeral by design).
      const persistable = displayMessages.filter((m) => !olderEphemeralIdSet.has(m.id));
      if (persistable.length === 0) return;
      void saveCachedThreadMessages(id, persistable);
    }, 750);

    return () => clearTimeout(handle);
  }, [id, isThread, displayMessages, status, olderEphemeralIdSet]);

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
            {isThread && (
              <div className="-mt-2 pb-2">
                <div ref={topSentinelRef} className="h-[1px] w-full" />
                {isLoadingOlder && (
                  <div className="flex items-center justify-center py-2">
                    <span className="text-xs text-muted-foreground">Cargando mensajes anteriores…</span>
                  </div>
                )}
              </div>
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