"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { generateUUID } from "@/lib/utils";
import { useModel } from "@/contexts/model-context";
import { useInitialMessage } from "@/contexts/initial-message-context";
import { useMessageRegeneration } from "@/hooks/use-message-regeneration";
import { useMessageEdit } from "@/hooks/use-message-edit";
import { toast } from "sonner";
import { useCallback, useEffect, useRef } from "react";
import { ToolType, getDefaultTools } from "@/lib/ai/model-tools";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader } from "@/components/ai/loader";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai/conversation";

import { useChatState, useModelChangeEffect } from "./hooks/use-chat-state";
import { useMessageData } from "./hooks/use-message-data";
import { useFileHandling } from "./hooks/use-file-handling";
import { WelcomeScreen } from "./components/welcome-screen";
import { MessageRenderer } from "./components/message-renderer";
import { ChatInputArea } from "./components/chat-input-area";
import type { ChatInterfaceProps } from "./types";

export default function ChatInterface({
  id,
  initialMessages,
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

  const { state, setters, handleSearchToggle } = useChatState();
  const {
    setInput,
    setSelectedFiles,
    setUploadedAttachments,
    setIsUploading,
    setUploadingFiles,
    setIsSendingMessage,
    setIsSearchEnabled,
    setQuotaError,
    setShowNoSubscriptionDialog,
    setChatKey,
  } = setters;

  // Apply model change effects
  useModelChangeEffect(
    selectedModel,
    setChatKey,
    setQuotaError,
    setShowNoSubscriptionDialog,
    setIsSearchEnabled
  );

  const isThread = id !== "welcome";

  // Force useChat to re-initialize when model changes
  const { messages, status, setMessages, sendMessage, regenerate, stop } =
    useChat({
      id: `${id}-${state.chatKey}`,
      generateId: generateUUID,
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

          // For regeneration, we need to handle the messageId and trigger
          if (trigger === "regenerate-message" && messageId) {
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

  // Store sendMessage in ref to prevent useEffect from re-running
  const sendMessageRef = useRef<((message: UIMessage) => Promise<void>) | null>(null);
  sendMessageRef.current = sendMessage;

  // Use message data hook
  const { renderedMessages, hasAssistantMessage } = useMessageData({
    id,
    initialMessages,
    messages,
    setMessages,
    isAuthenticated,
    consumeInitialMessage,
    sendMessageRef,
  });

  // Use file handling hook
  const {
    fileInputRef,
    handleFileUpload,
    handleAttachClick,
    handleFilesSelected,
    handleRemoveFile,
  } = useFileHandling({
    uploadedAttachments: state.uploadedAttachments,
    setUploadedAttachments,
    uploadingFiles: state.uploadingFiles,
    setUploadingFiles,
    selectedFiles: state.selectedFiles,
    setSelectedFiles,
    disableInput,
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (disableInput) return;
      setInput(e.target.value);
    },
    [disableInput, setInput],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (disableInput || (!state.input.trim() && state.uploadedAttachments.length === 0 && state.uploadingFiles.length === 0)) return;

      const messageContent = state.input.trim();
      const messageId = generateUUID();

      // Clear any existing quota error when user tries to send a new message
      setQuotaError(null);
      setInput("");
      
      // Set sending state and clear attachments immediately
      setIsSendingMessage(true);
      
      // Capture attachments before clearing state
      const currentAttachments = state.uploadedAttachments;
      
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
    [disableInput, state.input, state.uploadedAttachments, state.uploadingFiles, id, onInitialMessage, setMessages, sendMessage, setQuotaError, setInput, setIsSendingMessage, setUploadedAttachments, setSelectedFiles, setUploadingFiles],
  );

  const handleStop = useCallback(() => {
    // Preserve current streaming message content before stopping
    setMessages((currentMessages) => {
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

  return (
    <div className="flex h-screen w-full min-h-0 flex-col relative">
      <div className="flex-1 min-h-0">
        <Conversation>
          <ConversationContent>
            {/* Greeting message for welcome page when no messages */}
            {!isThread && renderedMessages.length === 0 && (
              <WelcomeScreen 
                user={user} 
                onSuggestionClick={handleSuggestionClick}
              />
            )}
            {renderedMessages.map((message, index) => {
              const isLastMessage = index === renderedMessages.length - 1;
              return (
                <MessageRenderer
                  key={message.id}
                  message={message}
                  status={isLastMessage ? status : "ready"}
                  messages={messages}
                  onRegenerateAssistantMessage={regenerateAssistantMessage}
                  onRegenerateAfterUserMessage={regenerateAfterUserMessage}
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
        input={state.input}
        isSearchEnabled={state.isSearchEnabled}
        quotaError={state.quotaError}
        showNoSubscriptionDialog={state.showNoSubscriptionDialog}
        orgName={`orgName`}
        uploadedAttachments={state.uploadedAttachments}
        uploadingFiles={state.uploadingFiles}
        isSendingMessage={state.isSendingMessage}
        disableInput={disableInput}
        isUploading={state.isUploading}
        selectedModel={selectedModel}
        status={status}
        messages={messages}
        onInputChange={handleInputChange}
        onSearchToggle={handleSearchToggle}
        onQuotaErrorClose={() => setQuotaError(null)}
        onNoSubscriptionDialogClose={() => setShowNoSubscriptionDialog(false)}
        onAttachClick={handleAttachClick}
        onFilesSelected={handleFilesSelected}
        onRemoveFile={handleRemoveFile}
        onModelChange={setSelectedModel}
        onSubmit={handleSubmit}
        onStop={handleStop}
        fileInputRef={fileInputRef}
      />
    </div>
  );
}
