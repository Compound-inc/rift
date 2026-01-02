import type { UIMessage } from "@ai-sdk-tools/store";

type ConvexThreadMessage = {
  messageId: string;
  role: "user" | "assistant" | "system";
  reasoning?: string;
  content?: string;
  attachments?: Array<{
    attachmentId: string;
    mimeType: string;
    attachmentUrl: string;
    attachmentType: "image" | "pdf" | "file";
  }>;
  sources?: Array<{
    sourceId: string;
    url: string;
    title?: string;
  }>;
};

/**
 * Convex returns messages newest-first. The chat UI uses chronological order.
 */
export function transformConvexMessages(
  messages: ConvexThreadMessage[],
): UIMessage[] {
  return messages.slice().reverse().map((m) => ({
    id: m.messageId,
    role: m.role,
    parts: [
      ...(m.reasoning
        ? [{ type: "reasoning" as const, text: m.reasoning }]
        : []),
      ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
      ...(m.attachments
        ? m.attachments.map((att) => ({
            type: "file" as const,
            mediaType: att.mimeType,
            url: att.attachmentUrl,
            attachmentId: att.attachmentId,
            attachmentType: att.attachmentType,
          }))
        : []),
      ...(m.sources
        ? m.sources.map((source) => ({
            type: "source-url" as const,
            sourceId: source.sourceId,
            url: source.url,
            title: source.title,
          }))
        : []),
    ],
  }));
}


