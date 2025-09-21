import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { UIMessage } from "ai";
import { deduplicateMessages } from "./use-message-regeneration";

interface UseMessageEditProps {
  messages: UIMessage[];
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
  ) => void;
  regenerateAfterUserMessage: (messageId: string) => Promise<void>;
  status?: "ready" | "submitted" | "streaming" | "error";
  threadId: string;
}

export function useMessageEdit({
  messages,
  setMessages,
  regenerateAfterUserMessage,
  status,
  threadId,
}: UseMessageEditProps) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const startEditing = useCallback(
    (messageId: string) => {
      if (status === "streaming" || status === "submitted" || isLoading)
        return toast.error("Cannot edit while AI is responding");

      const message = messages.find((msg) => msg.id === messageId);
      if (!message || message.role !== "user")
        return toast.error("Can only edit user messages");

      setEditingMessageId(messageId);
      setEditText(
        message.parts
          .filter((part) => part.type === "text")
          .map((part) => (part as { text: string }).text)
          .join("\n"),
      );
    },
    [messages, status, isLoading],
  );

  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
    setEditText("");
  }, []);

  const saveEdit = useCallback(
    async (messageId: string) => {
      if (!editText.trim()) return toast.error("Message cannot be empty");
      if (isLoading) return; // Prevent concurrent edits

      setIsLoading(true);
      try {
        const messageIndex = messages.findIndex((msg) => msg.id === messageId);
        const targetMessage = messages[messageIndex];

        if (!targetMessage || targetMessage.role !== "user")
          return toast.error("Invalid message");

        const response = await fetch("/api/chat/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            messageId,
            newContent: editText.trim(),
          }),
        });

        if (!response.ok) throw new Error("Failed to update message");

        // Update message locally and remove duplicates
        const updatedMessages = messages.map((msg, i) =>
          i === messageIndex
            ? {
                ...msg,
                parts: [
                  { type: "text", text: editText.trim() },
                ] as typeof msg.parts,
              }
            : msg,
        );

        // Deduplicate messages by ID to prevent React key errors
        const deduplicatedMessages = deduplicateMessages(updatedMessages);

        setMessages(deduplicatedMessages);
        setEditingMessageId(null);
        setEditText("");

        // Check if there are messages after the edited message to regenerate
        const hasMessagesAfter =
          deduplicatedMessages.slice(messageIndex + 1).length > 0;
        if (hasMessagesAfter) {
          setTimeout(() => {
            regenerateAfterUserMessage(messageId);
          }, 100);
        }

        toast.success("Message updated");
      } catch (error) {
        console.error("Edit failed:", error);
        toast.error("Failed to edit message");
        setEditingMessageId(null);
        setEditText("");
      } finally {
        setIsLoading(false);
      }
    },
    [
      messages,
      editText,
      setMessages,
      threadId,
      regenerateAfterUserMessage,
      isLoading,
    ],
  );

  return {
    editText,
    startEditing,
    cancelEditing,
    saveEdit,
    updateEditText: setEditText,
    isEditing: (messageId: string) => editingMessageId === messageId,
    isLoading,
  };
}

export type { UseMessageEditProps };
