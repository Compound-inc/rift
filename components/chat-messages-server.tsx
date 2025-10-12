import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getAccessToken } from "@/lib/auth";
import ChatInterface from "./chat";

interface ChatMessagesServerProps {
  threadId: string;
}

// Server component that fetches messages server-side
export async function ChatMessagesServer({ threadId }: ChatMessagesServerProps) {
  let initialMessages = null;
  
  try {
    const token = await getAccessToken();
    if (token) {
      const result = await fetchQuery(
        api.threads.getThreadMessagesPaginatedSafe,
        { 
          threadId,
          paginationOpts: { numItems: 10, cursor: null } 
        },
        { token }
      );
      // Convert Convex messages to UIMessage format and reverse order (oldest first)
      initialMessages = result.page.reverse().map((m: any) => ({
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
    }
  } catch (error) {
    console.error("Failed to fetch messages server-side:", error);
  }

  return <ChatInterface id={threadId} initialMessages={initialMessages || undefined} />;
}
