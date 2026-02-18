"use client";

import { PromptInputError } from "@/components/chat/prompt-input";
import { useChatUIStore } from "../ui-store";

export function ChatErrorAlert() {
  const error = useChatUIStore((state) => state.chatError);
  const setChatError = useChatUIStore((state) => state.setChatError);

  if (!error) return null;

  return (
    <PromptInputError
      error={error}
      onDismiss={() => setChatError(null)}
    />
  );
}

