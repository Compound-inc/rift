import { copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";
import {
  AttachmentsIcon,
  RedoIcon,
  CopyIcon,
  BranchIcon,
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
import type { UIMessage } from "@ai-sdk/react";

interface MessageRendererProps {
  message: UIMessage;
  status: "ready" | "submitted" | "streaming" | "error";
  messages: UIMessage[];
  onRegenerateAssistantMessage: (messageId: string) => void;
  onRegenerateAfterUserMessage: (messageId: string) => void;
}

export function MessageRenderer({
  message,
  status,
  messages,
  onRegenerateAssistantMessage,
  onRegenerateAfterUserMessage,
}: MessageRendererProps) {
  const renderMessageContent = () => {
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
  };

  return (
    <div className="group">
      <Message from={message.role} key={message.id}>
        <MessageContent from={message.role}>
          {renderMessageContent()}
        </MessageContent>
      </Message>
      
      {/* Sources section for assistant messages - only show when sources exist and response is completed */}
      {message.role === "assistant" && 
       message.parts.filter((part) => part.type === "source-url").length > 0 &&
       !(status === "streaming" && message.id === messages[messages.length - 1]?.id) && (
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
      
      {/* Message Actions for AI */}
      {message.role === "assistant" && (
        <div className="px-0">
          <Actions className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-start">
            <Action
              onClick={() => onRegenerateAssistantMessage(message.id)}
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

            {/* <Action
              onClick={() => {
                toast.info("Branch feature coming soon");
              }}
              label="Branch"
              tooltip="Create a new branch"
            >
              <BranchIcon className="size-4" />
            </Action> */}
          </Actions>
        </div>
      )}
      {/* Actions for user messages */}
      {message.role === "user" && (
        <div className="px-0">
          <Actions className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
            <Action
              onClick={() => onRegenerateAfterUserMessage(message.id)}
              label="Retry"
              tooltip="Retry message"
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
              }}
              label="Copy"
              tooltip="Copy to clipboard"
            >
              <CopyIcon className="size-4" />
            </Action>

            {/* <Action
              onClick={() => {
                toast.info("Branch feature coming soon");
              }}
              label="Branch"
              tooltip="Create a new branch"
            >
              <BranchIcon className="size-4" />
            </Action> */}
          </Actions>
        </div>
      )}
    </div>
  );
}
