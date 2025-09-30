import { useCallback } from "react";
import { toast } from "sonner";
import type { UIMessage } from "ai";

// Utility function to deduplicate messages by ID to prevent React key conflicts
export function deduplicateMessages(messages: UIMessage[]): UIMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
}

interface UseMessageRegenerationProps {
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
  regenerate?: (options?: { messageId?: string }) => void;
}

export function useMessageRegeneration({
  messages,
  setMessages,
  regenerate,
}: UseMessageRegenerationProps) {
  const regenerateAssistantMessage = useCallback(
    async (messageId: string) => {
      if (!regenerate) {
        toast.error("Regenerate function not available");
        return;
      }

      try {
        // Find the message index
        const messageIndex = messages.findIndex((msg) => msg.id === messageId);
        if (messageIndex === -1) {
          toast.error("Message not found");
          return;
        }

        const targetMessage = messages[messageIndex];
        if (targetMessage.role !== "assistant") {
          toast.error("Can only regenerate assistant messages");
          return;
        }

        // First trigger regenerate so AI SDK can still find the target message
        regenerate({ messageId });

        // Then optimistically prune the target assistant message and all that follow
        const prunedMessages = deduplicateMessages(messages.slice(0, messageIndex));
        setMessages(prunedMessages);

        toast.success("Regenerating response...");
      } catch (error) {
        console.error("Failed to regenerate message:", error);
        toast.error("Failed to regenerate message");
        // Restore original messages on error
        setMessages(messages);
      }
    },
    [messages, setMessages, regenerate],
  );

  const regenerateAfterUserMessage = useCallback(
    async (userMessageId: string) => {
      try {
        // Find the user message index
        const userMessageIndex = messages.findIndex(
          (msg) => msg.id === userMessageId,
        );
        if (userMessageIndex === -1) {
          toast.error("User message not found");
          return;
        }

        const userMessage = messages[userMessageIndex];
        if (userMessage.role !== "user") {
          toast.error("Target message must be a user message");
          return;
        }

        // Check if there are any messages after the user message to regenerate
        const hasMessagesAfter =
          messages.slice(userMessageIndex + 1).length > 0;

        if (!hasMessagesAfter) {
          toast.info("No messages to regenerate after this point");
          return;
        }

        // Find the next assistant message after this user message
        const nextAssistantMessage = messages
          .slice(userMessageIndex + 1)
          .find((msg) => msg.role === "assistant");

        if (!nextAssistantMessage) {
          toast.info("No assistant response to regenerate");
          return;
        }

        // Add a small delay to ensure the assistant message is persisted to database
        // This prevents race conditions where the message exists in UI but not in DB yet
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Always use the standard regeneration approach
        // If the assistant message doesn't exist in DB, the mutation will handle it gracefully
        await regenerateAssistantMessage(nextAssistantMessage.id);
      } catch (error) {
        console.error("Failed to regenerate after user message:", error);
        toast.error("Failed to regenerate response");
      }
    },
    [messages, regenerateAssistantMessage],
  );

  return {
    regenerateAssistantMessage,
    regenerateAfterUserMessage,
  };
}

export type { UseMessageRegenerationProps };
