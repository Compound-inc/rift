import { copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";
import {
  AttachmentsIcon,
  RedoIcon,
  CopyIcon,
  CheckIcon,
} from "@/components/ui/icons/svg-icons";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai/tool";
import { Message, MessageContent } from "@/components/ai/message";
import { Response } from "@/components/ai/response";
import { Actions, Action } from "@/components/ai/actions";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai/sources";
import { Loader } from "@/components/ai/loader";
import type { UIMessage } from "@ai-sdk-tools/store";
import React, { useCallback, useState } from "react";

// Memoized action buttons component
const MessageActions = React.memo(function MessageActions({
  message,
  onRegenerateAssistantMessage,
  onRegenerateAfterUserMessage,
}: {
  message: UIMessage;
  onRegenerateAssistantMessage: (messageId: string) => void;
  onRegenerateAfterUserMessage: (messageId: string) => void;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const handleRegenerateAssistant = useCallback(() => {
    onRegenerateAssistantMessage(message.id);
  }, [onRegenerateAssistantMessage, message.id]);

  const handleRegenerateAfterUser = useCallback(() => {
    onRegenerateAfterUserMessage(message.id);
  }, [onRegenerateAfterUserMessage, message.id]);

  const handleCopyAssistant = useCallback(async () => {
    const textContent = message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join("\n");
    await copyToClipboard(textContent);
    toast.success("Copied to clipboard");
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [message.id]);

  const handleCopyUser = useCallback(async () => {
    const textContent = message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join("\n");
    await copyToClipboard(textContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [message.id]);

  if (message.role === "assistant") {
    return (
      <div className="px-0">
        <Actions className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-start">
          <Action
            onClick={handleRegenerateAssistant}
            label="Retry"
            tooltip="Regenerate response"
          >
            <RedoIcon className="size-4" />
          </Action>
          <Action
            onClick={handleCopyAssistant}
            label="Copy"
            tooltip="Copy to clipboard"
          >
            {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          </Action>
        </Actions>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="px-0">
        <Actions className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          <Action
            onClick={handleRegenerateAfterUser}
            label="Retry"
            tooltip="Retry message"
          >
            <RedoIcon className="size-4" />
          </Action>
          <Action
            onClick={handleCopyUser}
            label="Copy"
            tooltip="Copy to clipboard"
          >
            {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          </Action>
        </Actions>
      </div>
    );
  }

  return null;
}, (prevProps, nextProps) => {
  // Only re-render if the message ID changes, not during streaming
  return prevProps.message.id === nextProps.message.id;
});

interface MessageRendererProps {
  message: UIMessage;
  isStreaming: boolean;
  onRegenerateAssistantMessage: (messageId: string) => void;
  onRegenerateAfterUserMessage: (messageId: string) => void;
}

export const MessageRenderer = React.memo(function MessageRenderer({
  message,
  isStreaming,
  onRegenerateAssistantMessage,
  onRegenerateAfterUserMessage,
}: MessageRendererProps) {
  const hasTextParts = message.parts.some(
    (p) => p.type === "text" && (p as any).text && (p as any).text.length > 0,
  );
  const hasReasoningParts = message.parts.some((p) => p.type === "reasoning");
  // Hide loader if reasoning UI is shown, otherwise show loader only when no text yet
  const showInlineLoader = isStreaming && message.role === "assistant" && !hasTextParts && !hasReasoningParts;
  const renderMessageContent = useCallback(() => {
    // Group reasoning parts together
    const reasoningParts = message.parts.filter(
      (part) => part.type === "reasoning" && "text" in part,
    );
    const nonReasoningParts = message.parts.filter(
      (part) => part.type !== "reasoning" && part.type !== "source-url",
    );
    const fileParts = message.parts.filter(
      (part) => part.type === "file",
    );

    return (
      <>
        {/* Single reasoning section for all reasoning parts */}
        {reasoningParts.length > 0 && (
          <Reasoning
            key={`${message.id}-reasoning`}
            className="w-full mb-4"
            isStreaming={isStreaming}
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

        {/* Render non-reasoning, non-source parts (text content) */}
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

        {/* Render file attachments */}
        {fileParts.length > 0 && (
          <div className="space-y-3">
            {fileParts.map((part, i) => {
              const filePart = part as { 
                type: "file";
                mediaType: string;
                url: string;
                attachmentType?: "image" | "pdf" | "file";
              };
              
              const { mediaType, url, attachmentType } = filePart;
                  
              if (attachmentType === "image" || mediaType.startsWith("image/")) {
                return (
                  <div key={`${message.id}-file-${i}`} className="rounded-lg overflow-hidden border">
                    <img
                      src={url}
                      alt="Uploaded image"
                      className="max-w-full h-auto max-h-96 object-contain"
                      loading="lazy"
                    />
                  </div>
                );
              }
              
              if (attachmentType === "pdf" || mediaType === "application/pdf") {
                return (
                  <a
                    key={`${message.id}-file-${i}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-16 h-16 rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title="View PDF"
                  >
                    <div className="w-full h-full flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <span className="text-red-600 dark:text-red-400 font-bold text-lg">PDF</span>
                    </div>
                  </a>
                );
              }
              
              // Fallback for other file types
              return (
                <div key={`${message.id}-file-${i}`} className="flex items-center gap-2 p-3 border rounded-lg bg-muted">
                  <AttachmentsIcon className="size-4" />
                  <div className="flex-1">
                    <div className="font-medium">File</div>
                    <div className="text-sm text-muted-foreground">
                      {mediaType}
                    </div>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }, [message, isStreaming]);


  return (
    <div className="group">
      <Message from={message.role} key={message.id}>
        <MessageContent from={message.role}>
          {renderMessageContent()}
          {showInlineLoader ? (
            <div className="py-1">
              <Loader />
            </div>
          ) : null}
        </MessageContent>
      </Message>
      
      {/* Sources section for assistant messages - only show when sources exist and response is completed */}
      {message.role === "assistant" && 
       message.parts.filter((part) => part.type === "source-url").length > 0 &&
       !isStreaming && (
        <Sources className="mt-4 px-4">
          <SourcesTrigger
            count={
              message.parts.filter(
                (part) => part.type === "source-url",
              ).length
            }
          />
          {message.parts
            .filter((part) => part.type === "source-url")
            .map((part, i) => {
              const sourcePart = part as { url: string; title?: string };
              return (
                <SourcesContent key={`${message.id}-source-${i}`}>
                  <Source
                    href={sourcePart.url}
                    title={sourcePart.title || sourcePart.url}
                  />
                </SourcesContent>
              );
            })}
        </Sources>
      )}
      
      {/* Message Actions - memoized to prevent re-renders during streaming */}
      <MessageActions
        message={message}
        onRegenerateAssistantMessage={onRegenerateAssistantMessage}
        onRegenerateAfterUserMessage={onRegenerateAfterUserMessage}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // While streaming, always allow re-render so tokens appear incrementally
  if (nextProps.isStreaming) return false;
  // Also re-render exactly when streaming toggles to update reasoning trigger immediately
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  // For non-streaming messages, use strict comparison to avoid churn
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.role === nextProps.message.role &&
    prevProps.message.parts.length === nextProps.message.parts.length &&
    prevProps.message.parts.every((part, index) => {
      const nextPart = nextProps.message.parts[index];
      return part.type === nextPart.type && (part as any).text === (nextPart as any).text;
    })
  );
});
