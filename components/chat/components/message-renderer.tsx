import { copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";
import {
  AttachmentsIcon,
  RedoIcon,
  CopyIcon,
  CheckIcon,
  EditIcon,
} from "@/components/ui/icons/svg-icons";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai/tool";
import { Message, MessageContent } from "@/components/ai/message";
import { MemoResponse } from "@/components/ai/memo-response";
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
import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";

// Stable callback wrapper using refs (8.2 useLatest pattern)
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

const MessageActions = React.memo(function MessageActions({
  messageId,
  messageRole,
  messageParts,
  onRegenerateAssistantMessage,
  onRegenerateAfterUserMessage,
  onStartEdit,
  disableRegenerate = false,
}: {
  messageId: string;
  messageRole: "user" | "assistant" | "system";
  messageParts: UIMessage["parts"];
  onRegenerateAssistantMessage: (messageId: string) => void;
  onRegenerateAfterUserMessage: (messageId: string) => void;
  onStartEdit?: () => void;
  disableRegenerate?: boolean;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const messagePartsRef = useLatest(messageParts);
  const onRegenerateAssistantRef = useLatest(onRegenerateAssistantMessage);
  const onRegenerateAfterUserRef = useLatest(onRegenerateAfterUserMessage);
  const onStartEditRef = useLatest(onStartEdit);

  const handleRegenerateAssistant = useCallback(() => {
    onRegenerateAssistantRef.current(messageId);
  }, [messageId, onRegenerateAssistantRef]);

  const handleRegenerateAfterUser = useCallback(() => {
    onRegenerateAfterUserRef.current(messageId);
  }, [messageId, onRegenerateAfterUserRef]);

  const handleStartEdit = useCallback(() => {
    onStartEditRef.current?.();
  }, [onStartEditRef]);

  const handleCopy = useCallback(async () => {
    const textContent = messagePartsRef.current
      .filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join("\n");
    await copyToClipboard(textContent);
    if (messageRole === "assistant") {
      toast.success("Copiado al portapapeles");
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [messagePartsRef, messageRole]);

  if (messageRole === "assistant") {
    return (
      <div className="px-0">
        <Actions className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-start">
          <Action
            onClick={handleRegenerateAssistant}
            label="Regenerar"
            tooltip="Regenerar respuesta"
            disabled={disableRegenerate}
            aria-disabled={disableRegenerate}
          >
            <RedoIcon className="size-4" />
          </Action>
          <Action
            onClick={handleCopy}
            label="Copiar"
            tooltip="Copiar texto"
          >
            {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          </Action>
        </Actions>
      </div>
    );
  }

  if (messageRole === "user") {
    return (
      <div className="px-0">
        <Actions className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          <Action
            onClick={handleRegenerateAfterUser}
            label="Reintentar"
            tooltip="Regenerar respuesta"
            disabled={disableRegenerate}
            aria-disabled={disableRegenerate}
          >
            <RedoIcon className="size-4" />
          </Action>
          {onStartEdit && (
            <Action
              onClick={handleStartEdit}
              label="Editar"
              tooltip="Editar"
            >
              <EditIcon className="size-4" />
            </Action>
          )}
          <Action
            onClick={handleCopy}
            label="Copiar"
            tooltip="Copiar texto"
          >
            {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          </Action>
        </Actions>
      </div>
    );
  }

  return null;
});

interface MessageRendererProps {
  message: UIMessage;
  isStreaming: boolean;
  onRegenerateAssistantMessage: (messageId: string) => void;
  onRegenerateAfterUserMessage: (messageId: string) => void;
  onEditUserMessage?: (messageId: string, newText: string) => Promise<void> | void;
  disableRegenerate?: boolean;
  onResponseReady?: (messageId: string) => void;
}

export const MessageRenderer = React.memo(function MessageRenderer({
  message,
  isStreaming,
  onRegenerateAssistantMessage,
  onRegenerateAfterUserMessage,
  onEditUserMessage,
  disableRegenerate = false,
  onResponseReady,
}: MessageRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const textValue = message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("\n");
  const [draft, setDraft] = useState<string>(textValue);
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const startEdit = useCallback(() => {
    setDraft(textValue);
    setIsEditing(true);
    setTimeout(() => {
      textAreaRef.current?.focus();
      textAreaRef.current?.select();
    }, 0);
  }, [textValue]);

  const submitEdit = useCallback(async () => {
    if (!onEditUserMessage) {
      setIsEditing(false);
      return;
    }
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setIsEditing(false);
      return;
    }
    await onEditUserMessage(message.id, trimmed);
    setIsEditing(false);
  }, [onEditUserMessage, draft, message.id]);

  const cancelEdit = useCallback(() => {
    setDraft(textValue);
    setIsEditing(false);
  }, [textValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      submitEdit();
    }
  }, [submitEdit]);

  useEffect(() => {
    if (!isEditing) return;
    const ta = textAreaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 320)}px`;
  }, [isEditing, draft]);

  const hasTextParts = message.parts.some(
    (p) => p.type === "text" && (p as any).text && (p as any).text.length > 0,
  );
  const hasReasoningParts = message.parts.some((p) => p.type === "reasoning");
  const showInlineLoader = isStreaming && message.role === "assistant" && !hasTextParts && !hasReasoningParts;

  // Use ref for onResponseReady to avoid callback recreation (8.2 useLatest pattern)
  const onResponseReadyRef = useLatest(onResponseReady);
  
  // Stable callback that uses ref
  const handleResponseReady = useCallback(() => {
    onResponseReadyRef.current?.(message.id);
  }, [message.id, onResponseReadyRef]);

  // Memoize parts categorization to avoid recomputation
  const { reasoningParts, fileParts } = useMemo(() => ({
    reasoningParts: message.parts.filter(
      (part) => part.type === "reasoning" && "text" in part,
    ),
    fileParts: message.parts.filter(
      (part) => part.type === "file",
    ),
  }), [message.parts]);

  // Direct render without useCallback - React Compiler will optimize this
  const messageContent = (
    <>
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

      {message.parts.map((part, partIdx: number) => {
        if (part.type === "reasoning" || part.type === "source-url" || part.type === "file") {
          return null;
        }

        if (part.type === "text" && "text" in part) {
          if (message.role === "assistant") {
            return (
              <MemoResponse
                key={`${message.id}-${partIdx}`}
                messageId={message.id}
                partIdx={partIdx}
                onReady={handleResponseReady}
                text={part.text}
                isStreaming={isStreaming}
              />
            );
          }
          return (
            <div
              key={`${message.id}-${partIdx}`}
              className="whitespace-pre-wrap break-words"
            >
              {part.text}
            </div>
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
              key={`${message.id}-${partIdx}`}
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
              key={`${message.id}-${partIdx}`}
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
                          ✓ Información recuperada exitosamente
                        </div>
                        <div className="text-xs text-muted-foreground">
                          El contenido ha sido analizado e
                          integrado en la respuesta anterior.
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
                      ? "Error al ejecutar la herramienta"
                      : undefined
                  }
                />
              </ToolContent>
            </Tool>
          );
        }

        return null;
      })}

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
                    alt="Imagen subida"
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
                  title="Ver PDF"
                >
                  <div className="w-full h-full flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <span className="text-red-600 dark:text-red-400 font-bold text-lg">PDF</span>
                  </div>
                </a>
              );
            }
            
            return (
              <div key={`${message.id}-file-${i}`} className="flex items-center gap-2 p-3 border rounded-lg bg-muted">
                <AttachmentsIcon className="size-4" />
                <div className="flex-1">
                  <div className="font-medium">Archivo</div>
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
                  Ver
                </a>
              </div>
            );
          })}
        </div>
      )}
    </>
  );


  // Memoize the start edit callback
  const handleStartEdit = useCallback(() => setIsEditing(true), []);

  return (
    <div className="group message-item">
        {isEditing && message.role === "user" ? (
          <div className="w-full max-w-none px-4">
            <div className="w-full max-w-[80%] ml-auto">
              <div className="bg-hover text-secondary rounded-lg py-3 px-4">
                <textarea
                  ref={textAreaRef}
                  className="w-full min-h-[120px] max-h-[700px] resize-none overflow-auto border-0 px-0 py-0 text-sm leading-relaxed outline-none focus:outline-none focus:ring-0 bg-transparent text-inherit"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="flex justify-end gap-1 mt-2">
                  <button
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-hover text-secondary shadow-container-small hover:bg-popover-main hover:text-popover-text dark:bg-popover-main/50 dark:hover:bg-popover-main transition-colors"
                    title="Cancelar"
                    onClick={cancelEdit}
                  >
                    ✕
                  </button>
                  <button
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-hover text-secondary shadow-container-small hover:bg-popover-main hover:text-popover-text dark:bg-popover-main/50 dark:hover:bg-popover-main transition-colors"
                    title="Guardar y Regenerar"
                    onClick={submitEdit}
                  >
                    ✓
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Message from={message.role} key={message.id}>
            <MessageContent from={message.role}>
              {messageContent}
              {showInlineLoader ? (
                <div className="py-1">
                  <Loader />
                </div>
              ) : null}
            </MessageContent>
          </Message>
        )}
        
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
        
        <MessageActions
          messageId={message.id}
          messageRole={message.role}
          messageParts={message.parts}
          onRegenerateAssistantMessage={onRegenerateAssistantMessage}
          onRegenerateAfterUserMessage={onRegenerateAfterUserMessage}
          disableRegenerate={disableRegenerate}
          onStartEdit={message.role === "user" && !!onEditUserMessage ? handleStartEdit : undefined}
        />
      </div>
  );
}, (prevProps, nextProps) => {
  // For non-streaming messages, only re-render if message content changes
  if (!prevProps.isStreaming && !nextProps.isStreaming) {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.parts === nextProps.message.parts &&
      prevProps.disableRegenerate === nextProps.disableRegenerate
    );
  }
  // For streaming messages, compare all relevant props
  return (
    prevProps.message === nextProps.message &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.disableRegenerate === nextProps.disableRegenerate
  );
});
