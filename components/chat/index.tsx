"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { generateUUID } from "@/lib/utils";
import { useModel } from "@/contexts/model-context";
import { useLocale } from "@/contexts/locale-context";
import { useInitialMessage } from "@/contexts/initial-message-context";
import { useCallback, useEffect, useRef, useMemo, useState, useLayoutEffect } from "react";
import { useRegeneration } from "./hooks/use-regeneration";
import { ToolType, getDefaultTools } from "@/lib/ai/model-tools";
import { resolveModel } from "@/lib/ai/ai-providers";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AttachmentsIcon } from "@/components/ui/icons/svg-icons";
import { TooltipProvider } from "@/components/ai/ui/tooltip";

import { useChatUIStore } from "./ui-store";
import { WelcomeScreen } from "./components/welcome-screen";
import { ChatInputArea } from "./components/chat-input-area";
import { useFirstMessageSendAnimation } from "./first-message-send-animation";
import { RiftChatThread } from "./chat-thread";
import type { ChatInterfaceProps } from "./types";
import { ChatStoreProvider, useChatStateInstance } from "@/lib/stores/hooks";
import { Effect } from "effect";
import { saveCachedThreadMessages } from "@/lib/local-first/thread-messages-cache";

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
  disableInput = false,
  onInitialMessage,
  customInstructionId: initialCustomInstructionId,
}: ChatInterfaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const lang = useLocale();
  const firstMessageAnim = useFirstMessageSendAnimation();
  const promptAnchorRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
  const [scrollDoneForId, setScrollDoneForId] = useState<string | null>(null);
  const scrollDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Keep ref in sync for use in closures (prepareSendMessagesRequest)
  useEffect(() => {
    historicalMessagesRef.current = historicalMessages;
  }, [historicalMessages]);

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
        const isChatHome = pathname === `/${lang}/chat` || pathname === `/${lang}/chat/`;
        if (isChatHome) {
          router.push(`/${lang}/chat/${id}`);
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

          const regenAnchor = regenerateAnchorRef.current;
          const base = regenAnchor
            ? pruneAt(serverData, regenAnchor.id, regenAnchor.role)
            : serverData;
          const hookMessages =
            trigger === "regenerate-message" && regenAnchor
              ? pruneAt(messages as UIMessage[], regenAnchor.id, regenAnchor.role)
              : (messages as UIMessage[]);

          // Prefer hook versions for overlapping ids (edits/pruning), append only truly-new hook messages.
          const hookById = new Map<string, UIMessage>(
            hookMessages.map((m) => [m.id, m] as const),
          );
          const baseWithHookEdits: UIMessage[] = base.map(
            (m) => hookById.get(m.id) ?? m,
          );
          const baseIds = new Set(baseWithHookEdits.map((m) => m.id));
          const hookAfterBase = sliceHookMessagesAfterBaseTail(baseWithHookEdits, hookMessages);
          const newMessagesFromHook = hookAfterBase.filter((m) => !baseIds.has(m.id));
          const requestMessages = [...baseWithHookEdits, ...newMessagesFromHook];

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
  
  // Use ref for status to avoid recreating callbacks on every status change (5.1 Defer State Reads)
  const statusRef = useRef(status);
  statusRef.current = status;

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

    const regenAnchor = regenerateAnchorRef.current;
    const effectiveBaseHistory =
      regenAnchor && historicalMessages.length > 0
        ? pruneAt(historicalMessages, regenAnchor.id, regenAnchor.role)
        : historicalMessages;

    // During active generation, use server for history + hook for new/streaming messages
    if (isActivelyGenerating && messages.length > 0) {
      if (effectiveBaseHistory.length > 0) {
        // Prefer hook versions for overlapping ids (e.g. edited messages), append only truly-new hook messages.
        const hookMessages = messages as UIMessage[];
        const hookById = new Map<string, UIMessage>(
          hookMessages.map((m) => [m.id, m] as const),
        );
        const baseWithHookEdits: UIMessage[] = effectiveBaseHistory.map(
          (m) => hookById.get(m.id) ?? m,
        );
        const baseIds = new Set(baseWithHookEdits.map((m) => m.id));
        const hookAfterBase = sliceHookMessagesAfterBaseTail(
          baseWithHookEdits,
          hookMessages
        );
        const newMessagesFromHook = hookAfterBase.filter((m) => !baseIds.has(m.id));
        return [...baseWithHookEdits, ...newMessagesFromHook];
      }
      return messages;
    }

    // After active session (user sent message/received stream), merge server + new hook messages
    if (hadActiveSessionRef.current && messages.length > 0) {
      if (effectiveBaseHistory.length > 0) {
        // Prefer hook versions for overlapping ids (e.g. edits), append only truly-new hook messages.
        const hookMessages = messages as UIMessage[];
        const hookById = new Map<string, UIMessage>(
          hookMessages.map((m) => [m.id, m] as const),
        );
        const baseWithHookEdits: UIMessage[] = effectiveBaseHistory.map(
          (m) => hookById.get(m.id) ?? m,
        );
        const baseIds = new Set(baseWithHookEdits.map((m) => m.id));
        const hookAfterBase = sliceHookMessagesAfterBaseTail(
          baseWithHookEdits,
          hookMessages
        );
        const newMessagesFromHook = hookAfterBase.filter((m) => !baseIds.has(m.id));
        return [...baseWithHookEdits, ...newMessagesFromHook];
      }
      // No server data but we have hook messages - use them (preserves AI response)
      return messages;
    }

    // Fresh navigation (no active session) - use server/cache history.
    if (effectiveBaseHistory.length > 0) return effectiveBaseHistory;
    return historicalMessages;
  }, [
    isThread,
    historicalMessages,
    messages,
    initialMessages,
    isActivelyGenerating,
    sliceHookMessagesAfterBaseTail,
    pruneAt,
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

  // Track expected AI responses for layout shift prevention.
  // Once the initial display is done, freeze the count so that server data
  // prepending new messages doesn't flip allResponsesReady back to false
  // (which would trigger unnecessary state cascades and re-renders).
  const frozenExpectedCountRef = useRef<number | null>(null);
  const expectedResponseCount = useMemo(() => {
    if (!isThread || status === "streaming" || status === "submitted") {
      return 0; // Don't wait during streaming
    }
    if (frozenExpectedCountRef.current !== null) {
      return frozenExpectedCountRef.current;
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

  // Track whether initial display is done (ref avoids re-creating callbacks)
  const initialDisplayDoneRef = useRef(false);

  const handleResponseReady = useCallback((messageId: string) => {
    if (!readyResponseIdsRef.current.has(messageId)) {
      readyResponseIdsRef.current.add(messageId);
      // Only update state before initial display is done.
      // After that, skip state updates to avoid cascading re-renders
      // when server data replaces cache data and new MemoResponses mount.
      if (!initialDisplayDoneRef.current) {
        setReadyResponseCount((prev) => prev + 1);
      }
    }
  }, []);

  const allResponsesReady = useMemo(() => {
    if (status === "streaming" || status === "submitted") return true;
    if (expectedResponseCount === 0) return true;
    return readyResponseCount >= expectedResponseCount;
  }, [status, expectedResponseCount, readyResponseCount]);

  const [forceShow, setForceShow] = useState(false);
  // Once we've shown messages for a given thread, never hide them again.
  const [hasEverShownMessages, setHasEverShownMessages] = useState(false);
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
    setHasEverShownMessages(false);
    initialDisplayDoneRef.current = false;
    frozenExpectedCountRef.current = null;
  }, [id]);

  const shouldShowMessages = allResponsesReady || forceShow || status === "streaming" || status === "submitted";

  useEffect(() => {
    if (!isThread) return;
    if (hasEverShownMessages) return;
    if (!shouldShowMessages) return;
    if (displayMessages.length === 0) return;
    setHasEverShownMessages(true);
    // Mark initial display as done so handleResponseReady stops triggering
    // state updates (avoids re-render cascades on server data arrival)
    initialDisplayDoneRef.current = true;
    // Freeze the expected response count so server data prepending new messages
    // doesn't flip allResponsesReady back to false
    frozenExpectedCountRef.current = expectedResponseCount;
  }, [displayMessages.length, hasEverShownMessages, isThread, shouldShowMessages, expectedResponseCount]);

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
      setScrollDoneForId(null);
      prevIdRef.current = id;
    }
  }, [id, setInput, setSelectedFiles, setUploadedAttachments, setUploadingFiles, setIsUploading, setIsSendingMessage, setQuotaError, setShowNoSubscriptionDialog]);

  // When navigating to a different thread, scroll to bottom instantly (not pinned to last user message).
  // Only run once per id when we have content, so we don't override the smooth scroll when the user sends a new message.
  // Skip when the first-message send animation is running so we don't fight the fly-in and cause a teleport.
  useEffect(() => {
    if (!isThread) return;
    if (firstMessageAnim.phase !== "idle") return;
    if (displayMessages.length === 0) return;
    if (scrollDoneForId === id) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollToBottomInstant = () => {
      el.scrollTop = el.scrollHeight - el.clientHeight;
      // Delay marking initial load complete so a second batch of messages (e.g. server/cache)
      // arriving within ~500ms does not trigger the pin-to-last-user-message effect.
      if (scrollDoneTimeoutRef.current) clearTimeout(scrollDoneTimeoutRef.current);
      scrollDoneTimeoutRef.current = setTimeout(() => {
        setScrollDoneForId(id);
        scrollDoneTimeoutRef.current = null;
      }, 500);
    };
    // Double rAF so layout (including RiftChatThread spacer) is committed before we scroll.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottomInstant);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (scrollDoneTimeoutRef.current) {
        clearTimeout(scrollDoneTimeoutRef.current);
        scrollDoneTimeoutRef.current = null;
      }
    };
  }, [id, isThread, firstMessageAnim.phase, displayMessages.length, scrollDoneForId]);

  // Use refs for callbacks that need access to latest renderedMessages
  // This prevents re-creating callbacks on every stream chunk (5.1 Defer State Reads)
  const renderedMessagesRef = useRef(renderedMessages);
  renderedMessagesRef.current = renderedMessages;

  const onRegenerateAssistant = useCallback(
    (messageId: string) => {
      handleRegenerateAssistant(messageId, renderedMessagesRef.current);
    },
    [handleRegenerateAssistant],
  );

  const onRegenerateAfterUser = useCallback(
    (messageId: string) => {
      handleRegenerateAfterUser(messageId, renderedMessagesRef.current);
    },
    [handleRegenerateAfterUser],
  );

  // Stable callback for editing user messages - moved outside .map() to prevent re-creation
  const onEditUserMessage = useCallback(
    async (messageId: string, newContent: string) => {
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
        handleRegenerateAfterUser(messageId, renderedMessagesRef.current);
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
    },
    [handleRegenerateAfterUser, setMessages, triggerError, updateUserMessageContent],
  );

  const sendMessageRef = useRef<((message: UIMessage) => Promise<void>) | null>(null);
  sendMessageRef.current = sendMessage;


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
      // Use ref to avoid recreating callback on every status change
      const currentStatus = statusRef.current;
      const isGenerating =
        currentStatus === "streaming" || currentStatus === "submitted" || isSendingMessage;

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

      // First-message send animation: when sending from welcome, capture source point so the
      // thread view can animate the first user message flying in from the prompt.
      if (id === "welcome" && displayMessages.length === 0) {
        const anchor = promptAnchorRef.current;
        if (anchor && typeof window !== "undefined") {
          const r = anchor.getBoundingClientRect();
          const sourcePoint = { x: r.left + 16, y: r.top + 18 };
          flushSync(() => firstMessageAnim.begin(sourcePoint));
        }
      }

      // Do NOT clear regenerateAnchorRef here.
      // The base history can remain stale for a while (local-first, no live subscription),
      // and clearing the anchor allows "ghost" assistant messages (pruned locally) to reappear.

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
      firstMessageAnim,
      displayMessages.length,
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


  // Memoize drag handlers to prevent re-renders
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    const dt = e.dataTransfer;
    const hasFiles = !!dt && Array.from(dt.types || []).includes("Files");
    if (!hasFiles) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragActive(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const dt = e.dataTransfer;
    const hasFiles = !!dt && Array.from(dt.types || []).includes("Files");
    if (!hasFiles) return;
    e.preventDefault();
    dt.dropEffect = "copy";
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dragCounterRef.current > 0) {
      dragCounterRef.current -= 1;
    }
    if (dragCounterRef.current <= 0) {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragActive(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files || files.length === 0) return;
    void handleProcessFiles(files);
  }, [handleProcessFiles]);

  return (
    <div
      className="flex h-screen w-full min-h-0 flex-col relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <div
          className={[
            "mx-auto w-full max-w-full md:max-w-3xl px-0 pl-9 pr-5 pb-0 md:pl-9 md:pr-5",
            !hasEverShownMessages && !shouldShowMessages ? "opacity-0" : "",
          ].join(" ")}
        >
          {!isThread && displayMessages.length === 0 ? (
            <WelcomeScreen
              user={user}
              onSuggestionClick={handleSuggestionClick}
            />
          ) : (
            <RiftChatThread
              messages={displayMessages}
              status={status}
              onRegenerateAssistantMessage={onRegenerateAssistant}
              onRegenerateAfterUserMessage={onRegenerateAfterUser}
              onEditUserMessage={onEditUserMessage}
              onResponseReady={handleResponseReady}
              disableRegenerate={status === "streaming"}
              initialLoadComplete={scrollDoneForId === id}
            />
          )}
        </div>
      </div>

      <ChatInputArea
        ref={promptAnchorRef}
        disableInput={promptDisabled}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onSubmit={handleSubmit}
        onStop={handleStop}
        threadId={isThread ? id : undefined}
        status={status}
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
    <TooltipProvider>
      <ChatStoreProvider initialMessages={props.initialMessages || []}>
        <ChatInterfaceInternal {...props} />
      </ChatStoreProvider>
    </TooltipProvider>
  );
}