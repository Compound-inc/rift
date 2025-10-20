"use client";

import { useChat, type UIMessage } from "@ai-sdk-tools/store";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { generateUUID } from "@/lib/utils";
import { useModel } from "@/contexts/model-context";
import { useInitialMessage } from "@/contexts/initial-message-context";
import { toast } from "sonner";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useRegeneration, filterHiddenForRender } from "./hooks/use-regeneration";
import { ToolType, getDefaultTools } from "@/lib/ai/model-tools";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useConvexAuth, usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader } from "@/components/ai/loader";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai/conversation";

import { useChatUIStore } from "./ui-store";
import { WelcomeScreen } from "./components/welcome-screen";
import { MessageRenderer } from "./components/message-renderer";
import { ChatInputArea } from "./components/chat-input-area";
import type { ChatInterfaceProps } from "./types";
import { ChatStoreProvider, useChatStateInstance } from "@/lib/stores/hooks";

// Internal component that uses the store
function ChatInterfaceInternal({
  id,
  initialMessages,
  hasMoreMessages = false,
  disableInput = false,
  onInitialMessage,
}: ChatInterfaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedModel, setSelectedModel } = useModel();
  const { consumeInitialMessage } = useInitialMessage();
  const { isAuthenticated } = useConvexAuth();
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
  const setChatKey = useChatUIStore((s) => s.setChatKey);
  const handleSearchToggle = useChatUIStore((s) => s.handleSearchToggle);

  // Apply model change effects
  const prevModelRef = useRef(selectedModel);
  useEffect(() => {
    if (prevModelRef.current !== selectedModel) {
      prevModelRef.current = selectedModel;
      setChatKey((prev) => prev + 1);
      setQuotaError(null);
      setShowNoSubscriptionDialog(false);
    }
  }, [selectedModel, setChatKey, setQuotaError, setShowNoSubscriptionDialog]);

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

  // Paginated query for historical messages
  // Skip the query if we have initialMessages from server-side rendering, unless pagination is enabled
  const { 
    results: paginatedMessages, 
    status: paginationStatus, 
    loadMore 
  } = usePaginatedQuery(
    api.threads.getThreadMessagesPaginatedSafe,
    // If initialMessages is undefined OR an empty array, fetch from client.
    isThread && (
      !initialMessages || (Array.isArray(initialMessages) && initialMessages.length === 0) || enableClientPagination
    )
      ? { threadId: id }
      : "skip",
    { initialNumItems: 5 }
  );

  // Transform paginated messages to UIMessage format
  const historicalMessages: UIMessage[] = useMemo(() => {
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

        // Check if this is a no subscription error
        if (error.message.includes("No subscription")) {
          try {
            // Parse JSON error response
            const jsonMatch = error.message.match(/\{.*\}/);
            if (jsonMatch) {
              const errorResponse = JSON.parse(jsonMatch[0]);
              if (errorResponse.error === "No subscription") {
                setShowNoSubscriptionDialog(true);
                setQuotaError(null); // Clear any existing quota error
                return;
              }
            }
          } catch {
            // If parsing fails, still show the dialog
            setShowNoSubscriptionDialog(true);
            setQuotaError(null);
            return;
          }
        }

        // Check if this is a quota exceeded error and parse JSON response
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
                setShowNoSubscriptionDialog(false); // Clear dialog if showing
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
            setShowNoSubscriptionDialog(false);
          }
        } else {
          // Clear quota error and dialog for non-quota errors
          setQuotaError(null);
          setShowNoSubscriptionDialog(false);

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

          // Build request context: merge server-fetched base with current chat hook messages
          const baseBeforePrune = initialMessages && initialMessages.length > 0
            ? initialMessages
            : historicalMessages;

          const anchor = trigger === "regenerate-message" ? regenerateAnchorRef.current : null;
          const base = anchor ? pruneAt(baseBeforePrune, anchor.id, anchor.role) : baseBeforePrune;
          const hookMessages = anchor ? pruneAt(messages, anchor.id, anchor.role) : messages;

          const usedIds = new Set<string>();
          const requestMessages = base.map((m) => {
            usedIds.add(m.id);
            const fromHook = hookMessages.find((s) => s.id === m.id);
            return fromHook ?? m;
          });
          hookMessages.forEach((m) => {
            if (!usedIds.has(m.id)) requestMessages.push(m);
          });

          return {
            body: {
              messages: requestMessages,
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

  const { messages, status, setMessages, sendMessage, stop } = chatHelpers as any;
  const regenerateRef = useRef<null | ((opts?: { messageId?: string }) => Promise<void>)>(null);
  regenerateRef.current = (chatHelpers as any).regenerate ?? null;

  // Sync AI SDK messages to Zustand store for optimized rendering
  useEffect(() => {
    chatStateInstance.syncFromAISDK(messages, status === 'streaming' ? 'streaming' : 'ready');
  }, [messages, status, chatStateInstance]);

  const {
    regenerateAnchorRef,
    hiddenIdsRef,
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
  });

  const updateUserMessageContent = useMutation(api.threads.updateUserMessageContent);

  // Merge historical messages with AI SDK streaming messages (overlay stream onto base by id)
  const renderedMessages: UIMessage[] = useMemo(() => {
    if (!isThread) {
      if (messages.length > 0) return messages;
      if (initialMessages && initialMessages.length > 0) return initialMessages;
      return [];
    }

    const baseBeforePrune = initialMessages && initialMessages.length > 0 ? initialMessages : historicalMessages;
    const anchor = regenerateAnchorRef.current;
    const base = anchor ? pruneAt(baseBeforePrune, anchor.id, anchor.role) : baseBeforePrune;

    // Keep base order, overlay streaming message if same id, append new streaming-only items at the end
    const usedIds = new Set<string>();
    const result: UIMessage[] = base.map((m) => {
      const sm = messages.find((s: UIMessage) => s.id === m.id);
      usedIds.add(m.id);
      return sm ?? m;
    });
    messages.forEach((s: UIMessage) => {
      if (!usedIds.has(s.id)) result.push(s);
    });
    return filterHiddenForRender(result, hiddenIdsRef);
  }, [isThread, historicalMessages, messages, initialMessages, pruneAt]);

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
      const { input, uploadedAttachments, uploadingFiles } = useChatUIStore.getState();
      if (disableInput || (!input.trim() && uploadedAttachments.length === 0 && uploadingFiles.length === 0)) return;

      const messageContent = input.trim();
      const messageId = generateUUID();

      // Reset regeneration pruning state for normal submissions so new messages are included
      try {
        if (regenerateAnchorRef.current) {
          regenerateAnchorRef.current = null;
        }
        if (hiddenIdsRef.current && typeof hiddenIdsRef.current.clear === "function") {
          hiddenIdsRef.current.clear();
        }
      } catch {}

      // Clear any existing quota error when user tries to send a new message
      setQuotaError(null);
      setInput("");
      
      // Set sending state and clear attachments immediately
      setIsSendingMessage(true);
      
      // Capture attachments before clearing state
      const currentAttachments = uploadedAttachments;
      
      // Clear attachments immediately
      setUploadedAttachments([]);
      setSelectedFiles([]);
      setUploadingFiles([]);

      try {
        // Build message parts using captured attachments
        const parts: any[] = [];
        
        if (messageContent) {
          parts.push({ type: "text", text: messageContent });
        }
        
        // Use captured uploaded attachments
        currentAttachments.forEach(attachment => {
          parts.push({ 
            type: "file", 
            mediaType: attachment.mediaType,
            url: attachment.url,
            attachmentId: attachment.attachmentId,
          });
        });

        if (id === "welcome" && onInitialMessage) {
          // Handle initial message on welcome page
          const optimisticMessage: UIMessage = {
            id: messageId,
            role: "user",
            parts,
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
            parts,
          });
        }

        // Reset sending state
        setIsSendingMessage(false);
      } catch (error) {
        console.error("Failed to send message:", error);
        toast.error("Failed to send message. Please try again.");
        setInput(messageContent);
        // Clear optimistic messages on error
        setMessages([]);
        // Reset sending state on error
        setIsSendingMessage(false);
      }
    },
    [disableInput, id, onInitialMessage, setMessages, sendMessage, setQuotaError, setInput, setIsSendingMessage, setUploadedAttachments, setSelectedFiles, setUploadingFiles],
  );

  const handleStop = useCallback(() => {
    // Preserve current streaming message content before stopping
    setMessages((currentMessages: UIMessage[]) => {
      const lastMessage = currentMessages[currentMessages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        const updatedMessages = [...currentMessages];
        updatedMessages[updatedMessages.length - 1] = {
          ...lastMessage,
          parts: lastMessage.parts, // Preserve current content
        };
        return updatedMessages;
      }
      return currentMessages;
    });

    stop();
  }, [setMessages, stop]);

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
    <div className="flex h-screen w-full min-h-0 flex-col relative">
      <div className="flex-1 min-h-0">
        <Conversation>
          <ConversationContent className="mx-auto w-full max-w-3xl p-4 pb-30">
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
            {displayMessages.map((message, index) => {
              const isLast = index === displayMessages.length - 1;
              const isStreaming = isLast && (status === "streaming");
              return (
                <MessageRenderer
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming}
                  onRegenerateAssistantMessage={onRegenerateAssistant}
                  onRegenerateAfterUserMessage={onRegenerateAfterUser}
                  onEditUserMessage={async (messageId: string, newContent: string) => {
                    try {
                      // Persist edit to Convex
                      await updateUserMessageContent({ messageId, content: newContent });

                      // Optimistically update local hook store so new content is used immediately
                      setMessages((curr: UIMessage[]) =>
                        curr.map((m) =>
                          m.id === messageId
                            ? {
                                ...m,
                                parts: [
                                  ...m.parts.filter((p: any) => p.type !== "text"),
                                  { type: "text", text: newContent } as any,
                                ],
                              }
                            : m,
                        ),
                      );

                      // Then trigger regeneration (prune-after-user semantics)
                      handleRegenerateAfterUser(messageId, renderedMessages);
                    } catch (e) {
                      console.error("Edit message failed", e);
                      toast.error("Failed to edit message.");
                    }
                  }}
                />
              );
            })}
            {(status === "submitted" || status === "streaming") &&
              !hasAssistantMessage && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Prompt input overlayed at bottom of the main area */}
      <ChatInputArea
        disableInput={disableInput}
        selectedModel={selectedModel}
        orgName={`orgName`}
        onModelChange={setSelectedModel}
        onSubmit={handleSubmit}
        onStop={handleStop}
      />
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